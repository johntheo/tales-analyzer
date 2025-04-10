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

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Debug: List contents of directories
RUN echo "Contents of /app:" && \
    ls -la /app && \
    echo "\nContents of /app/src:" && \
    ls -la /app/src

# Check project structure
RUN pnpm run check:structure

# Create a directory for screenshots with proper permissions
RUN mkdir -p /tmp/tales-analyzer-screenshots && \
    chmod 777 /tmp/tales-analyzer-screenshots

# Build the application
RUN pnpm run build

# Verify Docker environment
RUN pnpm run verify:docker

# Verify Railway deployment
RUN pnpm run verify:railway

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 