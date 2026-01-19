# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and config files needed for sync
COPY package*.json ./
COPY .env.example ./.env
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY docker-install.sh ./

# Install dependencies with retry logic (handles npm bug in GitHub Actions)
RUN sh docker-install.sh

# Copy source code
COPY . .

# Build the SvelteKit app
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip postinstall scripts)
RUN npm ci --omit=dev --ignore-scripts

# Copy built app from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Create directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the app
CMD ["node", "build"]
