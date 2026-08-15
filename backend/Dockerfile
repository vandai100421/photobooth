# syntax=docker/dockerfile:1.6

# ---- Stage 1: install production dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: runtime image ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Run as a non-root user for security.
RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=5000

# Bring only what is needed to run the server.
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Optional: include the OpenAPI contract for reference (uncomment if needed).
# COPY docs ./docs

USER app

EXPOSE 5000

# Container health probe — uses Node's built-in fetch (no curl/wget needed).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const u='http://localhost:'+(process.env.PORT||5000)+'/health';fetch(u).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
