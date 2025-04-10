import express, { Request, Response } from 'express';
import { scrapePortfolio } from '../../scraper/scraper.js';
import { analyzePortfolio } from '../../llm/analyze.js';
import { config } from '../../config/env.js';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Add health check endpoint
app.use('/health', healthRouter);

// Cache implementation
interface CacheEntry {
  data: any;
  timestamp: number;
}

const portfolioCache: Record<string, CacheEntry> = {};

// Função para logging estruturado
const log = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...data
    }));
  },
  error: (message: string, error: any) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    }));
  }
};

// Middleware para logging de requisições
app.use((req: Request, res: Response, next: Function) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip
  });

  // Interceptar o response para logging
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    return originalSend.call(this, body);
  };

  next();
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Tales Analyzer API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      portfolioReview: '/portfolio-review'
    }
  });
});

// Middleware para validar URL
const validateUrl = (req: Request, res: Response, next: Function) => {
  const { url } = req.body;
  if (!url) {
    logger.error('URL validation failed', { error: 'URL is required' });
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    new URL(url);
    next();
  } catch (err) {
    logger.error('URL validation failed', { error: 'Invalid URL format', url });
    return res.status(400).json({ error: 'Invalid URL format' });
  }
};

// Função para limpar os arquivos temporários
function cleanupTempFiles(directory: string) {
  try {
    if (fs.existsSync(directory)) {
      const files = fs.readdirSync(directory);
      for (const file of files) {
        const filePath = path.join(directory, file);
        fs.unlinkSync(filePath);
      }
      fs.rmdirSync(directory);
      logger.info('Temporary files cleaned up', { directory });
    }
  } catch (error) {
    logger.error('Error cleaning up temporary files', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      directory 
    });
  }
}

app.post('/portfolio-review', validateUrl, async (req: Request, res: Response) => {
  const { url, useCache = true } = req.body;
  const startTime = Date.now();
  const outputDir = path.join(os.tmpdir(), 'tales-analyzer-screenshots');

  try {
    // Check cache first if useCache is true
    if (useCache && portfolioCache[url]) {
      const cachedEntry = portfolioCache[url];
      const cacheAge = Date.now() - cachedEntry.timestamp;
      
      logger.info('Using cached portfolio analysis', {
        url,
        cacheAge: `${cacheAge}ms`,
        totalTime: `${Date.now() - startTime}ms`
      });
      
      return res.status(200).json({
        success: true,
        data: cachedEntry.data,
        fromCache: true
      });
    }

    log.info('Starting portfolio scraping', { url });
    
    // Scrape the portfolio
    const { textContent, images, structuredContent } = await scrapePortfolio(url);
    const scrapeTime = Date.now() - startTime;
    
    log.info('Portfolio scraping completed', {
      url,
      scrapeTime: `${scrapeTime}ms`,
      contentLength: textContent?.length || 0,
      imagesCount: images.length
    });
    
    if (!textContent && images.length === 0) {
      logger.error('No content found', { url });
      return res.status(404).json({ error: 'No content found on the provided URL' });
    }

    // Analyze the portfolio
    log.info('Starting portfolio analysis');
    const analysisStartTime = Date.now();
    const analysis = await analyzePortfolio({ textContent, images, structuredContent });
    const analysisTime = Date.now() - analysisStartTime;
    
    log.info('Portfolio analysis completed', {
      url,
      analysisTime: `${analysisTime}ms`,
      totalTime: `${Date.now() - startTime}ms`
    });
    
    // Store in cache
    portfolioCache[url] = {
      data: analysis,
      timestamp: Date.now()
    };
    
    res.status(200).json({
      success: true,
      data: analysis,
      fromCache: false
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    logger.error('Error processing portfolio', {
      url,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      processingTime: `${errorTime}ms`
    });
    
    // Clean up temporary files even if there's an error
    cleanupTempFiles(outputDir);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { 
    error: error.message,
    stack: error.stack
  });
  // Give the logger time to write the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Add error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Give the logger time to write the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

const PORT = process.env.PORT || config.port;
app.listen(PORT, () => {
  logger.info('Server started', { 
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV
  });
}); 