import TelegramBotAPI from 'node-telegram-bot-api';
import type { Message } from 'node-telegram-bot-api';
import logger from '../utils/logger.js';

export enum NotificationType {
  NEW_CONVERSATION = 'NEW_CONVERSATION',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM = 'SYSTEM'
}

export class TelegramBot {
  private bot: TelegramBotAPI;
  private isConnected: boolean = false;
  private groupId: string;
  private messageQueue: Array<{
    message: string;
    retryCount: number;
    retryAfter?: number;
    metadata: {
      notificationType: string;
    };
  }> = [];
  private processingQueue: boolean = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.groupId = process.env.TELEGRAM_GROUP_ID || '';

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    if (!this.groupId) {
      throw new Error('TELEGRAM_GROUP_ID is required');
    }

    // Initialize with polling disabled
    this.bot = new TelegramBotAPI(token, { polling: false });
  }

  /**
   * Connect to Telegram and verify group access
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.bot.deleteWebHook();
      await this.verifyConnection();
      await this.startListening();
      this.isConnected = true;
      this.startQueueProcessor();
      logger.info('Telegram bot connected successfully');
    } catch (error) {
      logger.error('Failed to connect Telegram bot', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.bot.stopPolling();
      this.isConnected = false;
      logger.info('Telegram bot disconnected');
    } catch (error) {
      logger.error('Failed to disconnect Telegram bot', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send a message to the configured group
   */
  async sendMessage(chat: {
    id: string;
    name: string;
    userId?: string;
    email?: string;
    type: 'user' | 'contact' | 'admin' | 'lead';
    message: string;
    timestamp: string;
  }): Promise<void> {
    const notificationType = this.determineNotificationType(chat.type);
    const formattedMessage = this.formatMessage(chat, notificationType);
    
    logger.info('Processing notification', {
      chatId: chat.id,
      notificationType,
      userType: chat.type,
      userName: chat.name
    });
    
    await this.queueMessage(formattedMessage);
  }

  /**
   * Queue a message for sending
   */
  private async queueMessage(message: string): Promise<void> {
    try {
      const notificationType = this.extractNotificationType(message);
      
      // Validate message format before queueing
      // Test for known MarkdownV2 special characters
      const containsUnescapedChars = /[_*[\]()~`>#+=|{}.!-]/.test(message);
      if (containsUnescapedChars) {
        logger.warn('Message contains potentially unescaped characters', {
          notificationType,
          messagePreview: message.substring(0, 100)
        });
      }
      
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
          // Wait 1 second between messages to respect Telegram's rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
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
              if (item.retryCount >= 3) {
                logger.error('Failed to send message after 3 retries', {
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
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processingQueue) {
        this.processQueue().catch(error => {
          logger.error('Error processing message queue', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      }
    }, 1000);
  }

  /**
   * Verify connection to Telegram and group access
   */
  private async verifyConnection(): Promise<void> {
    try {
      // Try to send a test message
      // Send connection message to the same topic as notifications
      const TOPIC_ID = 34;
      const connectionMsg = this.formatText('Internoti bot connected successfully');
      const formattedMessage = `🤖 *System:* ${connectionMsg}`;
      await this.bot.sendMessage(
        this.groupId,
        formattedMessage,
        {
          parse_mode: 'MarkdownV2',
          message_thread_id: TOPIC_ID,
          disable_web_page_preview: true
        }
      );
      logger.info('Telegram bot initialized and connected to group', {
        groupId: this.groupId
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to connect to Telegram group', {
        error: errorMsg,
        groupId: this.groupId
      });
      throw new Error(`Telegram connection failed: ${errorMsg}`);
    }
  }

  /**
   * Extracts notification type from a formatted message
   */
  private extractNotificationType(message: string): NotificationType | 'UNKNOWN' {
    const match = message.match(/\*(NEW_CONVERSATION|NEW_MESSAGE|SYSTEM)\*/);
    return match ? (match[1] as NotificationType) : 'UNKNOWN';
  }

  /**
   * Actually sends the message to Telegram
   */
  private async sendNotification(message: string): Promise<void> {
    try {
      const TOPIC_ID = 34;
      const notificationType = this.extractNotificationType(message);
      
      logger.info('Attempting to send Telegram notification', {
        groupId: this.groupId,
        messageLength: message.length,
        topicId: TOPIC_ID,
        notificationType
      });

      // Log message structure with enhanced details
      logger.debug('Message structure', {
        totalLength: message.length,
        lineCount: message.split('\n').length,
        firstLine: message.split('\n')[0],
        hasProperNewlines: message.includes('\n'),
        hasProperBoldSyntax: /\*[^*]+\*/.test(message)
      });

      await this.bot.sendMessage(
        this.groupId,
        message,
        {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
          message_thread_id: TOPIC_ID
        }
      );

      logger.info('Notification sent to Telegram group topic', {
        topicId: TOPIC_ID,
        notificationType
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const notificationType = this.extractNotificationType(message);
      
      const errorDetails = {
        error: errorMsg,
        groupId: this.groupId,
        messageLength: message.length,
        topicId: 34,
        notificationType,
        messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        containsUnescapedChars: /[_*[\]()~`>#+=|{}.!-]/.test(message),
        isTelegramError: errorMsg.includes('ETELEGRAM'),
        hasMarkdownV2Issues: /Bad Request: can't parse entities/.test(errorMsg),
        // Example raw message sample to see ASCII codes:
        rawMessageSample: message
          .substring(0, 50)
          .split('')
          .map(c => `${c}(${c.charCodeAt(0)})`)
          .join(' ')
      };

      logger.error('Failed to send Telegram notification', errorDetails);
      throw error;
    }
  }

  /**
   * Escapes special characters for Telegram's MarkdownV2 format
   */
  private formatText(text: string): string {
    if (!text) return '';
    
    // Escape all special characters in one pass
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Formats an Intercom chat message for Telegram
   */
  private formatMessage(
    chat: {
      id: string;
      name: string;
      userId?: string;
      email?: string;
      type: 'user' | 'contact' | 'admin' | 'lead';
      message: string;
      timestamp: string;
    },
    notificationType: NotificationType
  ): string {
    try {
      // Clean and truncate message
      const cleanMessage = chat.message.replace(/<[^>]*>/g, '').trim();
      const truncatedMessage = cleanMessage.length > 3000
        ? cleanMessage.substring(0, 3000) + '...'
        : cleanMessage;

      // Prepare items with context-based escaping
      const icon = notificationType === NotificationType.NEW_CONVERSATION ? '🆕' : '💬';
      // Escaping underscores in the NotificationType itself for MarkdownV2
      const type = notificationType.toString().replace(/_/g, '\\_');
      const name = this.formatText(chat.name);
      const msg = this.formatText(truncatedMessage);
      const time = this.formatText(new Date(chat.timestamp).toLocaleString());
      const url = this.formatText(`https://app.intercom.com/a/inbox/${chat.id}`);

      // Build message with newlines that Telegram can parse
      const formattedMessage = [
        `${icon} *${type}*`,
        `*Name:* ${name}`,
        `*Message:* ${msg}`,
        `*Time:* ${time}`,
        `*View:* ${url}`
      ].join('\n');

      logger.info('Message formatted', {
        chatId: chat.id,
        type: chat.type,
        notificationType,
        messageLength: truncatedMessage.length,
        hasUnescapedChars: /[_*[\]()~`>#+=|{}.!-]/.test(formattedMessage)
      });

      // Return raw newlines so Telegram can parse them with MarkdownV2
      return formattedMessage;
    } catch (error) {
      logger.error('Error formatting message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId: chat.id,
        notificationType
      });
      throw error;
    }
  }

  /**
   * Determines the notification type based on the user type
   */
  private determineNotificationType(userType: 'user' | 'contact' | 'admin' | 'lead'): NotificationType {
    if (userType === 'contact' || userType === 'lead') {
      return NotificationType.NEW_CONVERSATION;
    }
    return NotificationType.NEW_MESSAGE;
  }

  /**
   * Starts listening for bot commands and messages
   */
  private async startListening(): Promise<void> {
    try {
      const botInfo = await this.bot.getMe();
      
      this.bot.on('message', async (msg: Message) => {
        if (!msg.text || !msg.entities) return;

        // Only process messages that mention the bot
        const botMention = msg.entities.some(
          entity =>
            entity.type === 'mention' &&
            msg.text!.substring(entity.offset, entity.offset + entity.length) === `@${botInfo.username}`
        );

        if (!botMention) return;

        // Extract the command from the message
        const command = msg.text.replace(`@${botInfo.username}`, '').trim();
        
        if (command === 'hi-1') {
          try {
            const response = await this.bot.sendMessage(
              msg.chat.id,
              'Message received in hi-1 topic',
              {
                message_thread_id: msg.message_thread_id || undefined,
                reply_to_message_id: msg.message_id
              }
            );
            
            logger.info('Sent response to hi-1 topic', {
              chatId: msg.chat.id,
              messageId: response.message_id,
              threadId: msg.message_thread_id
            });
          } catch (error) {
            logger.error('Failed to send response', {
              error: error instanceof Error ? error.message : 'Unknown error',
              command
            });
          }
        }
      });

      logger.info('Bot started listening for messages');
    } catch (error) {
      logger.error('Failed to start bot listener', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
