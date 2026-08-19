<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

ensure_admin_session_started();
$error = '';

if (isset($_GET['logout'])) {
	admin_logout();
	header('Location: ' . app_url('manage.php'));
	exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username'], $_POST['password'])) {
	$username = trim((string)$_POST['username']);
	$password = (string)$_POST['password'];
	if (!admin_login($username, $password)) {
		$error = 'ログインに失敗しました。';
	} else {
		header('Location: ' . app_url('manage.php'));
		exit;
	}
}

$loggedIn = is_admin_logged_in();
$bootstrap = [
	'calendarUrl' => app_url('index.php'),
	'logoutUrl' => app_url('manage.php?logout=1'),
	'apiUrl' => app_url('api.php'),
];
?>
<!doctype html>
<html lang="ja">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Mirai Calendar Admin</title>
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body>
	<?php if (!$loggedIn): ?>
		<div class="admin-shell">
			<div class="admin-grid">
				<section class="card">
					<h3>管理ログイン</h3>
					<?php if ($error !== ''): ?>
						<div class="msg err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
					<?php endif; ?>
					<form method="post" class="row">
						<label>ユーザー名</label>
						<input name="username" required>
						<label>パスワード</label>
						<input type="password" name="password" required>
						<button class="btn" type="submit">ログイン</button>
					</form>
					<a class="btn" href="<?= htmlspecialchars(app_url('index.php'), ENT_QUOTES, 'UTF-8') ?>">カレンダーへ</a>
				</section>
			</div>
		</div>
	<?php else: ?>
		<div class="admin-shell">
			<div class="admin-grid">
				<section class="card admin-top-menu">
					<h1>設定</h1>
					<a class="btn" href="<?= htmlspecialchars(app_url('manage_calendars.php'), ENT_QUOTES, 'UTF-8') ?>">カレンダー設定</a>
					<a class="btn" href="<?= htmlspecialchars(app_url('manage_images.php'), ENT_QUOTES, 'UTF-8') ?>">画像管理</a>
					<a class="btn" href="<?= htmlspecialchars(app_url('manage_events.php'), ENT_QUOTES, 'UTF-8') ?>">イベント管理</a>
					<div class="admin-actions-v2"><a class="btn" href="<?= htmlspecialchars($bootstrap['calendarUrl'], ENT_QUOTES, 'UTF-8') ?>">カレンダーへ</a><a class="btn" href="<?= htmlspecialchars($bootstrap['logoutUrl'], ENT_QUOTES, 'UTF-8') ?>">ログアウト</a></div>
				</section>
			</div>
		</div>
	<?php endif; ?>
</body>

</html>