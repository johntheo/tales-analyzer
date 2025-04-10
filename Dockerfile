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

# Copy package files and TypeScript config
COPY package.json pnpm-lock.yaml tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY src/ ./src/

# Debug: List contents of /app directory
RUN ls -la /app && \
    echo "Contents of /app/src:" && \
    ls -la /app/src

# Build the application
RUN pnpm run build

# Create a directory for screenshots with proper permissions
RUN mkdir -p /tmp/tales-analyzer-screenshots && \
    chmod 777 /tmp/tales-analyzer-screenshots

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 