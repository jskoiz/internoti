import winston from 'winston';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
    minimal: -1 // Most restrictive level, only critical errors
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray',
    minimal: 'red'
  }
};

// Enhanced replacer function to handle problematic content
const safeJsonReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    // Skip symbol properties
    if (typeof key === 'symbol' || key.startsWith('Symbol(')) {
      return '[Symbol]';
    }
    
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
      
      // Enhanced error object handling
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
          cause: value.cause
        };
      }

      // For response objects, include more detailed error information
      if (value.body !== undefined && value.statusCode !== undefined) {
        if (value.body.error_code || value.body.description || value.body.error) {
          return {
            statusCode: value.statusCode,
            error: {
              code: value.body.error_code,
              description: value.body.description,
              error: value.body.error,
              details: value.body.error_details || value.body.details
            },
            headers: value.headers, // Include headers for debugging
            rawBody: typeof value.body === 'string' ? value.body.substring(0, 500) : undefined
          };
        }
        return {
          statusCode: value.statusCode,
          success: true,
          headers: value.headers
        };
      }
    }
    
    // Enhanced string handling to expose problematic characters
    if (typeof value === 'string') {
      // Check for and highlight unescaped characters
      const problematicChars = value.match(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g);
      if (problematicChars) {
        return `[String with unescaped chars: ${value.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, 
          char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)}]`;
      }
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    return value;
  };
};

// Define notification types
export enum NotificationType {
  NEW_CONVERSATION = 'NEW_CONVERSATION',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM = 'SYSTEM'
}

// Enhanced interface for structured notification logs
export interface NotificationLog {
  type: NotificationType;
  content: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
  formatting?: {
    originalLength: number;
    processedLength: number;
    containsHtml: boolean;
    containsEmoji: boolean;
    specialCharacters: string[];
    encoding: string;
  };
  processingSteps?: string[];
}

const formatNotificationLog = (notif: NotificationLog, timestamp?: string, level?: string) => {
  const userInfo = notif.userId ?
    ` [User: ${notif.userName} (${notif.userId})]` :
    (notif.userName ? ` [User: ${notif.userName}]` : '');
  
  const formattingInfo = notif.formatting ? 
    `\n  Formatting: ${JSON.stringify(notif.formatting, null, 2)}` : '';
  
  const processingSteps = notif.processingSteps?.length ?
    `\n  Processing Steps: ${notif.processingSteps.join(' -> ')}` : '';

  const prefix = timestamp ? `${timestamp} ${level}` : level || '';
  
  return `${prefix} [${notif.type}]${userInfo}:
  Content: ${notif.content}
  Metadata: ${notif.metadata ? JSON.stringify(notif.metadata, safeJsonReplacer(), 2) : 'None'}${formattingInfo}${processingSteps}`;
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug', // Set default to debug for more verbosity
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...metadata }: { level: string, message: any, timestamp?: string }) => {
      // Handle notification log objects
      if (typeof message === 'object' && message && 'type' in message) {
        return formatNotificationLog(message as NotificationLog, timestamp, level);
      }
      
      // Enhanced error logging
      if (message instanceof Error) {
        return `${timestamp} ${level}: ${message.stack}\nCause: ${message.cause ? JSON.stringify(message.cause, safeJsonReplacer(), 2) : 'None'}`;
      }
      
      // Handle regular messages with enhanced object logging
      const formattedMessage = typeof message === 'object' && message !== null
        ? JSON.stringify(message, safeJsonReplacer(), 2) // Use pretty printing
        : message;
      
      // Include additional metadata if present
      const metadataStr = Object.keys(metadata).length ? 
        `\n  Metadata: ${JSON.stringify(metadata, safeJsonReplacer(), 2)}` : '';
      
      return `${timestamp} ${level}: ${formattedMessage}${metadataStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, ...metadata }) => {
          // Handle notification log objects
          if (typeof message === 'object' && message && 'type' in message) {
            return formatNotificationLog(message as NotificationLog, undefined, level);
          }
          
          // Enhanced error logging
          if (message instanceof Error) {
            return `${level}: ${message.stack}\nCause: ${message.cause ? JSON.stringify(message.cause, safeJsonReplacer(), 2) : 'None'}`;
          }
          
          // Handle regular messages with enhanced object logging
          const formattedMessage = typeof message === 'object' && message !== null
            ? JSON.stringify(message, safeJsonReplacer(), 2)
            : message;
          
          // Include additional metadata if present
          const metadataStr = Object.keys(metadata).length ? 
            `\n  Metadata: ${JSON.stringify(metadata, safeJsonReplacer(), 2)}` : '';
          
          return `${level}: ${formattedMessage}${metadataStr}`;
        })
      ),
    }),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    }),
  ],
});

// Prevent logging in test environment
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach((t) => (t.silent = true));
}

export default logger;