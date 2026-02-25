FROM node:20-slim

WORKDIR /app

# Install git and other build essentials needed by some npm packages
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
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