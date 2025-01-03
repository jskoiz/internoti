import TelegramBot from 'node-telegram-bot-api';
import { QueueItem } from '../types/telegram.js';
import { TELEGRAM_CONFIG } from '../config/telegram.js';
import { MessageFormatter } from './messageFormatter.js';
import logger from '../utils/logger.js';

export class QueueManager {
  private messageQueue: QueueItem[] = [];
  private processingQueue: boolean = false;
  private bot: TelegramBot;
  private groupId: string;

  constructor(bot: TelegramBot, groupId: string) {
    this.bot = bot;
    this.groupId = groupId;
  }

  /**
   * Queue a message for sending
   */
  async queueMessage(message: string): Promise<void> {
    try {
      const notificationType = MessageFormatter.extractNotificationType(message);
      
      // Validate message format before queueing
      MessageFormatter.validateMessageFormat(message);
      
      this.messageQueue.push({
        message,
        retryCount: 0,
        metadata: { notificationType }
      });
      
      logger.info('Message queued', {
        notificationType,
        queueLength: this.messageQueue.length,
        messageLength: message.length
      });
      
      if (!this.processingQueue) {
        await this.processQueue();
      }
    } catch (error) {
      logger.error('Failed to queue message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageLength: message.length
      });
      throw error;
    }
  }

  /**
   * Start the queue processor
   */
  startProcessor(): void {
    setInterval(() => {
      if (!this.processingQueue) {
        this.processQueue().catch(error => {
          logger.error('Error processing message queue', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      }
    }, TELEGRAM_CONFIG.QUEUE_CHECK_INTERVAL);
  }

  /**
   * Process the message queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const item = this.messageQueue[0];
        
        // If we need to wait, pause processing
        if (item.retryAfter && item.retryAfter > Date.now()) {
          setTimeout(() => this.processQueue(), item.retryAfter - Date.now());
          break;
        }

        try {
          await this.sendNotification(item.message);
          this.messageQueue.shift(); // Remove successfully sent message
          // Wait between messages to respect rate limits
          await new Promise(resolve => setTimeout(resolve, TELEGRAM_CONFIG.RETRY_DELAY));
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ETELEGRAM: 429')) {
              // Extract retry after value
              const retryAfter = error.message.match(/retry after (\d+)/);
              if (retryAfter) {
                const waitSeconds = parseInt(retryAfter[1], 10);
                item.retryAfter = Date.now() + (waitSeconds * 1000);
                logger.info('Rate limited by Telegram', {
                  waitSeconds,
                  queueLength: this.messageQueue.length,
                  notificationType: item.metadata.notificationType
                });
                break;
              }
            } else if (error.message.includes('Bad Request: can\'t parse entities')) {
              // Message formatting error - log and remove from queue
              logger.error('Message formatting error', {
                error: error.message,
                notificationType: item.metadata.notificationType,
                messagePreview: item.message.substring(0, 100)
              });
              this.messageQueue.shift();
            } else {
              // For other errors, increment retry count or remove if too many retries
              item.retryCount++;
              if (item.retryCount >= TELEGRAM_CONFIG.MAX_RETRIES) {
                logger.error(`Failed to send message after ${TELEGRAM_CONFIG.MAX_RETRIES} retries`, {
                  error: error.message,
                  notificationType: item.metadata.notificationType,
                  totalRetries: item.retryCount
                });
                this.messageQueue.shift();
              } else {
                logger.warn('Retrying message send', {
                  error: error.message,
                  retryCount: item.retryCount,
                  notificationType: item.metadata.notificationType
                });
              }
            }
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Actually sends the message to Telegram
   */
  private async sendNotification(message: string): Promise<void> {
    try {
      const notificationType = MessageFormatter.extractNotificationType(message);
      
      logger.info('Attempting to send Telegram notification', {
        groupId: this.groupId,
        messageLength: message.length,
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType
      });

      await this.bot.sendMessage(
        this.groupId,
        message,
        {
          ...TELEGRAM_CONFIG.MESSAGE_OPTIONS,
          message_thread_id: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID
        }
      );

      logger.info('Notification sent to Telegram group topic', {
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const notificationType = MessageFormatter.extractNotificationType(message);
      
      const errorDetails = {
        error: errorMsg,
        groupId: this.groupId,
        messageLength: message.length,
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType,
        messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        containsUnescapedChars: MessageFormatter.validateMessageFormat(message),
        isTelegramError: errorMsg.includes('ETELEGRAM'),
        hasMarkdownV2Issues: /Bad Request: can't parse entities/.test(errorMsg)
      };

      logger.error('Failed to send Telegram notification', errorDetails);
      throw error;
    }
  }
}