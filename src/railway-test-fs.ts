import { logger } from './utils/logger.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

async function testFileSystem() {
  try {
    // Log environment information
    logger.info('Testing file system access...');
    logger.info(`Node version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`Architecture: ${process.arch}`);
    logger.info(`Temporary directory: ${os.tmpdir()}`);
    logger.info(`Current working directory: ${process.cwd()}`);
    
    // Log Railway environment variables
    logger.info('Railway environment variables:');
    logger.info(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
    logger.info(`RAILWAY_ENVIRONMENT_NAME: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
    logger.info(`RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME}`);
    logger.info(`RAILWAY_SERVICE_ID: ${process.env.RAILWAY_SERVICE_ID}`);
    
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
      const testFilePath = path.join(tempDir, 'railway-test.txt');
      logger.info(`Writing test file: ${testFilePath}`);
      fs.writeFileSync(testFilePath, 'This is a test file for Railway file system access.');
      
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
    
    // Test screenshots directory with error handling
    try {
      const screenshotsDir = path.join(tempDir, 'tales-analyzer-screenshots');
      logger.info(`Creating screenshots directory: ${screenshotsDir}`);
      
      // Check if directory already exists
      if (fs.existsSync(screenshotsDir)) {
        logger.info(`Screenshots directory already exists, removing it first`);
        fs.rmSync(screenshotsDir, { recursive: true, force: true });
      }
      
      // Create directory
      fs.mkdirSync(screenshotsDir, { recursive: true });
      
      // Verify directory exists
      const dirExists = fs.existsSync(screenshotsDir);
      logger.info(`Screenshots directory exists: ${dirExists}`);
      
      if (!dirExists) {
        logger.error(`Failed to create screenshots directory: ${screenshotsDir}`, { screenshotsDir });
        throw new Error(`Failed to create screenshots directory: ${screenshotsDir}`);
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
      
      // Clean up screenshots directory
      fs.rmdirSync(screenshotsDir);
      logger.info('Screenshots directory deleted successfully');
    } catch (error) {
      logger.error('Error testing screenshots directory', error);
      
      // Provide alternative approach for Railway
      logger.info('Attempting alternative approach for screenshots storage');
      
      // Try using a different directory structure
      try {
        const altScreenshotsDir = path.join(tempDir, 'screenshots');
        logger.info(`Creating alternative screenshots directory: ${altScreenshotsDir}`);
        
        if (fs.existsSync(altScreenshotsDir)) {
          fs.rmSync(altScreenshotsDir, { recursive: true, force: true });
        }
        
        fs.mkdirSync(altScreenshotsDir, { recursive: true });
        
        const altTestScreenshotPath = path.join(altScreenshotsDir, 'test.png');
        fs.writeFileSync(altTestScreenshotPath, Buffer.from('PNG test data'));
        
        logger.info(`Alternative screenshot created successfully: ${altTestScreenshotPath}`);
        
        // Clean up
        fs.unlinkSync(altTestScreenshotPath);
        fs.rmdirSync(altScreenshotsDir);
        logger.info('Alternative screenshots directory deleted successfully');
      } catch (altError) {
        logger.error('Alternative approach also failed', altError);
        throw new Error('Both primary and alternative screenshot storage approaches failed');
      }
    }
    
    logger.info('File system test completed successfully');
  } catch (error) {
    logger.error('Error during file system test', error);
    throw error;
  }
}

// Run the test
testFileSystem().catch(error => {
  logger.error('File system test failed', error);
  process.exit(1);
}); 