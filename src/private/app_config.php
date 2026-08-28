<?php

$local = [];
$localPath = __DIR__ . '/app_config.local.php';
if (is_file($localPath)) {
	$loaded = require $localPath;
	if (is_array($loaded)) {
		$local = $loaded;
	}
}

$envOrLocal = static function (string $envKey, string $localKey, array $local): string {
	$envValue = $_ENV[$envKey] ?? getenv($envKey);
	if ($envValue !== false && $envValue !== null && $envValue !== '') {
		return (string)$envValue;
	}

	return (string)($local[$localKey] ?? '');
};

return [
	'google_api_key' => $envOrLocal('GOOGLE_API_KEY', 'google_api_key', $local),
	'admin_user' => $envOrLocal('ADMIN_USER', 'admin_user', $local),
	'admin_password_hash' => $envOrLocal('ADMIN_PASSWORD_HASH', 'admin_password_hash', $local),
];
