# Build stage
FROM node:22-slim AS builder

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
FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip postinstall scripts)
# Add retry logic for npm bug: "Exit handler never called!"
RUN for i in 1 2 3; do \
      echo "Production install attempt $i..."; \
      npm install --production --ignore-scripts 2>&1 | grep -v "^npm warn" || true; \
      if [ -f "node_modules/better-sqlite3/package.json" ]; then \
        echo "✓ Production dependencies installed successfully"; \
        break; \
      else \
        echo "✗ Install attempt $i failed - packages missing"; \
        if [ $i -eq 3 ]; then \
          echo "ERROR: All 3 install attempts failed"; \
          exit 1; \
        fi; \
        echo "Cleaning up and retrying in 5 seconds..."; \
        rm -rf node_modules package-lock.json 2>/dev/null || true; \
        sleep 5; \
      fi; \
    done

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
