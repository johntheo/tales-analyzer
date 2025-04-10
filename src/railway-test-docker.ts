import { logger } from './utils/logger.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

async function testDockerFileSystem() {
  try {
    // Log environment information
    logger.info('Testing Docker file system access...');
    logger.info(`Node version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Architecture: ${process.arch}`);
    logger.info(`Temporary directory: ${os.tmpdir()}`);
    logger.info(`Current working directory: ${process.cwd()}`);
    
    // Log Docker environment variables
    logger.info('Docker environment variables:');
    logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    
    // Test temporary directory access
    const tempDir = os.tmpdir();
    logger.info(`Testing temporary directory: ${tempDir}`);
    
    // Check if temp directory exists
    const tempDirExists = fs.existsSync(tempDir);
    logger.info(`Temporary directory exists: ${tempDirExists}`);
    
    if (!tempDirExists) {
      logger.error(`Temporary directory does not exist: ${tempDir}`, { tempDir });
      throw new Error(`Temporary directory does not exist: ${tempDir}`);
    }
    
    // Check if temp directory is writable
    try {
      const testFilePath = path.join(tempDir, 'docker-test.txt');
      logger.info(`Writing test file: ${testFilePath}`);
      fs.writeFileSync(testFilePath, 'This is a test file for Docker file system access.');
      
      // Verify file exists
      const fileExists = fs.existsSync(testFilePath);
      logger.info(`Test file exists: ${fileExists}`);
      
      if (!fileExists) {
        logger.error(`Failed to create test file: ${testFilePath}`, { testFilePath });
        throw new Error(`Failed to create test file: ${testFilePath}`);
      }
      
      // Read file content
      const fileContent = fs.readFileSync(testFilePath, 'utf8');
      logger.info(`File content: ${fileContent}`);
      
      // Delete test file
      fs.unlinkSync(testFilePath);
      logger.info('Test file deleted successfully');
    } catch (error) {
      logger.error('Error testing temporary directory write access', error);
      throw new Error(`Temporary directory is not writable: ${tempDir}`);
    }
    
    // Test screenshots directory
    try {
      const screenshotsDir = path.join(tempDir, 'tales-analyzer-screenshots');
      logger.info(`Testing screenshots directory: ${screenshotsDir}`);
      
      // Check if directory exists
      const dirExists = fs.existsSync(screenshotsDir);
      logger.info(`Screenshots directory exists: ${dirExists}`);
      
      if (!dirExists) {
        logger.info(`Screenshots directory does not exist, creating it`);
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      
      // Try to write a test screenshot
      const testScreenshotPath = path.join(screenshotsDir, 'test.png');
      logger.info(`Writing test screenshot: ${testScreenshotPath}`);
      fs.writeFileSync(testScreenshotPath, Buffer.from('PNG test data'));
      
      // Verify screenshot exists
      const screenshotExists = fs.existsSync(testScreenshotPath);
      logger.info(`Test screenshot exists: ${screenshotExists}`);
      
      if (!screenshotExists) {
        logger.error(`Failed to create test screenshot: ${testScreenshotPath}`, { testScreenshotPath });
        throw new Error(`Failed to create test screenshot: ${testScreenshotPath}`);
      }
      
      // Delete test screenshot
      fs.unlinkSync(testScreenshotPath);
      logger.info('Test screenshot deleted successfully');
      
      logger.info('Docker file system test completed successfully');
    } catch (error) {
      logger.error('Error testing screenshots directory', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error during Docker file system test', error);
    throw error;
  }
}

// Run the test
testDockerFileSystem().catch(error => {
  logger.error('Docker file system test failed', error);
  process.exit(1);
}); 