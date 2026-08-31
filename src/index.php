<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$boot = bootstrap_calendar_payload();
?>
<!doctype html>
<html lang="ja">

<head>
	<!-- Google tag (gtag.js) -->
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-D7NR462NP2"></script>
	<script>
		window.dataLayer = window.dataLayer || [];

		function gtag() {
			dataLayer.push(arguments);
		}
		gtag('js', new Date());

		gtag('config', 'G-D7NR462NP2');
	</script>

	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>未来勉強会 イベントカレンダー</title>
	<link rel="icon" type="image/png" href="<?= htmlspecialchars(app_url('assets/images/schedule.png'), ENT_QUOTES, 'UTF-8') ?>">
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body>
	<div id="app" class="page-shell"></div>
	<script>
		window.__BOOTSTRAP__ = <?= json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
	</script>
	<script src="<?= htmlspecialchars(app_url('assets/calendar.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>

</html>