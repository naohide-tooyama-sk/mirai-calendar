FROM php:8.3-apache

# Keep timezone consistent with app defaults.
ENV TZ=Asia/Tokyo

WORKDIR /var/www/html

COPY ./src .

# Ensure runtime-writable storage paths for Apache/PHP worker (www-data).
RUN mkdir -p /var/www/html/private/data /var/www/html/private/cache /var/www/html/uploads \
	&& chown -R www-data:www-data /var/www/html \
	&& chmod -R u+rwX,g+rwX /var/www/html

# Enable common Apache module in case .htaccess is used.
RUN a2enmod rewrite
