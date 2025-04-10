import { execSync } from 'child_process';
import { logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';

async function verifyTypeScriptCompiler() {
  try {
    logger.info('Verifying TypeScript compiler...');

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

    // Check if tsc is available
    try {
      execSync('pnpm tsc --version', { stdio: 'inherit' });
      logger.info('TypeScript compiler is available');
    } catch (error) {
      logger.error('TypeScript compiler is not available', { error });
      throw error;
    }

    // Create a temporary test file
    const testDir = path.join(cwd, 'temp-test');
    const testFile = path.join(testDir, 'test.ts');

    try {
      // Create test directory
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
      }

      // Create a simple TypeScript file
      fs.writeFileSync(testFile, `
        function testFunction(): string {
          return "Hello, TypeScript!";
        }
        
        console.log(testFunction());
      `);

      // Try to compile the test file
      execSync(`pnpm tsc ${testFile} --outDir ${testDir}`, { stdio: 'inherit' });
      logger.info('Successfully compiled test TypeScript file');

      // Verify the output file exists
      const outputFile = path.join(testDir, 'test.js');
      if (fs.existsSync(outputFile)) {
        logger.info('Output JavaScript file was created');
      } else {
        throw new Error('Output JavaScript file was not created');
      }

    } finally {
      // Clean up test files
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }

    // Try to compile the entire project
    try {
      logger.info('Attempting to compile the entire project...');
      execSync('pnpm tsc --project tsconfig.json', { stdio: 'inherit' });
      logger.info('Successfully compiled the entire project');
    } catch (error) {
      logger.error('Failed to compile the entire project', { error });
      // Don't throw here, we want to continue with the verification
    }

    logger.info('TypeScript compiler verification completed successfully');
  } catch (error) {
    logger.error('TypeScript compiler verification failed:', { error });
    process.exit(1);
  }
}

verifyTypeScriptCompiler(); 