import puppeteer from 'puppeteer-core';
import OpenAI from 'openai';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Função para extrair JSON de uma string que pode conter texto adicional
function extractJSON(text: string): any {
  try {
    // Tenta primeiro analisar a string inteira como JSON
    return JSON.parse(text);
  } catch (e) {
    // Se falhar, tenta encontrar um objeto JSON na string
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('Could not extract valid JSON from response');
      }
    }
    throw new Error('No JSON object found in response');
  }
}

interface Project {
  title: string;
  description: string;
  images: string[];
  skills: string[];
  context?: string;
  screenshots?: string[]; // URLs dos screenshots relacionados ao projeto
}

interface SkillsExtraction {
  projects: Project[];
  skills: string[];
}

interface StructuredContent {
  title: string;
  metaDescription: string;
  sections: Array<{
    title: string;
    content: string;
    type: string;
  }>;
  projects: Project[];
  skills: string[];
  screenshots: string[]; // URLs de todos os screenshots capturados
  visitedUrls: string[]; // URLs visitadas durante o scraping
}

// Função para capturar screenshot
async function captureScreenshot(page: any, url: string, outputDir: string): Promise<string> {
  const screenshotId = uuidv4();
  const filename = `${screenshotId}.png`;
  const filepath = path.join(outputDir, filename);
  
  try {
    logger.debug('Taking screenshot', { url, filepath });
    
    // Check if output directory exists, create if not
    if (!fs.existsSync(outputDir)) {
      logger.debug('Creating output directory', { outputDir });
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    await page.screenshot({ 
      path: filepath, 
      fullPage: true 
    });
    
    logger.debug('Screenshot saved', { filepath });
    return filepath;
  } catch (error) {
    logger.error('Error capturing screenshot', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url,
      filepath
    });
    throw error; // Re-throw to be handled by the caller
  }
}

// Função para extrair links internos
async function extractInternalLinks(page: any, baseUrl: string): Promise<string[]> {
  try {
    logger.debug('Extracting internal links from page', { baseUrl });
    
    const links = await page.evaluate((baseUrl: string) => {
      try {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const internalLinks = new Set<string>();
        
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;
          
          try {
            const url = new URL(href, baseUrl);
            // Verifica se é um link interno (mesmo domínio)
            if (url.hostname === new URL(baseUrl).hostname) {
              internalLinks.add(url.href);
            }
          } catch (e) {
            // Ignora URLs inválidas
            console.error('Invalid URL:', href, e);
          }
        }
        
        return Array.from(internalLinks);
      } catch (e) {
        console.error('Error in page.evaluate:', e);
        return [];
      }
    }, baseUrl);
    
    logger.debug('Internal links extracted', { count: links.length, baseUrl });
    return links;
  } catch (error) {
    logger.error('Error extracting internal links', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      baseUrl
    });
    return []; // Return empty array on error to allow continuation
  }
}

