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
  timestamp: {
    formatted: string;
    timeAgo: string;
  };
  inboxUrl: string;
  rawContent: {
    id: string;
    type: 'user' | 'contact' | 'admin' | 'lead';
    userId?: string;
    email?: string;
  };
}

/**
 * Basic text cleanup without Markdown escaping
 */
function sanitizeText(text: string): string {
  if (!text) return '';

  // Remove HTML tags and decode HTML entities
  let sanitized = text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Trim whitespace and normalize spaces
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  return sanitized;
}

/**
 * Clean HTML and truncate message content
 */
function cleanMessageContent(message: string): string {
  // Remove HTML tags
  const cleanMessage = sanitizeText(message).trim();
  
  // Truncate if too long
  return cleanMessage.length > 3000
    ? cleanMessage.substring(0, 3000) + '...'
    : cleanMessage;
}

/**
 * Format timestamp consistently
 */
function formatTimestamp(timestamp: string): { formatted: string; timeAgo: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  // Format time without seconds
  const formatted = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Calculate time ago
  let timeAgo: string;
  if (diffInMinutes < 1) {
    timeAgo = 'just now';
  } else if (diffInMinutes === 1) {
    timeAgo = '1 minute ago';
  } else if (diffInMinutes < 60) {
    timeAgo = `${diffInMinutes} minutes ago`;
  } else if (diffInMinutes < 120) {
    timeAgo = '1 hour ago';
  } else if (diffInMinutes < 1440) {
    timeAgo = `${Math.floor(diffInMinutes / 60)} hours ago`;
  } else {
    timeAgo = `${Math.floor(diffInMinutes / 1440)} days ago`;
  }
  
  return { formatted, timeAgo };
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
      userName: sanitizeText(raw.name),
      messageBody: cleanedMessage,
      timestamp: formatTimestamp(raw.timestamp),
      inboxUrl: inboxUrl,
      rawContent: {
        id: raw.id,
        type: raw.type,
        userId: raw.userId,
        email: raw.email
      }
    };

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