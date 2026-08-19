#!/bin/sh

set -eu

chown -R www-data:www-data /var/data
chmod -R u+rwX,g+rwX /var/data

exec su-exec www-data php -S "0.0.0.0:${PORT:-8080}" -t /app