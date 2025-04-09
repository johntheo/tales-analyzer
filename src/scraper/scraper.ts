import puppeteer from 'puppeteer-core';

export async function scrapePortfolio(url: string): Promise<{ textContent: string, images: string[], structuredContent: any }> {
  let browser;
  try {
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

    console.log('Structured content extracted', structuredContent);

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