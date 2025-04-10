import { execSync } from 'child_process';
import { logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';

async function verifyTypeScriptCompiler() {
  try {
    logger.info('Verifying TypeScript compiler...');

    // Check if tsc is available
    try {
      execSync('pnpm tsc --version', { stdio: 'inherit' });
      logger.info('TypeScript compiler is available');
    } catch (error) {
      logger.error('TypeScript compiler is not available', { error });
      throw error;
    }

    // Create a temporary test file
    const testDir = path.join(process.cwd(), 'temp-test');
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

    logger.info('TypeScript compiler verification completed successfully');
  } catch (error) {
    logger.error('TypeScript compiler verification failed:', { error });
    process.exit(1);
  }
}

verifyTypeScriptCompiler(); 