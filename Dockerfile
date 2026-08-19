FROM php:8.3-cli-alpine

RUN apk add --no-cache su-exec

ENV TZ=Asia/Tokyo
ENV APP_STORAGE_ROOT=/var/data

WORKDIR /app

COPY ./src/ /app/

# Keep writable paths outside the app directory so Railway Volume can mount there.
RUN mkdir -p /var/data/private/data /var/data/private/cache /var/data/uploads \
	&& ln -sfn /var/data/uploads /app/uploads \
	&& chown -R www-data:www-data /app /var/data \
	&& chmod -R u+rwX,g+rwX /app /var/data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

# Railway sets PORT at runtime. 8080 is a safe local fallback.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD []
