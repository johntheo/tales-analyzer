import puppeteer from 'puppeteer-core';

export async function scrapePortfolio(url: string): Promise<{ textContent: string, images: string[], structuredContent: any }> {
  let browser;
  try {
    console.log('Starting browser initialization...');
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

    console.log('Starting content extraction...');

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