#!/bin/sh
set -e

# Remove default nginx config
rm -f /etc/nginx/conf.d/default.conf

# Generate nginx config deterministically
cat > /etc/nginx/conf.d/default.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy - MUST come before SPA fallback
    location /api/ {
        proxy_pass http://BACKEND_URL_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

# Start nginx
exec nginx -g 'daemon off;'
