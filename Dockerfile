# Build stage
FROM node:24.22.1-alpine3.24 AS builder

WORKDIR /app

# Install the package-manager version declared in package.json
RUN npm install -g pnpm@10.34.5

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (uses standalone output from next.config.ts)
RUN pnpm build

# Runtime stage
FROM node:24.22.1-alpine3.24

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Copy standalone build from builder
COPY --from=builder --chown=node:node /app/.next/standalone ./

# Copy static assets (JS, CSS, fonts, etc.)
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const req = require('http').get('http://127.0.0.1:3000', { agent: false }, (r) => { r.resume(); r.on('end', () => { process.exitCode = r.statusCode === 200 ? 0 : 1; }); r.on('error', () => { process.exitCode = 1; }); }); req.setTimeout(2000, () => req.destroy(new Error('Health check timed out'))); req.on('error', () => { process.exitCode = 1; });"

# Start the application (standalone server is self-contained)
CMD ["node", "server.js"]
