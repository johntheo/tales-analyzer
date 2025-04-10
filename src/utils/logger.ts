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
  private isRailway: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || 
                     process.env.RAILWAY_ENVIRONMENT_NAME !== undefined ||
                     process.env.RAILWAY_SERVICE_NAME !== undefined;
    
    // Log initial configuration
    this.log(LogLevel.INFO, 'Logger initialized', {
      isDevelopment: this.isDevelopment,
      isRailway: this.isRailway,
      nodeEnv: process.env.NODE_ENV,
      railwayEnv: process.env.RAILWAY_ENVIRONMENT,
      railwayEnvName: process.env.RAILWAY_ENVIRONMENT_NAME,
      railwayServiceName: process.env.RAILWAY_SERVICE_NAME
    });
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
      // Handle Error objects properly
      if (data instanceof Error) {
        logEntry.data = {
          message: data.message,
          stack: data.stack,
          name: data.name
        };
      } else if (typeof data === 'object' && data !== null) {
        // Deep clone the data to avoid modifying the original
        const clonedData = JSON.parse(JSON.stringify(data));
        
        // Process any Error objects in the data
        const processErrors = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          
          for (const key in obj) {
            if (obj[key] instanceof Error) {
              obj[key] = {
                message: obj[key].message,
                stack: obj[key].stack,
                name: obj[key].name
              };
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              processErrors(obj[key]);
            }
          }
        };
        
        processErrors(clonedData);
        logEntry.data = clonedData;
      } else {
        logEntry.data = data;
      }
    }

    if (includeResources) {
      logEntry.resources = getResourceUsage();
    }

    return logEntry;
  }

  private log(level: LogLevel, message: string, data?: any, includeResources: boolean = false) {
    try {
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
          if (this.isDevelopment || level !== LogLevel.DEBUG || this.isRailway) {
            process.stdout.write(logString + '\n');
          }
      }
    } catch (error) {
      // Fallback logging in case of error in the logger itself
      const errorMessage = error instanceof Error ? error.message : String(error);
      const timestamp = new Date().toISOString();
      const fallbackLog = JSON.stringify({
        timestamp,
        level: 'ERROR',
        message: 'Logger error',
        error: errorMessage
      });
      
      process.stderr.write(fallbackLog + '\n');
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
    this.log(LogLevel.ERROR, message, error);
  }

  public step(step: string, duration: number, data?: any) {
    this.log(LogLevel.STEP, step, { ...data, duration: `${duration}ms` }, true);
  }
}

export const logger = Logger.getInstance(); 