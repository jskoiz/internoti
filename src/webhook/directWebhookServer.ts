import express, { Request, Response } from "express";
import crypto from "crypto";
import { EventEmitter } from "events";
import logger from "../utils/logger.js";

// Extend Express Request to include rawBody
interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

interface IntercomAuthor {
  type: string;
  id: string;
  name?: string;
  email?: string;
}

interface IntercomWebhookEvent {
  type: string;
  topic: string;
  data: {
    item: {
      type: string;
      id: string;
      source?: {
        body: string;
        author: IntercomAuthor;
      };
      conversation_parts?: {
        conversation_parts: Array<{
          type: string;
          id: string;
          body: string;
          author: IntercomAuthor;
        }>;
      };
    };
  };
}

interface WebhookEventPayload {
  type: string;
  topic: string;
  data: {
    item: {
      type: string;
      id: string;
      conversation_message: {
        type: string;
        id: string;
        body: string;
        author: IntercomAuthor;
      };
    };
  };
}

/**
 * DirectWebhookServer implements direct webhook handling from Intercom
 * This eliminates the need for webhook.site as an intermediary
 */
export class DirectWebhookServer extends EventEmitter {
  private server: express.Application;
  private port: number;
  private webhookSecret: string;

  constructor() {
    super();

    // Get configuration from environment
    const port = process.env.WEBHOOK_PORT
      ? parseInt(process.env.WEBHOOK_PORT)
      : 3000;
    const secret = process.env.INTERCOM_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error(
        "INTERCOM_WEBHOOK_SECRET is required for webhook verification",
      );
    }

    this.port = port;
    this.webhookSecret = secret;
    this.server = express();

    // Parse JSON bodies
    this.server.use(
      express.json({
        verify: (req: WebhookRequest, _res: Response, buf: Buffer) => {
          // Store raw body for signature verification
          req.rawBody = buf;
        },
      }),
    );

    // Set up webhook endpoint
    this.server.post(
      "/webhook",
      (req: WebhookRequest, res: Response, next: express.NextFunction) => {
        this.verifyWebhookSignature(req, res, next);
      },
      (req: WebhookRequest, res: Response) => {
        void this.handleWebhook(req, res);
      },
    );
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info("Direct webhook server started", {
          port: this.port,
        });
        resolve();
      });
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.listen().close(() => {
          logger.info("Direct webhook server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Verify Intercom webhook signature
   * https://developers.intercom.com/building-apps/docs/setting-up-webhooks#section-security
   */
  private verifyWebhookSignature(
    req: WebhookRequest,
    res: Response,
    next: express.NextFunction,
  ): void {
    const signature = req.header("X-Hub-Signature");
    if (!signature || !req.rawBody) {
      logger.error("Missing webhook signature or raw body");
      res.status(401).send("Missing signature or raw body");
      return;
    }

    const computedSignature = crypto
      .createHmac("sha1", this.webhookSecret)
      .update(req.rawBody)
      .digest("hex");

    if (`sha1=${computedSignature}` !== signature) {
      logger.error("Invalid webhook signature");
      res.status(401).send("Invalid signature");
      return;
    }

    next();
  }

  /**
   * Handle incoming webhook events
   */
  private async handleWebhook(
    req: WebhookRequest,
    res: Response,
  ): Promise<void> {
    try {
      const event = req.body as IntercomWebhookEvent;

      if (event.type === "notification_event") {
        logger.info("Processing webhook event", {
          type: event.type,
          topic: event.topic,
        });

        // Handle both new conversations and conversation parts
        const source = event.data?.item?.source;
        const conversationParts =
          event.data?.item?.conversation_parts?.conversation_parts;
        const latestMessage = conversationParts?.[0];

        let webhookEvent: WebhookEventPayload | null = null;

        // For new conversations, use source
        if (source && event.topic === "conversation.user.created") {
          webhookEvent = {
            type: event.type,
            topic: event.topic,
            data: {
              item: {
                type: event.data.item.type,
                id: event.data.item.id,
                conversation_message: {
                  type: "conversation",
                  id: event.data.item.id,
                  body: source.body,
                  author: source.author,
                },
              },
            },
          };
        }
        // For conversation parts, use the latest message
        else if (latestMessage) {
          webhookEvent = {
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
                  author: latestMessage.author,
                },
              },
            },
          };
        }

        if (webhookEvent) {
          this.emit("webhook_event", webhookEvent);
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error processing webhook", {
        error: error instanceof Error ? error.message : "Unknown error",
        body: req.body,
      });
      res.status(500).send("Internal Server Error");
    }
  }
}
