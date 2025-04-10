FROM node:18-slim

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-noto \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files and tsconfig.json
COPY package.json pnpm-lock.yaml tsconfig.json ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src

# Debug: List contents of directories
RUN echo "Contents of /app:" && \
    ls -la /app && \
    echo "\nContents of /app/src:" && \
    ls -la /app/src

# Fix Docker paths
RUN pnpm run fix:docker-paths

# Verify source files
RUN pnpm run verify:source

# Verify TypeScript compiler
RUN pnpm run verify:tsc

# Verify build process
RUN pnpm run verify:build

# Build the application
RUN pnpm run build

# Create a directory for screenshots with proper permissions
RUN mkdir -p /tmp/tales-analyzer-screenshots && \
    chmod 777 /tmp/tales-analyzer-screenshots

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 