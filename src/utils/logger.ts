import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Custom log levels (lower number = higher priority)
// When setting LOG_LEVEL, you'll only see messages of that level and higher priority
// Example: LOG_LEVEL=warn will show only error (0) and warn (1) messages
// Example: LOG_LEVEL=info will show error (0), warn (1), and info (2) messages
const customLevels = {
  levels: {
    error: 0,    // Highest priority - always shown
    warn: 1,     // Warnings and errors
    info: 2,     // Info, warnings, and errors
    http: 3,     // HTTP and above
    verbose: 4,  // More detailed info
    debug: 5,    // Debug information
    silly: 6,    // Most verbose
    minimal: -1  // Only critical errors
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

// Initialize Winston with custom levels and colors
winston.addColors(customLevels.colors);

// Enhanced replacer function to handle problematic content
const safeJsonReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: unknown) => {
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
      const responseObj = value as { body?: unknown; statusCode?: number; headers?: unknown };
      if (responseObj.body !== undefined && responseObj.statusCode !== undefined) {
        const bodyObj = responseObj.body as { 
          error_code?: string | number; 
          description?: string; 
          error?: string;
          error_details?: unknown;
          details?: unknown;
        };
        
        if (bodyObj.error_code || bodyObj.description || bodyObj.error) {
          return {
            statusCode: responseObj.statusCode,
            error: {
              code: bodyObj.error_code,
              description: bodyObj.description,
              error: bodyObj.error,
              details: bodyObj.error_details || bodyObj.details
            },
            headers: responseObj.headers,
            rawBody: typeof responseObj.body === 'string' ? responseObj.body.substring(0, 500) : undefined
          };
        }
        return {
          statusCode: responseObj.statusCode,
          success: true,
          headers: responseObj.headers
        };
      }
    }
    
    // Enhanced string handling to expose problematic characters
    if (typeof value === 'string') {
      // Check for and highlight unescaped characters
      const isControlChar = (char: string): boolean => {
        const code = char.charCodeAt(0);
        return (code <= 0x1F) || (code >= 0x7F && code <= 0x9F) || code === 0x2028 || code === 0x2029;
      };
      
      const chars = Array.from(value);
      const hasProblematicChars = chars.some(isControlChar);
      
      if (hasProblematicChars) {
        return `[String with unescaped chars: ${chars.map(char =>
          isControlChar(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char
        ).join('')}]`;
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
  metadata?: Record<string, unknown>;
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

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Common format for both console and file transports
const commonFormat = winston.format.printf(({ level, message, timestamp, ...metadata }: { 
  level: string; 
  message: unknown; 
  timestamp?: string; 
  [key: string]: unknown;
}) => {
  // Handle notification log objects
  if (typeof message === 'object' && message && 'type' in message) {
    return formatNotificationLog(message as NotificationLog, timestamp, level);
  }
  
  // Enhanced error logging
  if (message instanceof Error) {
    return `${timestamp ? `${timestamp} ` : ''}${level}: ${message.stack}\nCause: ${message.cause ? JSON.stringify(message.cause, safeJsonReplacer(), 2) : 'None'}`;
  }
  
  // Handle regular messages with enhanced object logging
  const formattedMessage = typeof message === 'object' && message !== null
    ? JSON.stringify(message, safeJsonReplacer(), 2)
    : message;
  
  // Include additional metadata if present
  const metadataStr = Object.keys(metadata).length ? 
    `\n  Metadata: ${JSON.stringify(metadata, safeJsonReplacer(), 2)}` : '';
  
  return `${timestamp ? `${timestamp} ` : ''}${level}: ${formattedMessage}${metadataStr}`;
});

// Create base logger instance
const baseLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'debug', // Default level, will be overridden by initLogger
  format: winston.format.combine(
    winston.format.timestamp(),
    commonFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        commonFormat
      ),
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exitOnError: false
});

// Function to initialize logger with environment settings
export const initLogger = () => {
  const level = process.env.LOG_LEVEL || 'debug';
  console.error(`[Logger] Initializing with level: ${level}`);
  
  baseLogger.level = level;

  // Test log level filtering
  if (process.env.NODE_ENV !== 'test') {
    console.error('\n[Logger] Testing log levels:');
    baseLogger.error('Test error message - should always show');
    baseLogger.warn('Test warning message - shows if level is warn or lower');
    baseLogger.info('Test info message - shows if level is info or lower');
    baseLogger.debug('Test debug message - shows if level is debug or lower');
    console.error(`[Logger] Current level: ${baseLogger.level} (lower number = higher priority)\n`);
  }

  return baseLogger;
};

// Export the logger
export default baseLogger;