// Função para visitar URLs recursivamente
async function visitUrlsRecursively(
  browser: any, 
  urls: string[], 
  visited: Set<string>, 
  depth: number, 
  maxDepth: number, 
  baseUrl: string,
  outputDir: string,
  screenshots: string[]
): Promise<void> {
  if (depth > maxDepth || urls.length === 0) return;
  
  for (const url of urls) {
    if (visited.has(url)) continue;
    visited.add(url);
    
    let page;
    try {
      logger.debug('Visiting URL', { url, depth });
      
      page = await browser.newPage();
      logger.debug('New page created', { url });
      
      await page.setDefaultNavigationTimeout(120000);
      await page.setDefaultTimeout(120000);
      logger.debug('Page timeouts set', { url });
      
      // Configurar interceptação de requisições
      await page.setRequestInterception(true);
      page.on('request', (request: any) => {
        const resourceType = request.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          request.abort();
        } else {
          request.continue();
        }
      });
      logger.debug('Request interception configured', { url });
      
      // Navegar para a URL
      logger.debug('Navigating to URL', { url });
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 120000 
      });
      logger.debug('Navigation completed', { url });
      
      // Capturar screenshot
      try {
        logger.debug('Capturing screenshot', { url });
        const screenshotPath = await captureScreenshot(page, url, outputDir);
        screenshots.push(screenshotPath);
        logger.debug('Screenshot captured successfully', { url, screenshotPath });
      } catch (screenshotError) {
        logger.error('Error capturing screenshot', { 
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
          stack: screenshotError instanceof Error ? screenshotError.stack : undefined,
          url 
        });
        // Continue execution even if screenshot fails
      }
      
      // Extrair links internos para a próxima profundidade
      if (depth < maxDepth) {
        try {
          logger.debug('Extracting internal links', { url, depth });
          const internalLinks = await extractInternalLinks(page, baseUrl);
          logger.debug('Internal links extracted', { url, count: internalLinks.length });
          
          await visitUrlsRecursively(
            browser, 
            internalLinks, 
            visited, 
            depth + 1, 
            maxDepth, 
            baseUrl,
            outputDir,
            screenshots
          );
        } catch (linksError) {
          logger.error('Error extracting or processing internal links', { 
            error: linksError instanceof Error ? linksError.message : String(linksError),
            stack: linksError instanceof Error ? linksError.stack : undefined,
            url 
          });
          // Continue execution even if link extraction fails
        }
      }
      
      if (page && !page.isClosed()) {
        await page.close();
        logger.debug('Page closed', { url });
      }
    } catch (error) {
      logger.error('Error visiting URL', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url,
        depth
      });
      
      // Try to close the page if it exists and is not already closed
      if (page && !page.isClosed()) {
        try {
          await page.close();
          logger.debug('Page closed after error', { url });
        } catch (closeError) {
          logger.error('Error closing page after error', { 
            error: closeError instanceof Error ? closeError.message : String(closeError),
            url 
          });
        }
      }
    }
  }
}

