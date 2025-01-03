import axios from 'axios';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

export class WebhookServer extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null;
  private lastTokenId: string | null = null;
  private processedEvents = new Set<string>();

  constructor() {
    super();
  }

  async start(): Promise<void> {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL is required');
    }

    // Extract token from webhook.site URL
    const token = webhookUrl.split('/').pop();
    if (!token) {
      throw new Error('Invalid webhook.site URL');
    }

    // Start polling webhook.site
    this.pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`https://webhook.site/token/${token}/requests${this.lastTokenId ? `?after=${this.lastTokenId}` : ''}`);
        
        if (response.data && response.data.data) {
          for (const request of response.data.data) {
            // Skip if we've already processed this event
            if (this.processedEvents.has(request.uuid)) {
              continue;
            }

            if (request.content) {
              try {
                const event = JSON.parse(request.content);
                
                // Only process new events
                if (!this.processedEvents.has(event.id)) {
                  logger.info('Processing new webhook event', {
                    id: request.uuid,
                    type: event.type,
                    topic: event.topic
                  });

                  if (event.type === 'notification_event') {
                    // Extract the conversation message
                    const conversationParts = event.data?.item?.conversation_parts?.conversation_parts;
                    const latestMessage = conversationParts?.[0];
                    
                    if (latestMessage) {
                      this.emit('webhook_event', {
                        type: event.type,
                        topic: event.topic,
                        data: {
                          item: {
                            type: event.data.item.type,
                            id: event.data.item.id,
                            conversation_message: {
                              type: latestMessage.type,
                              id: latestMessage.id,
                              body: latestMessage.body,
                              author: latestMessage.author
                            }
                          }
                        }
                      });
                    }
                  }

                  // Mark event as processed
                  this.processedEvents.add(request.uuid);
                  this.processedEvents.add(event.id);
                }
              } catch (error) {
                logger.error('Error processing webhook event', {
                  error: error instanceof Error ? error.message : 'Unknown error',
                  content: request.content
                });
              }
            }
            this.lastTokenId = request.uuid;
          }

          // Cleanup old processed events (keep last 1000)
          if (this.processedEvents.size > 1000) {
            const events = Array.from(this.processedEvents);
            events.slice(0, events.length - 1000).forEach(id => {
              this.processedEvents.delete(id);
            });
          }
        }
      } catch (error) {
        logger.error('Error polling webhook.site', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 2000); // Poll every 2 seconds

    logger.info('Started polling webhook.site', {
      url: webhookUrl
    });
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info('Stopped polling webhook.site');
    }
  }
}