import logger from "../utils/logger.js";

interface Config {
  intercomToken: string;
  telegramBotToken: string;
  telegramGroupId: string;
  webhookUrl?: string;
  webhookPort?: number;
  webhookSecret?: string;
}

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: Config | null = null;

  private constructor() {}

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  public async loadConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    logger.info("Loading configuration from environment variables");
    const requiredVars = {
      intercomToken: process.env.INTERCOM_ACCESS_TOKEN,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramGroupId: process.env.TELEGRAM_GROUP_ID,
    };

    // Check for missing required variables
    const missingVars = Object.entries(requiredVars)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
    }

    try {
      this.config = {
        ...requiredVars,
        webhookUrl: process.env.WEBHOOK_URL,
        webhookPort: process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT, 10) : undefined,
        webhookSecret: process.env.WEBHOOK_SECRET,
      } as Config;

      return this.config;
    } catch (error) {
      logger.error("Failed to load configuration", { error });
      throw error;
    }
  }

  public async getConfig(): Promise<Config> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }
}

export const environmentConfig = EnvironmentConfig.getInstance();