import { execSync } from 'child_process';
import { logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';

function verifyBuildProcess() {
  try {
    logger.info('Verifying build process...');
    
    // Check if dist directory exists
    const distDir = path.join(process.cwd(), 'dist');
    const distExists = fs.existsSync(distDir);
    logger.info(`Dist directory exists: ${distExists}`, { distDir });
    
    if (distExists) {
      // Clean up dist directory
      logger.info('Cleaning up dist directory...');
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    
    // Try to build the application
    logger.info('Building the application...');
    execSync('pnpm run build');
    
    // Check if dist directory was created
    const distExistsAfterBuild = fs.existsSync(distDir);
    logger.info(`Dist directory exists after build: ${distExistsAfterBuild}`, { distDir });
    
    if (!distExistsAfterBuild) {
      logger.error('Dist directory was not created after build', { distDir });
      return;
    }
    
    // List all files in dist directory
    const files = fs.readdirSync(distDir);
    logger.info(`Found ${files.length} files in dist directory`, { files });
    
    // Check if key directories exist
    const keyDirs = ['api', 'scraper', 'utils', 'llm', 'config'];
    for (const dir of keyDirs) {
      const dirPath = path.join(distDir, dir);
      const dirExists = fs.existsSync(dirPath);
      logger.info(`Directory ${dir} exists in dist: ${dirExists}`, { dirPath });
      
      if (dirExists) {
        const dirFiles = fs.readdirSync(dirPath);
        logger.info(`Found ${dirFiles.length} files in ${dir} directory in dist`, { dirFiles });
      }
    }
    
    // Check if the main entry point exists
    const mainEntryPoint = path.join(distDir, 'api', 'portfolio-review', 'index.js');
    const mainEntryPointExists = fs.existsSync(mainEntryPoint);
    logger.info(`Main entry point exists: ${mainEntryPointExists}`, { mainEntryPoint });
    
    if (mainEntryPointExists) {
      const mainEntryPointContent = fs.readFileSync(mainEntryPoint, 'utf8');
      logger.info('Main entry point content (first 100 characters):', { 
        content: mainEntryPointContent.substring(0, 100) + '...' 
      });
    }
    
    logger.info('Build process verification completed');
  } catch (error) {
    logger.error('Error verifying build process', error);
  }
}

// Run the verification
verifyBuildProcess(); 