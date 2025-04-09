import express, { Request, Response } from 'express';
import { scrapePortfolio } from '../../scraper/scraper.js';
import { analyzePortfolio } from '../../llm/analyze.js';
import { config } from '../../config/env.js';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

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
  
  log.info('Incoming request', {
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
    log.info('Request completed', {
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

// Middleware para validar URL
const validateUrl = (req: Request, res: Response, next: Function) => {
  const { url } = req.body;
  if (!url) {
    log.error('URL validation failed', { error: 'URL is required' });
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    new URL(url);
    next();
  } catch (err) {
    log.error('URL validation failed', { error: 'Invalid URL format', url });
    return res.status(400).json({ error: 'Invalid URL format' });
  }
};

app.post('/portfolio-review', validateUrl, async (req: Request, res: Response) => {
  const { url } = req.body;
  const startTime = Date.now();

  try {
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
      log.error('No content found', { url });
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
    
    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    log.error('Error processing portfolio', {
      url,
      error: err,
      processingTime: `${errorTime}ms`
    });
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  log.info('Health check requested');
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || config.port;
app.listen(PORT, () => {
  log.info('Server started', { port: PORT });
}); 