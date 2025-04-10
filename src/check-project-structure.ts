import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from './utils/logger.js';

async function checkProjectStructure() {
  try {
    logger.info('Checking project structure...', { cwd: process.cwd() });
    
    // Log current working directory and environment
    const cwd = process.cwd();
    logger.info(`Current working directory: ${cwd}`, { cwd });
    logger.info(`Directory contents: ${fs.readdirSync(cwd).join(', ')}`, { contents: fs.readdirSync(cwd) });
    
    // Check if src directory exists and log its contents
    const srcDir = path.join(cwd, 'src');
    if (fs.existsSync(srcDir)) {
      logger.info(`src directory exists at: ${srcDir}`, { srcDir });
      logger.info(`src directory contents: ${fs.readdirSync(srcDir).join(', ')}`, { contents: fs.readdirSync(srcDir) });
      
      // Check if api directory exists
      const apiDir = path.join(srcDir, 'api');
      if (fs.existsSync(apiDir)) {
        logger.info(`api directory exists at: ${apiDir}`, { apiDir });
        logger.info(`api directory contents: ${fs.readdirSync(apiDir).join(', ')}`, { contents: fs.readdirSync(apiDir) });
        
        // Check if portfolio-review directory exists
        const portfolioReviewDir = path.join(apiDir, 'portfolio-review');
        if (fs.existsSync(portfolioReviewDir)) {
          logger.info(`portfolio-review directory exists at: ${portfolioReviewDir}`, { portfolioReviewDir });
          logger.info(`portfolio-review directory contents: ${fs.readdirSync(portfolioReviewDir).join(', ')}`, { contents: fs.readdirSync(portfolioReviewDir) });
          
          // Check if index.ts exists
          const indexFile = path.join(portfolioReviewDir, 'index.ts');
          if (fs.existsSync(indexFile)) {
            logger.info(`index.ts exists at: ${indexFile}`, { indexFile });
          } else {
            logger.error(`index.ts does not exist at: ${indexFile}`, { indexFile });
          }
        } else {
          logger.error(`portfolio-review directory does not exist at: ${portfolioReviewDir}`, { portfolioReviewDir });
        }
      } else {
        logger.error(`api directory does not exist at: ${apiDir}`, { apiDir });
      }
    } else {
      logger.error(`src directory does not exist at: ${srcDir}`, { srcDir });
    }
    
    // Check if tsconfig.json exists and log its contents
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      logger.info(`tsconfig.json exists at: ${tsconfigPath}`, { tsconfigPath });
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
      logger.info(`tsconfig.json content: ${tsconfigContent}`, { content: tsconfigContent });
    } else {
      logger.error(`tsconfig.json does not exist at: ${tsconfigPath}`, { tsconfigPath });
    }
    
    // Check if package.json exists and log its contents
    const packagePath = path.join(cwd, 'package.json');
    if (fs.existsSync(packagePath)) {
      logger.info(`package.json exists at: ${packagePath}`, { packagePath });
      const packageContent = fs.readFileSync(packagePath, 'utf8');
      logger.info(`package.json content: ${packageContent}`, { content: packageContent });
    } else {
      logger.error(`package.json does not exist at: ${packagePath}`, { packagePath });
    }
    
    // Try to run the TypeScript compiler to see if it works now
    try {
      logger.info('Attempting to compile the project...', { command: 'pnpm tsc --project tsconfig.json' });
      execSync('pnpm tsc --project tsconfig.json', { stdio: 'inherit' });
      logger.info('Successfully compiled the project', { success: true });
      
      // Check if dist directory exists and log its contents
      const distDir = path.join(cwd, 'dist');
      if (fs.existsSync(distDir)) {
        logger.info(`dist directory exists at: ${distDir}`, { distDir });
        logger.info(`dist directory contents: ${fs.readdirSync(distDir).join(', ')}`, { contents: fs.readdirSync(distDir) });
        
        // Check if api directory exists in dist
        const distApiDir = path.join(distDir, 'api');
        if (fs.existsSync(distApiDir)) {
          logger.info(`dist/api directory exists at: ${distApiDir}`, { distApiDir });
          logger.info(`dist/api directory contents: ${fs.readdirSync(distApiDir).join(', ')}`, { contents: fs.readdirSync(distApiDir) });
          
          // Check if portfolio-review directory exists in dist
          const distPortfolioReviewDir = path.join(distApiDir, 'portfolio-review');
          if (fs.existsSync(distPortfolioReviewDir)) {
            logger.info(`dist/api/portfolio-review directory exists at: ${distPortfolioReviewDir}`, { distPortfolioReviewDir });
            logger.info(`dist/api/portfolio-review directory contents: ${fs.readdirSync(distPortfolioReviewDir).join(', ')}`, { contents: fs.readdirSync(distPortfolioReviewDir) });
            
            // Check if index.js exists
            const distIndexFile = path.join(distPortfolioReviewDir, 'index.js');
            if (fs.existsSync(distIndexFile)) {
              logger.info(`dist/api/portfolio-review/index.js exists at: ${distIndexFile}`, { distIndexFile });
            } else {
              logger.error(`dist/api/portfolio-review/index.js does not exist at: ${distIndexFile}`, { distIndexFile });
            }
          } else {
            logger.error(`dist/api/portfolio-review directory does not exist at: ${distPortfolioReviewDir}`, { distPortfolioReviewDir });
          }
        } else {
          logger.error(`dist/api directory does not exist at: ${distApiDir}`, { distApiDir });
        }
      } else {
        logger.error(`dist directory does not exist at: ${distDir}`, { distDir });
      }
    } catch (error) {
      logger.error('Failed to compile the project', { error });
    }
    
    logger.info('Project structure check completed', { success: true });
  } catch (error) {
    logger.error('Error checking project structure:', { error });
    process.exit(1);
  }
}

checkProjectStructure(); 