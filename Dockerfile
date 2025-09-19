# Multi-stage build for n8n-backend from root
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9

# Set working directory
WORKDIR /app

# Copy package files from root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy workspace packages
COPY packages/ ./packages/

# Copy backend app
COPY apps/n8n-backend/ ./apps/n8n-backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd apps/n8n-backend && pnpm prisma generate

# Build stage
FROM base AS build

# Build the backend directly in its package (avoid turbo indirection)
RUN cd apps/n8n-backend && pnpm build

# Verify build output
RUN ls -la /app/apps/n8n-backend/dist/ || true
RUN ls -la /app/apps/n8n-backend/dist/src/ || true

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy workspace packages
COPY packages/ ./packages/

# Copy the entire built backend app from build stage
COPY --from=build /app/apps/n8n-backend ./apps/n8n-backend

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Set working directory to backend app
WORKDIR /app/apps/n8n-backend

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Try dist/index.js first, fallback to dist/src/index.js if needed
CMD ["sh", "-c", "node dist/index.js || node dist/src/index.js"]
