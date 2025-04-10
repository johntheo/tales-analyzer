import puppeteer from 'puppeteer-core';
import OpenAI from 'openai';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

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
  
  await page.screenshot({ 
    path: filepath, 
    fullPage: true 
  });
  
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

// Função para extrair links internos
async function extractInternalLinks(page: any, baseUrl: string): Promise<string[]> {
  return await page.evaluate((baseUrl: string) => {
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
      }
    }
    
    return Array.from(internalLinks);
  }, baseUrl);
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
    
    try {
      console.log(`Visiting ${url} (depth ${depth})`);
      
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(120000);
      await page.setDefaultTimeout(120000);
      
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
      
      // Navegar para a URL
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 120000 
      });
      
      // Capturar screenshot
      const screenshotPath = await captureScreenshot(page, url, outputDir);
      screenshots.push(screenshotPath);
      
      // Extrair links internos para a próxima profundidade
      if (depth < maxDepth) {
        const internalLinks = await extractInternalLinks(page, baseUrl);
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
      }
      
      await page.close();
    } catch (error) {
      console.error(`Error visiting ${url}:`, error);
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
    console.log('Making OpenAI API call');
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    console.log('OpenAI API call completed');

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const extraction = extractJSON(content) as SkillsExtraction;
    
    // Validate the response structure
    if (!extraction.projects || !extraction.skills) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return extraction;
  } catch (error) {
    console.error('Extraction error:', error);
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
    console.log('Starting scraping process');
    console.log('Starting browser initialization...');
    const isDev = process.env.NODE_ENV === 'development';
    
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
        '--window-size=1920,1080'
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

    console.log('Launching browser with options:', JSON.stringify(browserOptions, null, 2));

    if (isDev) {
      const puppeteerDev = await import('puppeteer');
      browser = await puppeteerDev.default.launch(browserOptions);
    } else {
      browser = await puppeteer.launch(browserOptions);
    }
    
    console.log('Browser launched successfully');
    let page = await browser.newPage();
    console.log('New page created');
    
    // Set a reasonable timeout
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(120000);
    console.log('Timeouts set');
    
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
        console.log(`Attempting to navigate to ${url} (${retries} attempts left)`);
        await page.goto(url, { 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 120000 
        });
        console.log('Navigation successful');
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries--;
        console.log(`Navigation failed: ${lastError.message}`);
        if (retries === 0) {
          console.log('All navigation attempts failed');
          throw lastError;
        }
        console.log(`Waiting 10 seconds before retry... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Try to recover the page if it was closed
        try {
          if (!page.isClosed()) {
            console.log('Page is still open, continuing...');
          } else {
            console.log('Page was closed, creating new page...');
            page = await browser.newPage();
            await page.setDefaultNavigationTimeout(120000);
            await page.setDefaultTimeout(120000);
          }
        } catch (error: unknown) {
          const pageError = error instanceof Error ? error : new Error(String(error));
          console.log('Error checking page status:', pageError.message);
          throw pageError;
        }
      }
    }

    // Capturar screenshot da página inicial
    const initialScreenshotPath = await captureScreenshot(page, url, outputDir);
    screenshots.push(initialScreenshotPath);
    visitedUrls.add(url);

    console.log('Starting content extraction...');

    // Extract raw text content
    const textContent = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('body *')) as Element[];
      return elements
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join('\n');
    });

    console.log('Text content extracted');

    // Extract images with more context
    const images = await page.evaluate(() => {
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

    console.log('Images extracted');

    // Extract structured content
    const structuredContent = await page.evaluate(() => {
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

    // Extrair links internos para navegação recursiva
    console.log('Extracting internal links for recursive navigation...');
    const internalLinks = await extractInternalLinks(page, url);
    console.log(`Found ${internalLinks.length} internal links`);
    
    // Navegar recursivamente pelos links internos
    console.log('Starting recursive navigation of internal links...');
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
    console.log(`Recursive navigation completed. Visited ${visitedUrls.size} URLs and captured ${screenshots.length} screenshots`);

    // Use LLM to extract projects and skills intelligently
    console.log('Starting intelligent extraction of projects and skills...');
    const { projects, skills } = await extractProjectsAndSkills(textContent, images.map(img => img.src), screenshots);
    console.log('Intelligent extraction completed', { projectsCount: projects.length, skillsCount: skills.length });

    // Add the extracted projects and skills to the structured content
    structuredContent.projects = projects;
    structuredContent.skills = skills;
    structuredContent.screenshots = screenshots;
    structuredContent.visitedUrls = Array.from(visitedUrls);

    console.log('Structured content extracted', structuredContent);
    console.log('Images', images);
    console.log('Scraping completed');
    
    return { 
      textContent, 
      images: images.map((img: any) => img.src),
      structuredContent 
    };
  } catch (error: unknown) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      try {
        console.log('Closing browser...');
        await browser.close();
        console.log('Browser closed successfully');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}