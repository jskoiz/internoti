import logger from './logger.js';

export interface IntercomPayload {
  id: string;
  name: string;
  userId?: string;
  email?: string;
  type: 'user' | 'contact' | 'admin' | 'lead';
  message: string;
  timestamp: string;
}

export interface SanitizedPayload {
  userName: string;
  messageBody: string;
  timestamp: string;
  inboxUrl: string;
  rawContent: {
    id: string;
    type: 'user' | 'contact' | 'admin' | 'lead';
    userId?: string;
    email?: string;
  };
}

/**
 * Sanitizes text for Telegram's MarkdownV2 format based on context
 */
function sanitizeText(text: string, context: 'text' | 'url' | 'timestamp'): string {
  if (!text) return '';

  // Common special characters that need escaping in MarkdownV2
  const specialChars = /[_*[\]()~`>#+=|{}.!-]/g;

  switch (context) {
    case 'url':
      // URLs need careful escaping to remain clickable
      // Only escape characters that would break the URL structure
      return text.replace(/[[\]()~`>#+=|{}.!]/g, '\\$&');
    
    case 'timestamp':
      // Timestamps need consistent escaping for readability
      return text.replace(specialChars, '\\$&');
    
    case 'text':
    default:
      // General text needs full escaping
      return text.replace(specialChars, '\\$&');
  }
}

/**
 * Clean HTML and truncate message content
 */
function cleanMessageContent(message: string): string {
  // Remove HTML tags
  const cleanMessage = message.replace(/<[^>]*>/g, '').trim();
  
  // Truncate if too long
  return cleanMessage.length > 3000
    ? cleanMessage.substring(0, 3000) + '...'
    : cleanMessage;
}

/**
 * Format timestamp consistently
 */
function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Main sanitizer function that processes Intercom payloads
 */
export function sanitizeIntercomMessage(raw: IntercomPayload): SanitizedPayload {
  try {
    // Clean and prepare the message content
    const cleanedMessage = cleanMessageContent(raw.message);
    
    // Generate the Intercom inbox URL
    const inboxUrl = `https://app.intercom.com/a/inbox/${raw.id}`;
    
    // Create the sanitized payload
    const sanitized: SanitizedPayload = {
      userName: sanitizeText(raw.name, 'text'),
      messageBody: sanitizeText(cleanedMessage, 'text'),
      timestamp: sanitizeText(formatTimestamp(raw.timestamp), 'timestamp'),
      inboxUrl: sanitizeText(inboxUrl, 'url'),
      rawContent: {
        id: raw.id,
        type: raw.type,
        userId: raw.userId,
        email: raw.email
      }
    };

    // Validate the sanitized content
    const containsUnescapedChars = /[_*[\]()~`>#+=|{}.!-]/.test(
      Object.values(sanitized)
        .filter(v => typeof v === 'string')
        .join('')
    );

    if (containsUnescapedChars) {
      logger.warn('Potentially unescaped characters in sanitized content', {
        messageId: raw.id,
        userType: raw.type
      });
    }

    return sanitized;
  } catch (error) {
    logger.error('Error sanitizing Intercom message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: raw.id,
      userType: raw.type
    });
    throw error;
  }
}