export const TELEGRAM_CONFIG = {
  // Topic ID for notifications in the Telegram group
  NOTIFICATION_TOPIC_ID: 34,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second between messages
  QUEUE_CHECK_INTERVAL: 1000, // 1 second

  // Message icons
  ICONS: {
    NEW_CONVERSATION: '🆕',
    NEW_MESSAGE: '💬',
    SYSTEM: '🤖'
  },

  // Message options
  MESSAGE_OPTIONS: {
    parse_mode: 'MarkdownV2' as const,
    disable_web_page_preview: true
  }
};