FROM php:8.3-cli-alpine

ENV TZ=Asia/Tokyo
ENV APP_STORAGE_ROOT=/var/data

WORKDIR /app

COPY ./src/ /app/

# Keep writable paths outside the app directory so Railway Volume can mount there.
RUN mkdir -p /var/data/private/data /var/data/private/cache /var/data/uploads \
	&& ln -sfn /var/data/uploads /app/uploads \
	&& chown -R www-data:www-data /app /var/data \
	&& chmod -R u+rwX,g+rwX /app /var/data

EXPOSE 8080

USER www-data

# Railway sets PORT at runtime. 8080 is a safe local fallback.
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} -t /app"]
