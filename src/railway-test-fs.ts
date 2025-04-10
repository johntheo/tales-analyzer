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
    
    // Try to write a test file
    const testFilePath = path.join(tempDir, 'railway-test.txt');
    logger.info(`Writing test file: ${testFilePath}`);
    fs.writeFileSync(testFilePath, 'This is a test file for Railway file system access.');
    
    // Verify file exists
    const fileExists = fs.existsSync(testFilePath);
    logger.info(`Test file exists: ${fileExists}`);
    
    // Read file content
    const fileContent = fs.readFileSync(testFilePath, 'utf8');
    logger.info(`File content: ${fileContent}`);
    
    // Delete test file
    fs.unlinkSync(testFilePath);
    logger.info('Test file deleted successfully');
    
    // Test screenshots directory
    const screenshotsDir = path.join(tempDir, 'tales-analyzer-screenshots');
    logger.info(`Creating screenshots directory: ${screenshotsDir}`);
    fs.mkdirSync(screenshotsDir, { recursive: true });
    
    // Verify directory exists
    const dirExists = fs.existsSync(screenshotsDir);
    logger.info(`Screenshots directory exists: ${dirExists}`);
    
    // Try to write a test screenshot
    const testScreenshotPath = path.join(screenshotsDir, 'test.png');
    logger.info(`Writing test screenshot: ${testScreenshotPath}`);
    fs.writeFileSync(testScreenshotPath, Buffer.from('PNG test data'));
    
    // Verify screenshot exists
    const screenshotExists = fs.existsSync(testScreenshotPath);
    logger.info(`Test screenshot exists: ${screenshotExists}`);
    
    // Delete test screenshot
    fs.unlinkSync(testScreenshotPath);
    logger.info('Test screenshot deleted successfully');
    
    // Clean up screenshots directory
    fs.rmdirSync(screenshotsDir);
    logger.info('Screenshots directory deleted successfully');
    
    logger.info('File system test completed successfully');
  } catch (error) {
    logger.error('Error during file system test:', error);
    throw error;
  }
}

// Run the test
testFileSystem().catch(error => {
  logger.error('File system test failed:', error);
  process.exit(1);
}); 