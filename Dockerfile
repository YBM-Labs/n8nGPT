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

# Build the backend
RUN pnpm build:backend

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

# Copy backend app
COPY apps/n8n-backend/ ./apps/n8n-backend/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client
RUN cd apps/n8n-backend && pnpm prisma generate

# Copy built application from build stage
COPY --from=build /app/apps/n8n-backend/dist ./apps/n8n-backend/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

CMD ["pnpm", "start:backend"]
