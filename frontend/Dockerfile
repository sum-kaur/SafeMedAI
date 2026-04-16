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

# Copy custom nginx config template (Railway env var substitution)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Remove default config, process template with envsubst, then start nginx
CMD ["sh", "-c", "rm -f /etc/nginx/conf.d/default.conf && envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
