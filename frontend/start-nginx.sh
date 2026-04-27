#!/bin/sh
set -e

if [ -z "${BACKEND_URL:-}" ]; then
    echo "ERROR: BACKEND_URL is not set. Set it to your backend service host, for example safemed-backend:8000 or https://your-backend.up.railway.app"
    exit 1
fi

# Accept either a bare host:port for Railway private networking or a public
# http(s) URL. Strip any trailing path so proxy_pass always owns /api/.
BACKEND_ORIGIN="${BACKEND_URL%/}"
BACKEND_ORIGIN="${BACKEND_ORIGIN%/api}"
case "$BACKEND_ORIGIN" in
    http://*|https://*) ;;
    *) BACKEND_ORIGIN="http://${BACKEND_ORIGIN}" ;;
esac

if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ] && echo "$BACKEND_ORIGIN" | grep -q "$RAILWAY_PUBLIC_DOMAIN"; then
    echo "ERROR: BACKEND_URL points at this frontend service (${RAILWAY_PUBLIC_DOMAIN}). Set BACKEND_URL to the backend service instead."
    exit 1
fi

# Remove all existing nginx configs to ensure clean state
rm -f /etc/nginx/conf.d/*.conf
rm -f /etc/nginx/sites-enabled/*

# Publish backend origin for the frontend bundle as a runtime config fallback.
cat > /usr/share/nginx/html/runtime-config.js << RUNTIME_EOF
window.__SAFE_MED_CONFIG__ = {
    apiBaseUrl: "${BACKEND_ORIGIN}"
};
RUNTIME_EOF

# Generate nginx config deterministically
cat > /etc/nginx/conf.d/default.conf << 'NGINX_EOF'
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
        proxy_pass BACKEND_ORIGIN_PLACEHOLDER/api/health;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/ {
        proxy_pass BACKEND_ORIGIN_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host $proxy_host;
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

# Substitute backend placeholder with normalized origin.
sed -i "s|BACKEND_ORIGIN_PLACEHOLDER|${BACKEND_ORIGIN}|g" /etc/nginx/conf.d/default.conf

# Print generated config for verification
echo "=== Generated nginx config ==="
echo "Using BACKEND_ORIGIN=${BACKEND_ORIGIN}"
cat /etc/nginx/conf.d/default.conf
echo "=== End of nginx config ==="

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'
