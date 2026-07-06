FROM php:8.3-apache

# Keep timezone consistent with app defaults.
ENV TZ=Asia/Tokyo

WORKDIR /var/www/html

COPY ./src .

# Enable common Apache module in case .htaccess is used.
RUN a2enmod rewrite
