FROM node:20-slim

WORKDIR /app

# Install bun for building/running TypeScript
RUN npm install -g bun

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with npm (uses Node.js native modules)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production

# Run with Node.js + tsx for TypeScript support
RUN npm install -g tsx
CMD ["tsx", "src/index.ts"]