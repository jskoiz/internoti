import { config } from 'dotenv';
import { IntercomClient } from './intercom/intercomClient.js';
import { TelegramBot } from './bot/telegramBot.js';
import { WebhookServer } from './webhook/webhookServer.js';
import logger, { initLogger } from './utils/logger.js';

// Load environment variables first
config();

// Initialize logger with environment settings
initLogger();

async function main() {
  try {
    // Log environment variables for debugging
    logger.info('Environment loaded', {
      hasIntercomToken: !!process.env.INTERCOM_ACCESS_TOKEN,
      hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasWebhookUrl: !!process.env.WEBHOOK_URL,
      webhookPort: process.env.WEBHOOK_PORT
    });

    // Initialize components
    const intercomClient = new IntercomClient();
    const telegramBot = new TelegramBot();
    const webhookServer = new WebhookServer();

    // Set up event handlers
    intercomClient.on('new_message', async (message) => {
      await telegramBot.sendMessage(message);
    });

    webhookServer.on('webhook_event', async (event) => {
      await intercomClient.processWebhookEvent(event);
    });

    // Start services
    await webhookServer.start();
    await telegramBot.connect();

    logger.info('All services started successfully');

    // Handle shutdown
    const shutdown = async () => {
      logger.info('Shutting down services...');
      await webhookServer.stop();
      await telegramBot.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to start services', {
      error: err.message,
      stack: err.stack,
      details: error
    });
    console.error('Full error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    details: error
  });
  console.error('Full error:', error);
  process.exit(1);
});