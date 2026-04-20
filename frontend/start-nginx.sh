#!/bin/sh
set -e

# Remove all existing nginx configs to ensure clean state
rm -f /etc/nginx/conf.d/*.conf
rm -f /etc/nginx/sites-enabled/*

# Generate nginx config deterministically
cat > /etc/nginx/conf.d/default.conf << 'NGINX_EOF'
# Upstream backend - resolves at startup
upstream backend {
    server BACKEND_URL_PLACEHOLDER;
}

server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy - exact match for /api prefix
    location = /api/health {
        proxy_pass http://backend/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";
        proxy_pass_request_headers on;
    }

    # Handle SPA routing - all unknown routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

# Substitute BACKEND_URL placeholder with actual value
sed -i "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

# Print generated config for verification
echo "=== Generated nginx config ==="
cat /etc/nginx/conf.d/default.conf
echo "=== End of nginx config ==="

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'