export async function extractProjectsAndSkills(textContent: string, images: string[], screenshots: string[]): Promise<SkillsExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  const prompt = `
You are an expert at analyzing portfolio content and identifying projects and skills from unstructured text. Your task is to extract projects and skills from the provided portfolio content.

IMPORTANT INSTRUCTIONS:
1. Identify all projects mentioned in the text, even if they're not clearly marked with specific HTML tags.
2. For each project, extract:
   - Title: The name of the project
   - Description: A concise description of what the project is about
   - Skills: Technologies, tools, or methodologies used in the project
   - Context: Any additional context that helps understand the project better
   - Images: Connect images to specific projects based on their context and relevance
3. Identify all skills mentioned throughout the text, including:
   - Technical skills (programming languages, frameworks, tools)
   - Design skills (UI/UX, visual design, etc.)
   - Soft skills (project management, communication, etc.)
   - Domain expertise (specific industries or domains)
4. Be thorough in your extraction - don't miss projects or skills just because they're not explicitly labeled.
5. Analyze the images and screenshots to provide additional context about the projects.

TEXT CONTENT:
${textContent.slice(0, 8000)}

IMAGES:
${images.slice(0, 20).join('\n')}

SCREENSHOTS:
${screenshots.slice(0, 10).join('\n')}

Your response must follow **strictly** the JSON schema below:
{
  "projects": [
    {
      "title": "Name of the project",
      "description": "Brief description of what the project is about",
      "images": ["URLs of images related to this project"],
      "skills": ["Skills used in this project"],
      "context": "Additional context about the project (optional)",
      "screenshots": ["Paths to screenshots related to this project (optional)"]
    }
  ],
  "skills": [
    "List of all skills identified in the text"
  ]
}

DON'T include any additional text before or after the JSON.
`;

  try {
    logger.debug('Making OpenAI API call', { 
      textContentLength: textContent.length,
      imagesCount: images.length,
      screenshotsCount: screenshots.length
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    logger.debug('OpenAI API call completed');

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    logger.debug('Extracting JSON from OpenAI response', { contentLength: content.length });
    const extraction = extractJSON(content) as SkillsExtraction;
    
    // Validate the response structure
    if (!extraction.projects || !extraction.skills) {
      throw new Error('Invalid response structure from OpenAI');
    }

    logger.debug('JSON extraction successful', { 
      projectsCount: extraction.projects.length,
      skillsCount: extraction.skills.length
    });

    return extraction;
  } catch (error) {
    logger.error('Extraction error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to extract projects and skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function scrapePortfolio(url: string): Promise<{ textContent: string, images: string[], structuredContent: StructuredContent }> {
  let browser;
  const visitedUrls = new Set<string>();
  const screenshots: string[] = [];
  
  // Criar diretório para screenshots
  const outputDir = path.join(os.tmpdir(), 'tales-analyzer-screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    logger.info('Starting scraping process', { url });
    const isDev = process.env.NODE_ENV === 'development';
    const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || 
                     process.env.RAILWAY_ENVIRONMENT_NAME !== undefined ||
                     process.env.RAILWAY_SERVICE_NAME !== undefined;
    
    logger.info('Environment detection', { 
      isDev, 
      isRailway,
      nodeEnv: process.env.NODE_ENV,
      railwayEnv: process.env.RAILWAY_ENVIRONMENT,
      railwayEnvName: process.env.RAILWAY_ENVIRONMENT_NAME,
      railwayServiceName: process.env.RAILWAY_SERVICE_NAME,
      puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set'
    });
    
    const browserOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-experiments',
        '--no-pings',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      executablePath: isDev ? undefined : process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      ignoreHTTPSErrors: true,
      timeout: 90000
    };

    logger.debug('Launching browser', { 
      options: {
        ...browserOptions,
        executablePath: browserOptions.executablePath ? 'Path set' : 'Path not set'
      },
      isDev,
      isRailway,
      puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set'
    });

    try {
      if (isDev) {
        const puppeteerDev = await import('puppeteer');
        browser = await puppeteerDev.default.launch(browserOptions);
      } else {
        browser = await puppeteer.launch(browserOptions);
      }
    } catch (browserError) {
      logger.error('Failed to launch browser', { 
        error: browserError instanceof Error ? browserError.message : String(browserError),
        stack: browserError instanceof Error ? browserError.stack : undefined,
        isDev,
        puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set'
      });
      throw browserError;
    }
    
    logger.debug('Browser launched successfully');
    let page = await browser.newPage();
    
    // Set a reasonable timeout
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(120000);
    
    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      const resourceType = request.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate with retry logic
    let retries = 5;
    let lastError: Error | undefined;
    
    while (retries > 0) {
      try {
        logger.debug('Attempting to navigate', { url, retries });
        await page.goto(url, { 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 120000 
        });
        logger.debug('Navigation successful');
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries--;
        logger.warn('Navigation failed', { 
          error: lastError.message,
          stack: lastError.stack,
          retries 
        });
        if (retries === 0) {
          logger.error('All navigation attempts failed', { 
            error: lastError.message,
            stack: lastError.stack
          });
          throw lastError;
        }
        logger.debug('Waiting before retry', { retries });
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Try to recover the page if it was closed
        try {
          if (!page.isClosed()) {
            logger.debug('Page is still open');
          } else {
            logger.debug('Page was closed, creating new page');
            page = await browser.newPage();
            await page.setDefaultNavigationTimeout(120000);
            await page.setDefaultTimeout(120000);
          }
        } catch (error: unknown) {
          const pageError = error instanceof Error ? error : new Error(String(error));
          logger.error('Error checking page status', { 
            error: pageError.message,
            stack: pageError.stack
          });
          throw pageError;
        }
      }
    }

    // Capturar screenshot da página inicial
    try {
      logger.debug('Capturing initial screenshot');
      const initialScreenshotPath = await captureScreenshot(page, url, outputDir);
      screenshots.push(initialScreenshotPath);
      visitedUrls.add(url);
      logger.debug('Initial screenshot captured', { path: initialScreenshotPath });
    } catch (screenshotError) {
      logger.error('Error capturing initial screenshot', { 
        error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
        stack: screenshotError instanceof Error ? screenshotError.stack : undefined
      });
      // Continue execution even if screenshot fails
    }

    logger.debug('Starting content extraction');

    // Extract raw text content
    let textContent = '';
    try {
      textContent = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('body *')) as Element[];
        return elements
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .join('\n');
      });
      logger.debug('Text content extracted', { length: textContent.length });
    } catch (textError) {
      logger.error('Error extracting text content', { 
        error: textError instanceof Error ? textError.message : String(textError),
        stack: textError instanceof Error ? textError.stack : undefined
      });
      // Continue with empty text content
    }

    // Extract images with more context
    let images: any[] = [];
    try {
      images = await page.evaluate(() => {
        return Array.from(document.images)
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height,
            context: img.closest('section, article, div')?.textContent?.trim() || ''
          }))
          .filter(img => img.src && img.src.startsWith('http'));
      });
      logger.debug('Images extracted', { count: images.length });
    } catch (imagesError) {
      logger.error('Error extracting images', { 
        error: imagesError instanceof Error ? imagesError.message : String(imagesError),
        stack: imagesError instanceof Error ? imagesError.stack : undefined
      });
      // Continue with empty images array
    }

    // Extract structured content
    let structuredContent: StructuredContent;
    try {
      structuredContent = await page.evaluate(() => {
        // Try to identify main sections
        const sections = Array.from(document.querySelectorAll('section, article, .section, .project, .case-study, .portfolio-item')) as Element[];
        
        return {
          title: document.title,
          metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          sections: sections.map(section => ({
            title: section.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '',
            content: section.textContent?.trim() || '',
            type: section.className || section.tagName.toLowerCase()
          }))
        };
      }) as StructuredContent;
      logger.debug('Structured content extracted', { 
        title: structuredContent.title,
        sectionsCount: structuredContent.sections.length
      });
    } catch (structuredError) {
      logger.error('Error extracting structured content', { 
        error: structuredError instanceof Error ? structuredError.message : String(structuredError),
        stack: structuredError instanceof Error ? structuredError.stack : undefined
      });
      // Create a minimal structured content object
      structuredContent = {
        title: '',
        metaDescription: '',
        sections: [],
        projects: [],
        skills: [],
        screenshots: [],
        visitedUrls: []
      };
    }

    // Extrair links internos para navegação recursiva
    let internalLinks: string[] = [];
    try {
      logger.debug('Extracting internal links');
      internalLinks = await extractInternalLinks(page, url);
      logger.debug('Internal links extracted', { count: internalLinks.length });
    } catch (linksError) {
      logger.error('Error extracting internal links', { 
        error: linksError instanceof Error ? linksError.message : String(linksError),
        stack: linksError instanceof Error ? linksError.stack : undefined
      });
      // Continue with empty links array
    }
    
    // Navegar recursivamente pelos links internos
    try {
      logger.debug('Starting recursive navigation');
      await visitUrlsRecursively(
        browser, 
        internalLinks, 
        visitedUrls, 
        1, // Profundidade inicial
        2, // Profundidade máxima
        url,
        outputDir,
        screenshots
      );
      logger.debug('Recursive navigation completed', { 
        visitedUrls: visitedUrls.size, 
        screenshots: screenshots.length 
      });
    } catch (recursiveError) {
      logger.error('Error during recursive navigation', { 
        error: recursiveError instanceof Error ? recursiveError.message : String(recursiveError),
        stack: recursiveError instanceof Error ? recursiveError.stack : undefined
      });
      // Continue execution even if recursive navigation fails
    }

    // Use LLM to extract projects and skills intelligently
    let projects: Project[] = [];
    let skills: string[] = [];
    try {
      logger.debug('Starting intelligent extraction');
      const extraction = await extractProjectsAndSkills(textContent, images.map(img => img.src), screenshots);
      projects = extraction.projects;
      skills = extraction.skills;
      logger.debug('Intelligent extraction completed', { 
        projectsCount: projects.length, 
        skillsCount: skills.length 
      });
    } catch (extractionError) {
      logger.error('Error during intelligent extraction', { 
        error: extractionError instanceof Error ? extractionError.message : String(extractionError),
        stack: extractionError instanceof Error ? extractionError.stack : undefined
      });
      // Continue with empty projects and skills arrays
    }

    // Add the extracted projects and skills to the structured content
    structuredContent.projects = projects;
    structuredContent.skills = skills;
    structuredContent.screenshots = screenshots;
    structuredContent.visitedUrls = Array.from(visitedUrls);

    logger.info('Scraping completed', { 
      url,
      projectsCount: projects.length,
      skillsCount: skills.length,
      screenshotsCount: screenshots.length
    });
    
    return { 
      textContent, 
      images: images.map((img: any) => img.src),
      structuredContent 
    };
  } catch (error: unknown) {
    logger.error('Scraping error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to scrape portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      try {
        logger.debug('Closing browser');
        await browser.close();
        logger.debug('Browser closed successfully');
      } catch (error) {
        logger.error('Error closing browser', { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }
}