# Build stage
FROM node:26-alpine AS builder

WORKDIR /app

# Install the package-manager version declared in package.json
RUN npm install -g pnpm@10.27.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (uses standalone output from next.config.ts)
RUN pnpm build

# Runtime stage
FROM node:26-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy standalone build from builder
COPY --from=builder /app/.next/standalone ./

# Copy static assets (JS, CSS, fonts, etc.)
COPY --from=builder /app/.next/static ./.next/static

# Copy public files
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application (standalone server is self-contained)
CMD ["node", "server.js"]
