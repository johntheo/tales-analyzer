import express, { Request, Response } from 'express';
import { scrapePortfolio } from '../../scraper/scraper.js';
import { analyzePortfolio } from '../../llm/analyze.js';
import { enrichWithReferences } from '../../reference/index.js';
import { config } from '../../config/env.js';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

const app = express();
app.use(express.json());
app.use(cors());

// Cache implementation
interface CacheEntry {
  data: any;
  timestamp: number;
}

const portfolioCache: Record<string, CacheEntry> = {};

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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
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
    logger.error('Error cleaning up temporary files', { error, directory });
  }
}

app.post('/portfolio-review', validateUrl, async (req: Request, res: Response) => {
  const { url, useCache = true, includeReferences = false } = req.body;
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

    logger.info('Starting portfolio analysis process', { url });
    
    // Step 1: Scrape the portfolio
    const scrapeStartTime = Date.now();
    const { textContent, images, structuredContent } = await scrapePortfolio(url);
    const scrapeTime = Date.now() - scrapeStartTime;
    
    logger.step('scrape', scrapeTime, {
      url,
      contentLength: textContent?.length || 0,
      imagesCount: images.length
    });
    
    if (!textContent && images.length === 0) {
      logger.error('No content found', { url });
      return res.status(404).json({ error: 'No content found on the provided URL' });
    }

    // Step 2: Analyze the portfolio
    const analysisStartTime = Date.now();
    const analysis = await analyzePortfolio({ textContent, images, structuredContent });
    const analysisTime = Date.now() - analysisStartTime;
    
    logger.step('analyze', analysisTime, {
      url,
      summaryLength: analysis.summary.length
    });
    
    // Step 3: Enrich with references if requested
    let finalAnalysis = analysis;
    if (includeReferences) {
      const referenceStartTime = Date.now();
      finalAnalysis = await enrichWithReferences(analysis);
      const referenceTime = Date.now() - referenceStartTime;
      
      logger.step('reference', referenceTime, {
        url,
        referencesCount: {
          videos: finalAnalysis.references.videos.length,
          podcasts: finalAnalysis.references.podcasts.length,
          articles: finalAnalysis.references.articles.length,
          decks: finalAnalysis.references.decks.length,
          books: finalAnalysis.references.books.length
        }
      });
    }
    
    // Store in cache
    portfolioCache[url] = {
      data: finalAnalysis,
      timestamp: Date.now()
    };
    
    // Log total process time
    const totalTime = Date.now() - startTime;
    logger.info('Portfolio analysis process completed', {
      url,
      totalTime: `${totalTime}ms`,
      steps: includeReferences ? ['scrape', 'analyze', 'reference'] : ['scrape', 'analyze']
    });
    
    // Clean up temporary files after analysis is complete
    cleanupTempFiles(outputDir);
    
    res.status(200).json({
      success: true,
      data: finalAnalysis,
      fromCache: false
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    logger.error('Error processing portfolio', {
      url,
      error: err,
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

const PORT = process.env.PORT || config.port;
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
}); 