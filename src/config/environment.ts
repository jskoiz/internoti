import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
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
  private ssmClient: SSMClient | null = null;

  private constructor() {
    if (process.env.AWS_REGION) {
      this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    }
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private async getParameterValue(paramName: string): Promise<string> {
    if (!this.ssmClient) {
      throw new Error("AWS SSM client not initialized - AWS_REGION not set");
    }

    const command = new GetParameterCommand({
      Name: `/internoti/${paramName}`,
      WithDecryption: true,
    });

    try {
      const response = await this.ssmClient.send(command);
      if (!response.Parameter?.Value) {
        throw new Error(`Parameter ${paramName} not found in Parameter Store`);
      }
      return response.Parameter.Value;
    } catch (error) {
      logger.error(`Failed to get parameter ${paramName} from Parameter Store`, { error });
      throw error;
    }
  }

  public async loadConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    // Check if we're running in AWS (determined by AWS_REGION being set)
    const isAws = !!process.env.AWS_REGION;

    try {
      if (isAws) {
        logger.info("Loading configuration from AWS Parameter Store");
        this.config = {
          intercomToken: await this.getParameterValue("intercom-token"),
          telegramBotToken: await this.getParameterValue("telegram-token"),
          telegramGroupId: await this.getParameterValue("telegram-group-id"),
          webhookSecret: await this.getParameterValue("webhook-secret").catch(() => undefined),
          webhookPort: parseInt(process.env.WEBHOOK_PORT || "3000", 10),
        };
      } else {
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

        this.config = {
          ...requiredVars,
          webhookUrl: process.env.WEBHOOK_URL,
          webhookPort: process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT, 10) : undefined,
          webhookSecret: process.env.WEBHOOK_SECRET,
        } as Config;
      }

      return this.config;
    } catch (error) {
      logger.error("Failed to load configuration", { error, isAws });
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