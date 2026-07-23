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

# Avoid AH00534 by forcing only one Apache MPM module to remain enabled.
RUN set -eux; \
	a2dismod mpm_event mpm_worker || true; \
	rm -f /etc/apache2/mods-enabled/mpm_event.load /etc/apache2/mods-enabled/mpm_event.conf; \
	rm -f /etc/apache2/mods-enabled/mpm_worker.load /etc/apache2/mods-enabled/mpm_worker.conf; \
	a2enmod mpm_prefork rewrite; \
	MPM_COUNT="$(apache2ctl -M 2>/dev/null | grep -E 'mpm_(event|worker|prefork)_module' | wc -l)"; \
	[ "$MPM_COUNT" -eq 1 ]
