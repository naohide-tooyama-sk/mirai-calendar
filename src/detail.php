<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$eventId = trim((string)($_GET['eventId'] ?? $_GET['id'] ?? ''));
$event = $eventId !== '' ? find_event_by_id($eventId) : null;
$boot = [
	'eventId' => $eventId,
	'event' => $event,
	'calendarUrl' => app_url('index.php'),
	'apiUrl' => app_url('api.php'),
	'assetBaseUrl' => app_url('assets/images/'),
];
?>
<!doctype html>
<html lang="ja">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>イベント詳細</title>
	<link rel="icon" type="image/png" href="<?= htmlspecialchars(app_url('assets/images/schedule.png'), ENT_QUOTES, 'UTF-8') ?>">
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body class="detail-page">
	<div id="app" class="detail-shell"></div>
	<script>
		window.__BOOTSTRAP__ = <?= json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
	</script>
	<script src="<?= htmlspecialchars(app_url('assets/detail.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>

</html>