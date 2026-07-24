FROM php:8.3-cli

# Keep timezone consistent with app defaults.
ENV TZ=Asia/Tokyo
ENV APP_STORAGE_ROOT=/var/data

WORKDIR /var/www/html

COPY ./src .

# Ensure runtime-writable storage paths.
RUN mkdir -p /var/data/private/data /var/data/private/cache /var/data/uploads \
	&& ln -s /var/data/uploads /var/www/html/uploads \
	&& chown -R www-data:www-data /var/www/html /var/data \
	&& chmod -R u+rwX,g+rwX /var/www/html /var/data

EXPOSE 80

# Railway injects PORT. Keep 80 as local fallback.
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-80} -t /var/www/html"]
