export enum NotificationType {
  NEW_CONVERSATION = 'NEW_CONVERSATION',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM = 'SYSTEM'
}

export interface QueueItem {
  message: string;
  retryCount: number;
  retryAfter?: number;
  metadata: {
    notificationType: string;
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
}