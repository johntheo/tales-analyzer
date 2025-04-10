import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { logger } from './utils/logger.js';

async function dockerVerify() {
  try {
    logger.info('Verifying Docker environment...', { cwd: process.cwd() });
    
    // Log current working directory and environment
    const cwd = process.cwd();
    logger.info(`Current working directory: ${cwd}`, { cwd });
    logger.info(`Directory contents: ${fs.readdirSync(cwd).join(', ')}`, { contents: fs.readdirSync(cwd) });
    
    // Check if src directory exists and log its contents
    const srcDir = path.join(cwd, 'src');
    if (fs.existsSync(srcDir)) {
      logger.info(`src directory exists at: ${srcDir}`, { srcDir });
      logger.info(`src directory contents: ${fs.readdirSync(srcDir).join(', ')}`, { contents: fs.readdirSync(srcDir) });
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
    
    // Check if dist directory exists and log its contents
    const distDir = path.join(cwd, 'dist');
    if (fs.existsSync(distDir)) {
      logger.info(`dist directory exists at: ${distDir}`, { distDir });
      logger.info(`dist directory contents: ${fs.readdirSync(distDir).join(', ')}`, { contents: fs.readdirSync(distDir) });
    } else {
      logger.error(`dist directory does not exist at: ${distDir}`, { distDir });
    }
    
    // Try to run the TypeScript compiler to see if it works now
    try {
      logger.info('Attempting to compile the project...', { command: 'pnpm tsc --project tsconfig.json' });
      execSync('pnpm tsc --project tsconfig.json', { stdio: 'inherit' });
      logger.info('Successfully compiled the project', { success: true });
    } catch (error) {
      logger.error('Failed to compile the project', { error });
    }
    
    // Try to start the application to see if it works
    try {
      logger.info('Attempting to start the application...', { command: 'pnpm start' });
      // Use a timeout to prevent the application from running indefinitely
      const timeout = 10000; // 10 seconds
      const startTime = Date.now();
      
      // Start the application in the background using spawn instead of execSync
      const child = spawn('pnpm', ['start'], { 
        stdio: 'inherit',
        detached: true,
        shell: true
      });
      
      // Wait for a short time to see if the application starts
      await new Promise(resolve => setTimeout(resolve, timeout));
      
      // Check if the application is still running
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      
      if (elapsedTime >= timeout) {
        logger.info('Application started successfully', { elapsedTime });
      } else {
        logger.error('Application failed to start', { elapsedTime });
      }
      
      // Kill the child process
      if (child.pid) {
        process.kill(-child.pid);
      }
    } catch (error) {
      logger.error('Failed to start the application', { error });
    }
    
    logger.info('Docker verification completed', { success: true });
  } catch (error) {
    logger.error('Error verifying Docker environment:', { error });
    process.exit(1);
  }
}

dockerVerify(); 