FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Build TypeScript
RUN npm run build

# Clean up source files and dev dependencies
RUN rm -rf src/ && \
    rm -rf node_modules/ && \
    npm ci --only=production --ignore-scripts

# Create logs directory
RUN mkdir -p logs

# Run as non-root user
USER node

# Start the application
CMD ["node", "dist/index.js"]