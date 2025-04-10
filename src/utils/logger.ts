import os from 'os';

// Utility function to get memory and CPU usage
function getResourceUsage() {
  const used = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`
    },
    cpu: {
      user: `${Math.round(cpuUsage.user / 1000)}ms`,
      system: `${Math.round(cpuUsage.system / 1000)}ms`
    },
    loadAverage: os.loadavg()
  };
}

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  STEP = 'STEP'
}

// Log interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  resources?: any;
}

// Logger class
class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(level: LogLevel, message: string, data?: any, includeResources: boolean = false): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    if (data) {
      logEntry.data = data;
    }

    if (includeResources) {
      logEntry.resources = getResourceUsage();
    }

    return logEntry;
  }

  private log(level: LogLevel, message: string, data?: any, includeResources: boolean = false) {
    const logEntry = this.formatLog(level, message, data, includeResources);
    const logString = JSON.stringify(logEntry);

    // Always log to stdout/stderr for proper capture by Railway
    switch (level) {
      case LogLevel.ERROR:
        process.stderr.write(logString + '\n');
        break;
      case LogLevel.WARN:
        process.stdout.write(logString + '\n');
        break;
      case LogLevel.STEP:
        process.stdout.write(logString + '\n');
        break;
      default:
        if (this.isDevelopment || level !== LogLevel.DEBUG) {
          process.stdout.write(logString + '\n');
        }
    }
  }

  public debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  public error(message: string, error: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  public step(step: string, duration: number, data?: any) {
    this.log(LogLevel.STEP, step, { ...data, duration: `${duration}ms` }, true);
  }
}

export const logger = Logger.getInstance(); 