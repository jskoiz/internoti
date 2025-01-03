import TelegramBotAPI from 'node-telegram-bot-api';
import type { Message } from 'node-telegram-bot-api';
import logger from '../utils/logger.js';
import { ChatMessage } from '../types/telegram.js';
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

    // Initialize with polling enabled to receive commands
    this.bot = new TelegramBotAPI(token, { polling: true });
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
      // Register bot commands for both private chats and groups
      await this.bot.setMyCommands([
        {
          command: 'faq',
          description: 'Show information'
        }
      ], {
        scope: {
          type: 'all_private_chats'
        }
      });
      
      await this.bot.setMyCommands([
        {
          command: 'faq',
          description: 'Show information'
        }
      ], {
        scope: {
          type: 'all_group_chats'
        }
      });
      
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
    try {
      const type = MessageFormatter.determineNotificationType(chat.type);
      const formattedMessage = MessageFormatter.formatMessage(chat, type);
      
      logger.info('Processing notification', {
        chatId: chat.id,
        userType: chat.type,
        userName: chat.name
      });
      await this.queueManager.queueMessage(formattedMessage, chat);
    } catch (error) {
      logger.error('Failed to send message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId: chat.id
      });
    }
  }

  /**
   * Verify connection to Telegram and group access
   */
  /**
   * Handle /faq command
   */
  private async handleFaqCommand(msg: Message): Promise<void> {
    try {
      const faqText = [ 
        '*What I Do:*',
        '• Forward Intercom messages to Telegram',
        '• Handle new conversations and messages',
        '• Process user information securely',
        '• Manage message queuing and rate limits',
        '',
        '*Message Types:*',
        '🔵 *New Conversations*',
        '   • First messages from new users',
        '   • Include user details when available',
        '',
        '🟢 *Ongoing Messages*',
        '   • Messages in existing conversations',
        '   • Threaded for easy tracking',
        '',
        '⚙️ *System Messages*',
        '   • Connection status',
        '   • Important system events'
      ].join('\n');

      await this.bot.sendMessage(
        msg.chat.id,
        faqText,
        {
          message_thread_id: msg.message_thread_id || undefined,
          parse_mode: 'MarkdownV2'
        }
      );
    } catch (error) {
      logger.error('Failed to send faq message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: msg.from?.id
      });
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      const connectionMsg = MessageFormatter.formatSystemMessage('Internoti bot connected successfully');
      await this.bot.sendMessage(
        this.groupId,
        connectionMsg.text,
        {
          ...TELEGRAM_CONFIG.MESSAGE_OPTIONS,
          message_thread_id: TELEGRAM_CONFIG.NOTIFICATION_TOPIC_ID,
          reply_markup: connectionMsg.reply_markup
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
      
      // Handle messages and commands
      this.bot.on('message', async (msg: Message) => {
        if (!msg.text || !msg.entities) return;

        // Check for commands first
        const commandEntity = msg.entities.find(entity => entity.type === 'bot_command');
        if (commandEntity) {
          const command = msg.text.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);
          const cleanCommand = command.split('@')[0]; // Remove bot username if present
          
          if (cleanCommand === '/faq') {
            await this.handleFaqCommand(msg);
            return;
          }
        }

        // If no command found, check for bot mentions
        const botMention = msg.entities.some(
          entity =>
            entity.type === 'mention' &&
            msg.text!.substring(entity.offset, entity.offset + entity.length) === `@${botInfo.username}`
        );

        if (botMention) {
          await this.bot.sendMessage(
            msg.chat.id,
            'Use /faq to get information.',
            {
              message_thread_id: msg.message_thread_id || undefined,
              reply_to_message_id: msg.message_id
            }
          );
        }
      });

      // No callback queries needed for simple /faq command

      logger.info('Bot started listening for messages');
    } catch (error) {
      logger.error('Failed to start bot listener', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
