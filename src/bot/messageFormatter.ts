import { sanitizeIntercomMessage } from '../utils/sanitizer.js';
import { ChatMessage, NotificationType, FormattedMessage } from '../types/telegram.js';
import logger from '../utils/logger.js';

export class MessageFormatter {
  /**
   * Escapes special characters for Telegram's MarkdownV2 format
   */
  public static escapeMarkdown(text: string): string {
    // Escape special characters for MarkdownV2
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Formats a system message for Telegram
   */
  public static formatSystemMessage(message: string): FormattedMessage {
    const icon = this.escapeMarkdown('🤖');
    const type = this.escapeMarkdown('System:');
    const content = this.escapeMarkdown(message);
    return {
      text: `${icon} *${type}* ${content}`,
      reply_markup: undefined
    };
  }

  /**
   * Formats an Intercom chat message for Telegram
   */
  static formatMessage(
    chat: ChatMessage,
    notificationType: NotificationType
  ): FormattedMessage {
    try {
      // Use the sanitizer to process the message (basic cleanup only)
      const sanitized = sanitizeIntercomMessage(chat);

      // Escape all message components for MarkdownV2
      const userName = this.escapeMarkdown(sanitized.userName);
      const messageBody = this.escapeMarkdown(sanitized.messageBody);

      // Build formatted message object
      const formattedMessage: FormattedMessage = {
        text: [
          `*Location:*`,
          userName,
          '',
          `*Message:*`,
          messageBody
        ].join('\n'),
        reply_markup: {
          inline_keyboard: [[{
            text: 'View in Intercom',
            url: sanitized.inboxUrl
          }]]
        }
      };

      logger.info('Message formatted with sanitizer', {
        chatId: sanitized.rawContent.id,
        type: sanitized.rawContent.type,
        notificationType,
        messageLength: sanitized.messageBody.length
      });

      return formattedMessage;
    } catch (error) {
      logger.error('Error formatting message with sanitizer', {
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
  static determineNotificationType(userType: 'user' | 'contact' | 'admin' | 'lead'): NotificationType {
    if (userType === 'contact' || userType === 'lead') {
      return NotificationType.NEW_CONVERSATION;
    }
    return NotificationType.NEW_MESSAGE;
  }

  /**
   * Extracts notification type from a formatted message
   */
  static extractNotificationType(message: string): NotificationType | 'UNKNOWN' {
    // Since we no longer include notification type in the message format,
    // we'll determine type based on message structure
    if (message.includes('*Location:*') && message.includes('*Message:*')) {
      // All messages now follow the same format, default to NEW_MESSAGE
      return NotificationType.NEW_MESSAGE;
    }
    return 'UNKNOWN';
  }
}