import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from './utils/logger.js';

async function fixDockerPaths() {
  try {
    logger.info('Checking and fixing Docker file paths...', { cwd: process.cwd() });
    
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
      // Try to create the src directory if it doesn't exist
      fs.mkdirSync(srcDir, { recursive: true });
      logger.info(`Created src directory at: ${srcDir}`, { srcDir });
    }
    
    // Check if tsconfig.json exists and log its contents
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      logger.info(`tsconfig.json exists at: ${tsconfigPath}`, { tsconfigPath });
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
      logger.info(`tsconfig.json content: ${tsconfigContent}`, { content: tsconfigContent });
      
      // Check if the tsconfig.json has the correct include paths
      const tsconfig = JSON.parse(tsconfigContent);
      if (!tsconfig.include || !tsconfig.include.includes('src')) {
        logger.info('Updating tsconfig.json to include src directory', { include: tsconfig.include });
        tsconfig.include = ['src'];
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        logger.info('Updated tsconfig.json', { newContent: JSON.stringify(tsconfig, null, 2) });
      }
    } else {
      logger.error(`tsconfig.json does not exist at: ${tsconfigPath}`, { tsconfigPath });
      // Create a basic tsconfig.json if it doesn't exist
      const basicTsconfig = {
        compilerOptions: {
          target: "ES2021",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          outDir: "dist",
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          strict: true,
          skipLibCheck: true,
          allowJs: true,
          resolveJsonModule: true,
          lib: ["ES2021", "DOM", "DOM.Iterable"],
          types: ["node"]
        },
        include: ["src"],
        exclude: ["node_modules", "dist"]
      };
      fs.writeFileSync(tsconfigPath, JSON.stringify(basicTsconfig, null, 2));
      logger.info(`Created basic tsconfig.json at: ${tsconfigPath}`, { content: JSON.stringify(basicTsconfig, null, 2) });
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
    } catch (error) {
      logger.error('Failed to compile the project', { error });
      
      // Try to create a minimal test file to see if TypeScript compilation works at all
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
        logger.info('Attempting to compile test file...', { testFile });
        execSync(`pnpm tsc ${testFile} --outDir ${testDir}`, { stdio: 'inherit' });
        logger.info('Successfully compiled test file', { success: true });
        
        // Verify the output file exists
        const outputFile = path.join(testDir, 'test.js');
        if (fs.existsSync(outputFile)) {
          logger.info('Output JavaScript file was created', { outputFile });
        } else {
          logger.error('Output JavaScript file was not created', { outputFile });
        }
      } finally {
        // Clean up test files
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }
    }
    
    logger.info('Docker path check and fix completed', { success: true });
  } catch (error) {
    logger.error('Error fixing Docker paths:', { error });
    process.exit(1);
  }
}

fixDockerPaths(); 