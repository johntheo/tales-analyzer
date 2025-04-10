import puppeteer from 'puppeteer-core';
import { logger } from './utils/logger.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

async function testPuppeteer() {
  logger.info('Starting Puppeteer test');
  
  // Log environment information
  logger.info('Environment information', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
    tmpdir: os.tmpdir(),
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set'
  });
  
  // Check if the executable path exists
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
  const executableExists = fs.existsSync(executablePath);
  
  logger.info('Executable path check', {
    executablePath,
    exists: executableExists
  });
  
  // If the executable doesn't exist, try to find it
  if (!executableExists) {
    logger.info('Executable not found at specified path, trying to find it');
    
    // Common paths for Chromium
    const commonPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chrome',
      '/usr/bin/chrome-stable'
    ];
    
    for (const path of commonPaths) {
      const exists = fs.existsSync(path);
      logger.info('Checking common path', { path, exists });
      if (exists) {
        logger.info('Found Chromium at', { path });
        break;
      }
    }
  }
  
  // Try to launch the browser
  try {
    logger.info('Attempting to launch browser');
    
    const browserOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true
    };
    
    const browser = await puppeteer.launch(browserOptions);
    logger.info('Browser launched successfully');
    
    // Try to create a new page
    const page = await browser.newPage();
    logger.info('New page created successfully');
    
    // Try to navigate to a simple URL
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    logger.info('Navigation successful');
    
    // Get the page title
    const title = await page.title();
    logger.info('Page title', { title });
    
    // Close the browser
    await browser.close();
    logger.info('Browser closed successfully');
    
    logger.info('Puppeteer test completed successfully');
  } catch (error) {
    logger.error('Puppeteer test failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the test
testPuppeteer().catch(error => {
  logger.error('Unhandled error in Puppeteer test', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
}); 