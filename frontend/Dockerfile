# 🌐 Frontend - Nginx serving Web Components
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static files
COPY public/ /usr/share/nginx/html/

# Fix nginx cache directory permissions
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/run && \
    chown -R nginx:nginx /usr/share/nginx/html

# Create non-root user for security
#RUN addgroup -g 1001 -S nginx && \
#    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Use non-root user
USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
