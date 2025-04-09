import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';

export async function scrapePortfolio(url: string): Promise<{ textContent: string, images: string[], structuredContent: any }> {
  let browser;
  try {
    // Configuração para usar chrome-aws-lambda em produção e puppeteer normal em desenvolvimento
    const isDev = process.env.NODE_ENV === 'development';
    
    const browserOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: isDev ? undefined : await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      timeout: 30000
    };

    if (isDev) {
      const puppeteerDev = await import('puppeteer');
      browser = await puppeteerDev.default.launch(browserOptions);
    } else {
      browser = await puppeteer.launch(browserOptions);
    }
    
    const page = await browser.newPage();
    
    // Set a reasonable timeout
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    
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
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Navigation failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      }
    }

    // Extract raw text content
    const textContent = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('body *'));
      return elements
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join('\n');
    });

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

    // Extract structured content
    const structuredContent = await page.evaluate(() => {
      // Try to identify main sections
      const sections = Array.from(document.querySelectorAll('section, article, .section, .project, .case-study, .portfolio-item'));
      
      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        sections: sections.map(section => ({
          title: section.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '',
          content: section.textContent?.trim() || '',
          type: section.className || section.tagName.toLowerCase()
        })),
        projects: Array.from(document.querySelectorAll('.project, .case-study, .portfolio-item')).map(project => ({
          title: project.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '',
          description: project.querySelector('p')?.textContent?.trim() || '',
          images: Array.from(project.querySelectorAll('img')).map(img => img.src).filter(src => src && src.startsWith('http')),
          skills: Array.from(project.querySelectorAll('.skills, .tags, .technologies')).map(el => el.textContent?.trim()).filter(Boolean)
        })),
        skills: Array.from(document.querySelectorAll('.skills, .tags, .technologies, .expertise')).map(el => el.textContent?.trim()).filter(Boolean),
        contact: Array.from(document.querySelectorAll('.contact, .social, .links')).map(el => el.textContent?.trim()).filter(Boolean)
      };
    });

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
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}