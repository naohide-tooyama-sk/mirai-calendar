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
	'manage_user' => $envOrLocal('MANAGE_USER', 'manage_user', $local),
	'manage_password_hash' => $envOrLocal('MANAGE_PASSWORD_HASH', 'manage_password_hash', $local),
];
