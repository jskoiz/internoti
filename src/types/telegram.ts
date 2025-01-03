export enum NotificationType {
  NEW_CONVERSATION = 'NEW_CONVERSATION',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM = 'SYSTEM'
}

export interface QueueItem {
  message: FormattedMessage;
  retryCount: number;
  retryAfter?: number;
  messageId: string;
  conversationId?: string;
  metadata: {
    notificationType: string;
  };
}

export interface FormattedMessage {
  text: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url: string;
    }>>;
  };
}

export interface ChatMessage {
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