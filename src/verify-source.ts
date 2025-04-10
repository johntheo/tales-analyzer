import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';

function verifySourceFiles() {
  try {
    logger.info('Verifying source files...');
    
    // Check if src directory exists
    const srcDir = path.join(process.cwd(), 'src');
    const srcExists = fs.existsSync(srcDir);
    logger.info(`Source directory exists: ${srcExists}`, { srcDir });
    
    if (!srcExists) {
      logger.error('Source directory does not exist', { srcDir });
      return;
    }
    
    // List all files in src directory
    const files = fs.readdirSync(srcDir);
    logger.info(`Found ${files.length} files in src directory`, { files });
    
    // Check if key directories exist
    const keyDirs = ['api', 'scraper', 'utils', 'llm', 'config'];
    for (const dir of keyDirs) {
      const dirPath = path.join(srcDir, dir);
      const dirExists = fs.existsSync(dirPath);
      logger.info(`Directory ${dir} exists: ${dirExists}`, { dirPath });
      
      if (dirExists) {
        const dirFiles = fs.readdirSync(dirPath);
        logger.info(`Found ${dirFiles.length} files in ${dir} directory`, { dirFiles });
      }
    }
    
    // Check if tsconfig.json exists
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsconfigExists = fs.existsSync(tsconfigPath);
    logger.info(`tsconfig.json exists: ${tsconfigExists}`, { tsconfigPath });
    
    if (tsconfigExists) {
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
      logger.info('tsconfig.json content:', { content: tsconfigContent });
    }
    
    logger.info('Source file verification completed');
  } catch (error) {
    logger.error('Error verifying source files', error);
  }
}

// Run the verification
verifySourceFiles(); 