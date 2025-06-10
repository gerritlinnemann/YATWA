# ⚡ Backend - Bun Runtime
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY bunfig.toml ./

# Create non-root user
RUN addgroup -g 1001 -S bunuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G bunuser -g bunuser bunuser && \
    chown -R bunuser:bunuser /app

USER bunuser

EXPOSE 3000

# Development: Watch mode
CMD ["bun", "run", "--watch", "src/index.ts"]