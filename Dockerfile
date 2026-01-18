# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine3.18 AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ================================
# Stage 2: Production
# ================================
FROM node:20-alpine3.18 AS production

# Install OpenSSL for Prisma (Alpine 3.18 has OpenSSL 1.1)
RUN apk update && apk add --no-cache openssl

WORKDIR /app

# Install only production dependencies (plus tsx for seeding)
COPY package*.json ./
RUN npm install --omit=dev && npm install tsx

# Copy prisma schema and generate client for production
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy views (EJS templates) and public assets
COPY views ./views
COPY public ./public

# Copy and setup entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV ADMIN_PORT=3001
ENV DATABASE_URL="file:/app/data/app.db"

# Expose ports (internal only - nginx will proxy)
EXPOSE 3000
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Use entrypoint to initialize database
ENTRYPOINT ["/entrypoint.sh"]

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/server.js"]
