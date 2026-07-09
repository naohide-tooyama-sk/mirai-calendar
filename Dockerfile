FROM php:8.3-apache

# Keep timezone consistent with app defaults.
ENV TZ=Asia/Tokyo
ENV APP_STORAGE_ROOT=/var/data

WORKDIR /var/www/html

COPY ./src .

# Ensure runtime-writable storage paths for Apache/PHP worker (www-data).
RUN mkdir -p /var/data/private/data /var/data/private/cache /var/data/uploads \
	&& ln -s /var/data/uploads /var/www/html/uploads \
	&& chown -R www-data:www-data /var/www/html /var/data \
	&& chmod -R u+rwX,g+rwX /var/www/html /var/data

# Enable common Apache module in case .htaccess is used.
RUN a2enmod rewrite
