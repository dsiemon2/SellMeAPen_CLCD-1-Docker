# ================================
# Stage 1: Build
# ================================
FROM node:20-slim AS builder

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
FROM node:20-slim AS production

# Install OpenSSL for Prisma, wget for health checks, and PostgreSQL client
RUN apt-get update && apt-get install -y openssl wget postgresql-client python3 make g++ && rm -rf /var/lib/apt/lists/*

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

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV ADMIN_PORT=3001

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
