FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy startup script
COPY start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Run startup script to generate config and start nginx
CMD ["/start-nginx.sh"]
