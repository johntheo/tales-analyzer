import { logger } from './utils/logger.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function runRailwayTest() {
  logger.info('Starting Railway test');
  
  // Log environment information
  logger.info('Environment information', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
    tmpdir: os.tmpdir(),
    railwayEnv: process.env.RAILWAY_ENVIRONMENT,
    railwayEnvName: process.env.RAILWAY_ENVIRONMENT_NAME,
    railwayServiceName: process.env.RAILWAY_SERVICE_NAME
  });
  
  // Check file system
  try {
    logger.info('Testing file system access');
    
    // Check if we can write to the temp directory
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, 'railway-test.txt');
    
    fs.writeFileSync(testFile, 'test');
    logger.info('Successfully wrote to temp directory', { tmpDir });
    
    fs.unlinkSync(testFile);
    logger.info('Successfully deleted test file');
    
    // Create a directory for screenshots
    const screenshotsDir = path.join(tmpDir, 'tales-analyzer-screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
      logger.info('Created screenshots directory', { screenshotsDir });
    } else {
      logger.info('Screenshots directory already exists', { screenshotsDir });
    }
    
    // Check if we can write to the screenshots directory
    const screenshotTestFile = path.join(screenshotsDir, 'test.png');
    fs.writeFileSync(screenshotTestFile, 'test');
    logger.info('Successfully wrote to screenshots directory');
    
    fs.unlinkSync(screenshotTestFile);
    logger.info('Successfully deleted test screenshot file');
    
    // Clean up the screenshots directory
    fs.rmdirSync(screenshotsDir);
    logger.info('Successfully removed screenshots directory');
  } catch (error) {
    logger.error('File system test failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
  
  // Check for Chromium
  try {
    logger.info('Checking for Chromium');
    
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
    
    // Try to run which chromium
    try {
      const whichOutput = execSync('which chromium').toString();
      logger.info('which chromium output', { output: whichOutput });
    } catch (error) {
      logger.info('which chromium failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    logger.error('Chromium check failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
  
  // Check memory usage
  try {
    logger.info('Memory usage', { 
      memory: process.memoryUsage(),
      loadAverage: os.loadavg()
    });
  } catch (error) {
    logger.error('Memory check failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
  
  logger.info('Railway test completed');
}

// Run the test
runRailwayTest().catch(error => {
  logger.error('Unhandled error in Railway test', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
}); 