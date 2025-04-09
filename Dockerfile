FROM node:18-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files first
COPY . .

# Debug: List contents of directories
RUN echo "Contents of /app:" && \
    ls -la /app && \
    echo "\nContents of /app/src:" && \
    ls -la /app/src && \
    echo "\nContents of /app/src/api:" && \
    ls -la /app/src/api && \
    echo "\nContents of /app/src/scraper:" && \
    ls -la /app/src/scraper && \
    echo "\nContents of /app/src/config:" && \
    ls -la /app/src/config && \
    echo "\nContents of /app/src/llm:" && \
    ls -la /app/src/llm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm run build

# Set Puppeteer executable path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 