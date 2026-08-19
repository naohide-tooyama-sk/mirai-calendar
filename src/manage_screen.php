<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

ensure_admin_session_started();
if (!is_admin_logged_in()) {
	header('Location: ' . app_url('manage.php'));
	exit;
}

$page = $managePage ?? '';
$titles = [
	'calendars' => 'カレンダー設定',
	'images' => '画像管理',
	'events' => 'イベント管理',
];
if (!isset($titles[$page])) {
	http_response_code(404);
	exit('Not found');
}
$boot = [
	'page' => $page,
	'title' => $titles[$page],
	'apiUrl' => app_url('api.php'),
	'topUrl' => app_url('manage.php'),
];
?>
<!doctype html>
<html lang="ja">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?= htmlspecialchars($titles[$page], ENT_QUOTES, 'UTF-8') ?></title>
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body>
	<div id="app" class="admin-shell"></div>
	<script>
		window.__BOOTSTRAP__ = <?= json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
	</script>
	<script src="<?= htmlspecialchars(app_url('assets/admin_pages.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>

</html>