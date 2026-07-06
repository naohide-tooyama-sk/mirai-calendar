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
		<div id="app" class="admin-shell"></div>
		<script>
			window.__BOOTSTRAP__ = <?= json_encode($bootstrap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
		</script>
		<script src="<?= htmlspecialchars(app_url('assets/admin.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
	<?php endif; ?>
</body>

</html>