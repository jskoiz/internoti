import TelegramBotAPI from 'node-telegram-bot-api';
import type { Message } from 'node-telegram-bot-api';
import logger from '../utils/logger.js';
import { ChatMessage, NotificationType } from '../types/telegram.js';
import { MessageFormatter } from './messageFormatter.js';
import { QueueManager } from './queueManager.js';
import { TELEGRAM_CONFIG } from '../config/telegram.js';

export class TelegramBot {
  private bot: TelegramBotAPI;
  private isConnected: boolean = false;
  private groupId: string;
  private queueManager: QueueManager;

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
    this.queueManager = new QueueManager(this.bot, this.groupId);
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
      this.queueManager.startProcessor();
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
  async sendMessage(chat: ChatMessage): Promise<void> {
    const notificationType = MessageFormatter.determineNotificationType(chat.type);
    const formattedMessage = MessageFormatter.formatMessage(chat, notificationType);
    
    logger.info('Processing notification', {
      chatId: chat.id,
      notificationType,
      userType: chat.type,
      userName: chat.name
    });
    
    await this.queueManager.queueMessage(formattedMessage);
  }

  /**
   * Verify connection to Telegram and group access
   */
  private async verifyConnection(): Promise<void> {
    try {
      const connectionMsg = `🤖 *System:* Internoti bot connected successfully`;
      await this.bot.sendMessage(
        this.groupId,
        connectionMsg,
        {
          ...TELEGRAM_CONFIG.MESSAGE_OPTIONS,
          message_thread_id: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID
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
