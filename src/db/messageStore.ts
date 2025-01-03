import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import { unlink, existsSync } from 'fs';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);

export class MessageStore {
  private db: Database.Database;
  private readonly CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(dbPath: string = 'messages.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    this.setupCleanup();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sent_messages (
        message_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        conversation_id TEXT,
        message_type TEXT NOT NULL
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        show_new_messages BOOLEAN NOT NULL DEFAULT 1,
        show_new_conversations BOOLEAN NOT NULL DEFAULT 1,
        timestamp INTEGER NOT NULL
      )
    `);
    
    // Create index for faster cleanup queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp
      ON sent_messages(timestamp)
    `);

    logger.info('MessageStore: Database initialized');
  }

  private setupCleanup(): void {
    setInterval(() => {
      this.cleanupOldMessages();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Check if a message has already been sent
   */
  public hasBeenSent(messageId: string): boolean {
    const result = this.db.prepare(
      'SELECT 1 FROM sent_messages WHERE message_id = ?'
    ).get(messageId);
    
    return result !== undefined;
  }

  /**
   * Mark a message as sent
   */
  public markAsSent(
    messageId: string,
    conversationId: string | null,
    messageType: string
  ): void {
    try {
      // Use REPLACE to handle duplicates (acts as upsert)
      this.db.prepare(`
        REPLACE INTO sent_messages (message_id, timestamp, conversation_id, message_type)
        VALUES (?, ?, ?, ?)
      `).run(messageId, Date.now(), conversationId, messageType);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`MessageStore: Error marking message as sent: ${error.message}`, {
          messageId,
          conversationId,
          messageType
        });
      }
      throw error;
    }
  }

  /**
   * Clean up messages older than 7 days
   */
  private cleanupOldMessages(): void {
    const cutoffTime = Date.now() - this.CLEANUP_INTERVAL;
    try {
      const result = this.db.prepare(
        'DELETE FROM sent_messages WHERE timestamp < ?'
      ).run(cutoffTime);
      
      if (result.changes > 0) {
        logger.info(`MessageStore: Cleaned up ${result.changes} old messages`);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`MessageStore: Error during cleanup: ${error.message}`);
      }
    }
  }

  /**
   * Close the database connection
   */
  /**
   * Get user notification preferences
   */
  public getUserPreferences(userId: string): { showNewMessages: boolean; showNewConversations: boolean } {
    const result = this.db.prepare(
      'SELECT show_new_messages, show_new_conversations FROM user_preferences WHERE user_id = ?'
    ).get(userId) as { show_new_messages: number; show_new_conversations: number } | undefined;

    if (!result) {
      // Return defaults if no preferences set
      return {
        showNewMessages: true,
        showNewConversations: true
      };
    }

    return {
      showNewMessages: Boolean(result.show_new_messages),
      showNewConversations: Boolean(result.show_new_conversations)
    };
  }

  /**
   * Update user notification preferences
   */
  public updateUserPreferences(
    userId: string,
    preferences: { showNewMessages?: boolean; showNewConversations?: boolean }
  ): void {
    const currentPrefs = this.getUserPreferences(userId);
    const newPrefs = {
      showNewMessages: preferences.showNewMessages ?? currentPrefs.showNewMessages,
      showNewConversations: preferences.showNewConversations ?? currentPrefs.showNewConversations
    };

    this.db.prepare(`
      REPLACE INTO user_preferences (user_id, show_new_messages, show_new_conversations, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(userId, Number(newPrefs.showNewMessages), Number(newPrefs.showNewConversations), Date.now());
  }

  /**
   * Check if user should receive notification based on type and preferences
   */
  public shouldNotifyUser(userId: string, notificationType: string): boolean {
    const prefs = this.getUserPreferences(userId);
    
    switch (notificationType) {
      case 'NEW_MESSAGE':
        return prefs.showNewMessages;
      case 'NEW_CONVERSATION':
        return prefs.showNewConversations;
      default:
        return true; // Always show system messages
    }
  }

  /**
   * Get the most recent messages
   */
  public getRecentMessages(limit: number = 3): { message_id: string; message_type: string; conversation_id: string | null }[] {
    return this.db.prepare(
      'SELECT message_id, message_type, conversation_id FROM sent_messages ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as { message_id: string; message_type: string; conversation_id: string | null }[];
  }

  /**
   * Clear all data from the database
   */
  public async clearCache(): Promise<number> {
    try {
      // Count total records before clearing
      const messageCount = (this.db.prepare('SELECT COUNT(*) as count FROM sent_messages').get() as { count: number }).count;
      const prefsCount = (this.db.prepare('SELECT COUNT(*) as count FROM user_preferences').get() as { count: number }).count;
      const totalRecords = messageCount + prefsCount;

      // Drop all tables and close connection
      this.db.exec(`
        DROP TABLE IF EXISTS sent_messages;
        DROP TABLE IF EXISTS user_preferences;
        DROP INDEX IF EXISTS idx_timestamp;
      `);
      
      // Close the database connection
      this.db.close();
      
      // Delete the database file if it exists
      if (existsSync('messages.db')) {
        await unlinkAsync('messages.db');
      }
      
      // Reinitialize the database
      this.db = new Database('messages.db');
      this.initializeDatabase();
      
      return totalRecords; // Return actual number of records cleared
    } catch (error) {
      logger.error('Failed to clear database completely', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public close(): void {
    this.db.close();
  }
}

// Create a singleton instance
export const messageStore = new MessageStore();