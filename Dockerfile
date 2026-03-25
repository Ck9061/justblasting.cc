# Base image for Node.js
FROM node:22-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app
COPY . .
# Copy node_modules AFTER copying source code to overwrite any host node_modules
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules

# Install tsx globally to run the server.ts file
RUN npm install -g tsx

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["tsx", "server.ts"]
