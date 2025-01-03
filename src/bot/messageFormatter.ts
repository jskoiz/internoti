import { sanitizeIntercomMessage } from '../utils/sanitizer.js';
import { ChatMessage, NotificationType } from '../types/telegram.js';
import { TELEGRAM_CONFIG } from '../config/telegram.js';
import logger from '../utils/logger.js';

export class MessageFormatter {
  /**
   * Formats an Intercom chat message for Telegram using the sanitizer
   */
  static formatMessage(
    chat: ChatMessage,
    notificationType: NotificationType
  ): string {
    try {
      // Use the sanitizer to process the message
      const sanitized = sanitizeIntercomMessage(chat);

      // Get the appropriate icon
      const icon = this.getNotificationIcon(notificationType);
      
      // Prepare the notification type with proper escaping
      const type = notificationType.toString().replace(/_/g, '\\_');

      // Build message with sanitized content
      const formattedMessage = [
        `${icon} *${type}*`,
        `*Name:* ${sanitized.userName}`,
        `*Message:* ${sanitized.messageBody}`,
        `*Time:* ${sanitized.timestamp}`,
        `*View:* ${sanitized.inboxUrl}`
      ].join('\n');

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
   * Gets the appropriate icon for a notification type
   */
  private static getNotificationIcon(type: NotificationType): string {
    return TELEGRAM_CONFIG.ICONS[type] || TELEGRAM_CONFIG.ICONS.SYSTEM;
  }

  /**
   * Extracts notification type from a formatted message
   */
  static extractNotificationType(message: string): NotificationType | 'UNKNOWN' {
    const match = message.match(/\*(NEW_CONVERSATION|NEW_MESSAGE|SYSTEM)\*/);
    return match ? (match[1] as NotificationType) : 'UNKNOWN';
  }

  /**
   * Validates message format and checks for unescaped characters
   */
  static validateMessageFormat(message: string): boolean {
    const containsUnescapedChars = /[_*[\]()~`>#+=|{}.!-]/.test(message);
    if (containsUnescapedChars) {
      logger.warn('Message contains potentially unescaped characters', {
        messagePreview: message.substring(0, 100)
      });
      return false;
    }
    return true;
  }
}