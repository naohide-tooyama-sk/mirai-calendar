<?php

declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$type = trim((string)($_GET['eventType'] ?? ''));
$purpose = trim((string)($_GET['purpose'] ?? ''));
$types = event_type_definitions();
$purposes = purpose_type_definitions();
$runtimeConfig = get_runtime_config();
$searchTimezone = new DateTimeZone($runtimeConfig['timezone']);
$today = new DateTimeImmutable('today', $searchTimezone);
$events = array_filter(get_event_cache(), static function (array $event) use ($type, $purpose, $today, $searchTimezone): bool {
	$startValue = trim((string)($event['date'] ?? $event['startTime'] ?? ''));
	if ($startValue === '') {
		return false;
	}
	try {
		$eventDate = (new DateTimeImmutable($startValue, $searchTimezone))->setTimezone($searchTimezone)->format('Y-m-d');
	} catch (Throwable $e) {
		return false;
	}
	if ($eventDate < $today->format('Y-m-d')) {
		return false;
	}
	$typeMatch = $type === '' || (string)($event['eventTypeId'] ?? '') === $type;
	$purposeMatch = $purpose === '' || in_array($purpose, (array)($event['purposeTypeIds'] ?? []), true);
	return $typeMatch && $purposeMatch;
});
usort($events, static fn(array $a, array $b): int => strcmp((string)($a['startTime'] ?? ''), (string)($b['startTime'] ?? '')));

function search_escape(string $value): string {
	return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function search_datetime(string $value, string $format): string {
	try {
		return (new DateTime($value))->format($format);
	} catch (Throwable $e) {
		return $value;
	}
}

function search_category_class(string $typeId): string {
	return ['study' => 'cat-study', 'networking' => 'cat-exchange', 'seminar' => 'cat-seminar', 'challenge' => 'cat-challenge', 'online' => 'cat-online'][$typeId] ?? 'cat-unset';
}

function search_date_parts(string $value): array {
	$weekdays = ['日', '月', '火', '水', '木', '金', '土'];
	try {
		$d = new DateTime($value);
		return ['date' => $d->format('n') . '/' . $d->format('j'), 'weekday' => $weekdays[(int)$d->format('w')]];
	} catch (Throwable $e) {
		return ['date' => $value, 'weekday' => ''];
	}
}

function search_card(array $event): string {
	$typeId = (string)($event['eventTypeId'] ?? '');
	$catClass = search_category_class($typeId);
	$icon = ['study' => 'study.png', 'networking' => 'team.png', 'seminar' => 'seminar.png', 'challenge' => 'challenge.png', 'online' => 'online.png'][$typeId] ?? '';
	$iconHtml = $icon ? '<img class="recommend-type-icon ' . $catClass . '" src="' . search_escape(app_url('assets/images/' . $icon)) . '" alt="">' : '';
	$image = search_escape((string)($event['mainImageUrl'] ?: app_url('assets/images/people.png')));
	$dateParts = search_date_parts((string)($event['date'] ?? $event['startTime'] ?? ''));
	$dateHtml = '<strong class="recommend-date-v2"><span class="recommend-date-main-v2">' . search_escape($dateParts['date']) . '</span>' . ($dateParts['weekday'] !== '' ? '<span class="recommend-weekday-v2">' . search_escape($dateParts['weekday']) . '</span>' : '') . '<span class="recommend-start-time">' . search_escape(search_datetime((string)($event['startTime'] ?? ''), 'H:i')) . '</span></strong>';
	$detailUrl = search_escape(app_url('detail.php?eventId=' . rawurlencode((string)($event['eventId'] ?? ''))));
	$title = search_escape((string)($event['shortTitle'] ?: ($event['title'] ?? 'イベント')));
	$desc = search_escape((string)($event['shortDescription'] ?? ''));
	return '<a class="event-card-common event-list-card-v2 ' . $catClass . '" href="' . $detailUrl . '">' . $iconHtml . '<div class="event-card-top"><img class="event-list-image" src="' . $image . '" alt=""></div><div class="event-card-content"><div class="event-card-date">' . $dateHtml . '</div><h3>' . $title . '</h3><p>' . $desc . '</p></div></a>';
}
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
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<title>イベント検索</title>
	<link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/styles.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>

<body>
	<main class="search-page">
		<header class="detail-topbar"><a class="detail-back" href="<?= htmlspecialchars(app_url('index.php'), ENT_QUOTES, 'UTF-8') ?>">‹ 戻る</a><img class="detail-logo" src="<?= htmlspecialchars(app_url('assets/images/mirai_logo.png'), ENT_QUOTES, 'UTF-8') ?>" alt="未来勉強会"></header>
		<section class="event-search-section">
			<form class="event-search-form" method="get"><select id="purpose" name="purpose">
					<option value="">参加目的選択</option><?php foreach ($purposes as $id => $label): ?><option value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>" <?= $purpose === $id ? ' selected' : '' ?>><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></option><?php endforeach; ?>
				</select><select id="eventType" name="eventType">
					<option value="">種別選択</option><?php foreach ($types as $id => $label): ?><option value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>" <?= $type === $id ? ' selected' : '' ?>><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></option><?php endforeach; ?>
				</select><button class="btn" type="submit">検索</button></form>
		</section>
		<section class="search-results-v2 event-list-section">
			<h1 class="search-results-heading">イベント検索結果</h1><?php if (!$events): ?><p class="search-no-results">該当するイベントはありません</p><?php endif; ?>
			<div class="event-list-grid-v2"><?php foreach ($events as $event): ?><?= search_card($event) ?><?php endforeach; ?></div>
		</section>
	</main>
</body>

</html>