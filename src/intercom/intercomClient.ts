import axios, { AxiosInstance } from 'axios';
import logger, { NotificationType } from '../utils/logger.js';
import { EventEmitter } from 'events';

interface IntercomWebhookEvent {
  type: string;
  topic: string;
  data: {
    item: {
      type: string;
      id: string;
      conversation_id?: string;
      conversation_message?: {
        type: string;
        id: string;
        body: string;
        author: IntercomAuthor;
      };
    };
  };
}

interface IntercomAuthor {
  type: 'user' | 'contact' | 'admin' | 'lead';
  id: string;
  name: string | null;
  email: string | null;
  user_id?: string;
  external_id?: string;
}

interface IntercomMessage {
  id: string;
  name: string;
  userId?: string;
  email?: string;
  type: 'user' | 'contact' | 'admin' | 'lead';
  message: string;
  timestamp: string;
  metadata?: {
    conversationId: string;
  };
}

export class IntercomClient extends EventEmitter {
  private client: AxiosInstance;

  constructor() {
    super();
    const token = process.env.INTERCOM_ACCESS_TOKEN;

    if (!token) {
      throw new Error('INTERCOM_ACCESS_TOKEN is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.intercom.io',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    logger.info('Intercom client initialized');
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: IntercomWebhookEvent): Promise<void> {
    try {
      logger.info('Processing webhook event', {
        type: event.type,
        topic: event.topic,
        messageId: event.data?.item?.conversation_message?.id
      });

      const conversationMessage = event.data.item.conversation_message;
      if (!conversationMessage) {
        logger.info('No conversation message in event', { event });
        return;
      }

      const message = this.stripHtml(conversationMessage.body || '');
      const author = conversationMessage.author;
      
      const messageData: IntercomMessage = {
        id: conversationMessage.id, // Use the unique message ID
        name: this.formatUserName(author),
        userId: author.user_id || author.id,
        email: author.email || undefined,
        type: author.type,
        message: message,
        timestamp: new Date().toISOString(),
        metadata: {
          conversationId: event.data.item.conversation_id || event.data.item.id
        }
      };

      // Determine if this is a new conversation or message
      const isNewConversation = event.topic === 'conversation.user.created';
      
      logger.info('Emitting new message event', {
        type: isNewConversation ? NotificationType.NEW_CONVERSATION : NotificationType.NEW_MESSAGE,
        content: messageData.message,
        userId: messageData.userId,
        userName: messageData.name,
        metadata: {
          messageId: messageData.id,
          conversationId: messageData.metadata?.conversationId,
          email: messageData.email,
          type: messageData.type,
          authorType: author.type,
          webhookTopic: event.topic
        }
      });

      this.emit('new_message', messageData);
    } catch (error) {
      logger.error('Error processing webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event
      });
      throw error;
    }
  }

  /**
   * Strip HTML tags from a string
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Format user name with additional information
   */
  private formatUserName(author: IntercomAuthor): string {
    const parts: string[] = [];

    // Add name if available
    if (author.name) {
      parts.push(author.name);
    }

    // Add user ID for anonymous users or as additional info
    const userId = author.user_id || author.external_id || author.id;
    if (!author.name || author.type === 'lead') {
      parts.push(`Anonymous ${author.type} (${userId})`);
    }

    // Add email if available
    if (author.email) {
      parts.push(`<${author.email}>`);
    }

    return parts.join(' ');
  }
}