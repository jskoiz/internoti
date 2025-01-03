import TelegramBot from 'node-telegram-bot-api';
import { QueueItem, ChatMessage, FormattedMessage } from '../types/telegram.js';
import { TELEGRAM_CONFIG } from '../config/telegram.js';
import { MessageFormatter } from './messageFormatter.js';
import logger from '../utils/logger.js';
import { messageStore } from '../db/messageStore.js';

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
  async queueMessage(formattedMessage: FormattedMessage, chatMessage: ChatMessage): Promise<void> {
    try {
      const notificationType = MessageFormatter.extractNotificationType(formattedMessage.text);
      
      // Check if message was already sent
      if (messageStore.hasBeenSent(chatMessage.id)) {
        logger.info('Skipping duplicate message', {
          messageId: chatMessage.id,
          notificationType
        });
        return;
      }
      
      this.messageQueue.push({
        message: formattedMessage,
        messageId: chatMessage.id,
        conversationId: chatMessage.metadata?.conversationId,
        retryCount: 0,
        metadata: { notificationType }
      });
      
      logger.info('Message queued', {
        messageId: chatMessage.id,
        notificationType,
        queueLength: this.messageQueue.length
      });
      
      if (!this.processingQueue) {
        await this.processQueue();
      }
    } catch (error) {
      logger.error('Failed to queue message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: chatMessage.id
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
          await this.sendNotification(item);
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
                messageId: item.messageId
              });
              this.messageQueue.shift();
            } else {
              // For other errors, increment retry count or remove if too many retries
              item.retryCount++;
              if (item.retryCount >= TELEGRAM_CONFIG.MAX_RETRIES) {
                logger.error(`Failed to send message after ${TELEGRAM_CONFIG.MAX_RETRIES} retries`, {
                  error: error.message,
                  notificationType: item.metadata.notificationType,
                  messageId: item.messageId,
                  totalRetries: item.retryCount
                });
                this.messageQueue.shift();
              } else {
                logger.warn('Retrying message send', {
                  error: error.message,
                  retryCount: item.retryCount,
                  notificationType: item.metadata.notificationType,
                  messageId: item.messageId
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
  private async sendNotification(item: QueueItem): Promise<void> {
    try {
      logger.info('Attempting to send Telegram notification', {
        groupId: this.groupId,
        messageId: item.messageId,
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType: item.metadata.notificationType
      });

      await this.bot.sendMessage(
        this.groupId,
        item.message.text,
        {
          ...TELEGRAM_CONFIG.MESSAGE_OPTIONS,
          message_thread_id: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
          reply_markup: item.message.reply_markup
        }
      );

      // Mark message as sent in the store with proper notification type
      messageStore.markAsSent(
        item.messageId,
        item.conversationId || null,
        item.metadata.notificationType === 'NEW_CONVERSATION' ? 'NEW_CONVERSATION' :
        item.metadata.notificationType === 'NEW_MESSAGE' ? 'NEW_MESSAGE' : 'SYSTEM'
      );

      logger.info('Notification sent to Telegram group topic', {
        messageId: item.messageId,
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType: item.metadata.notificationType
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      const errorDetails = {
        error: errorMsg,
        groupId: this.groupId,
        messageId: item.messageId,
        topicId: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
        notificationType: item.metadata.notificationType,
        messagePreview: item.message.text.substring(0, 100) + (item.message.text.length > 100 ? '...' : ''),
        isTelegramError: errorMsg.includes('ETELEGRAM'),
        hasMarkdownV2Issues: /Bad Request: can't parse entities/.test(errorMsg)
      };

      logger.error('Failed to send Telegram notification', errorDetails);
      throw error;
    }
  }
}