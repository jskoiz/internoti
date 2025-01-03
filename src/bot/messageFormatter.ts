import { sanitizeIntercomMessage } from '../utils/sanitizer.js';
import { ChatMessage, NotificationType, FormattedMessage } from '../types/telegram.js';
import { TELEGRAM_CONFIG } from '../config/telegram.js';
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

      // Get the appropriate icon and escape it
      const icon = this.escapeMarkdown(this.getNotificationIcon(notificationType));
      
      // Prepare the notification type
      const type = this.escapeMarkdown(notificationType.toString().replace(/_/g, ' '));

      // Escape all message components for MarkdownV2
      const userName = this.escapeMarkdown(sanitized.userName);
      const messageBody = this.escapeMarkdown(sanitized.messageBody);
      const formattedTime = this.escapeMarkdown(sanitized.timestamp.formatted);
      const timeAgo = this.escapeMarkdown(sanitized.timestamp.timeAgo);

      // Get color based on notification type
      const colorPrefix = notificationType === NotificationType.NEW_CONVERSATION ? '🟣' : '🔵';

      // Build formatted message object
      const formattedMessage: FormattedMessage = {
        text: [
          `${colorPrefix} ${icon} *${type}*`,
          `_${formattedTime} \\(${timeAgo}\\)_`,
          '',
          `*Name:*`,
          userName,
          '',
          `*Message:*`,
          messageBody
        ].join('\n'),
        reply_markup: {
          inline_keyboard: [[{
            text: '👁️ View in Intercom',
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
   * Gets the appropriate icon for a notification type
   */
  private static getNotificationIcon(type: NotificationType): string {
    return TELEGRAM_CONFIG.ICONS[type] || TELEGRAM_CONFIG.ICONS.SYSTEM;
  }

  /**
   * Extracts notification type from a formatted message
   */
  static extractNotificationType(message: string): NotificationType | 'UNKNOWN' {
    // Handle escaped underscores in the message with new format
    const match = message.match(/[🟣🔵] [💬🆕🤖] \*(NEW[ _]CONVERSATION|NEW[ _]MESSAGE|SYSTEM)\*/u);
    if (!match) return 'UNKNOWN';
    
    // Remove escaping from the matched type
    const type = match[1].replace(/[ _]/g, '_');
    return type as NotificationType;
  }
}