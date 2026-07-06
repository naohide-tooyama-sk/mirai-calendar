<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$boot = bootstrap_calendar_payload();
?>
<!doctype html>
<html lang="ja">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Mirai Calendar 2col</title>
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body>
	<div id="app" class="page-shell"></div>
	<script>
		window.__BOOTSTRAP__ = <?= json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
		window.__LAYOUT_MODE__ = '2col';
	</script>
	<script src="<?= htmlspecialchars(app_url('assets/calendar.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>

</html>