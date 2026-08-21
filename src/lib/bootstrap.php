<?php

declare(strict_types=1);

const HOLIDAY_CALENDAR_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

function app_root_dir(): string {
	return dirname(__DIR__);
}

function storage_root_dir(): string {
	$root = trim((string)(getenv('APP_STORAGE_ROOT') ?: ''));
	if ($root === '') {
		return app_root_dir();
	}
	return rtrim(str_replace('\\', '/', $root), '/');
}

function private_dir(): string {
	return app_root_dir() . '/private';
}

function storage_private_dir(): string {
	return storage_root_dir() . '/private';
}

function data_dir(): string {
	return storage_private_dir() . '/data';
}

function cache_dir(): string {
	return storage_private_dir() . '/cache';
}

function uploads_dir(): string {
	return storage_root_dir() . '/uploads';
}

function app_base_path(): string {
	$dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
	if ($dir === '/' || $dir === '.') {
		return '';
	}
	return rtrim($dir, '/');
}

function app_url(string $path): string {
	return app_base_path() . '/' . ltrim($path, '/');
}

function defaults_config(): array {
	return [
		'timezone' => 'Asia/Tokyo',
	];
}

function ensure_storage_dirs(): void {
	$dirs = [
		storage_private_dir(),
		data_dir(),
		cache_dir(),
		uploads_dir(),
	];

	foreach ($dirs as $dir) {
		if (!is_dir($dir)) {
			mkdir($dir, 0775, true);
		}
	}
}

function ensure_storage_files(): void {
	ensure_storage_dirs();

	$defaults = [
		data_dir() . '/config.txt' => defaults_config(),
		data_dir() . '/calendars.txt' => [],
		data_dir() . '/images.txt' => [],
		data_dir() . '/holidays.txt' => [],
		data_dir() . '/event_details.txt' => [],
	];

	foreach ($defaults as $path => $payload) {
		if (!is_file($path)) {
			write_json_txt($path, $payload);
		}
	}
}

function read_json_txt(string $path, $default) {
	if (!is_file($path)) {
		return $default;
	}

	$raw = @file_get_contents($path);
	if ($raw === false || trim($raw) === '') {
		return $default;
	}

	$decoded = json_decode($raw, true);
	if (json_last_error() !== JSON_ERROR_NONE) {
		return $default;
	}

	return $decoded;
}

function write_json_txt(string $path, $data): void {
	$dir = dirname($path);
	if (!is_dir($dir)) {
		mkdir($dir, 0775, true);
	}

	$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
	if ($json === false) {
		throw new RuntimeException('JSONエンコードに失敗しました。');
	}

	$fp = fopen($path, 'c+');
	if (!$fp) {
		throw new RuntimeException('ファイルを開けません: ' . $path);
	}

	try {
		if (!flock($fp, LOCK_EX)) {
			throw new RuntimeException('ファイルロックに失敗しました。');
		}
		ftruncate($fp, 0);
		rewind($fp);
		fwrite($fp, $json);
		fflush($fp);
		flock($fp, LOCK_UN);
	} finally {
		fclose($fp);
	}
}

function get_runtime_config(): array {
	ensure_storage_files();
	$cfg = read_json_txt(data_dir() . '/config.txt', []);
	$out = array_merge(defaults_config(), is_array($cfg) ? $cfg : []);

	$out['timezone'] = trim((string)($out['timezone'] ?? 'Asia/Tokyo')) ?: 'Asia/Tokyo';
	$out = array_intersect_key($out, array_flip(['timezone']));
	return $out;
}

function save_runtime_config(array $cfg): array {
	$current = get_runtime_config();
	$merged = array_merge($current, $cfg);

	$merged['timezone'] = trim((string)($merged['timezone'] ?? 'Asia/Tokyo')) ?: 'Asia/Tokyo';
	$merged = array_intersect_key($merged, array_flip(['timezone']));
	write_json_txt(data_dir() . '/config.txt', $merged);
	return $merged;
}

function default_event_detail(): array {
	return [
		'eventId' => '',
		'eventType' => '',
		'imageFilename' => '',
		'detailSubtitle' => '',
		'timeText' => '',
		'locationText' => '',
		'capacityText' => '',
		'applyUrl' => '',
		'shortTitle' => '',
		'shortDescription' => '',
		'remainingText' => '',
		'showRemaining' => false,
		'recommended' => false,
	];
}

function event_details_file(string $monthKey): string {
	if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
		throw new InvalidArgumentException('年月の形式が不正です。');
	}
	return data_dir() . '/event_details-' . $monthKey . '.txt';
}

function get_event_details_config(?string $monthKey = null): array {
	ensure_storage_files();
	$out = [];
	$files = $monthKey === null
		? array_merge(glob(data_dir() . '/event_details-????-??.txt') ?: [], [data_dir() . '/event_details.txt'])
		: [event_details_file($monthKey)];
	foreach ($files as $file) {
		$rows = read_json_txt($file, []);
		if (!is_array($rows)) {
			continue;
		}
		foreach ($rows as $row) {
			if (!is_array($row)) {
				continue;
			}
			$detail = normalize_event_detail_config($row);
			if ($detail['eventId'] !== '') {
				$out[] = $detail;
			}
		}
	}
	return $out;
}

function save_event_details_config(array $rows, ?string $monthKey = null): array {
	$out = [];
	foreach ($rows as $row) {
		if (!is_array($row)) {
			continue;
		}
		$detail = normalize_event_detail_config($row);
		if ($detail['eventId'] === '') {
			continue;
		}
		$out[] = $detail;
	}
	write_json_txt($monthKey === null ? data_dir() . '/event_details.txt' : event_details_file($monthKey), $out);
	return $out;
}

function normalize_event_detail_config(array $row): array {
	$detail = default_event_detail();
	$aliases = [
		'eventType' => 'categoryText',
		'imageFilename' => 'catchImageFilename',
		'detailSubtitle' => 'heroSubtitle',
		'timeText' => 'timeText',
		'locationText' => 'venueText',
		'shortTitle' => 'heroTitle',
		'shortDescription' => 'descriptionText',
	];
	foreach ($detail as $key => $default) {
		if ($key === 'recommended' || $key === 'showRemaining') {
			$detail[$key] = normalize_bool($row[$key] ?? false, false);
			continue;
		}
		$alias = $aliases[$key] ?? $key;
		$detail[$key] = trim((string)($row[$key] ?? ($alias !== $key ? ($row[$alias] ?? '') : '')));
	}
	$detail['applyUrl'] = sanitize_url((string)$detail['applyUrl']);
	return $detail;
}

function get_event_detail_map(): array {
	$map = [];
	foreach (get_event_details_config() as $detail) {
		$map[$detail['eventId']] = $detail;
	}
	return $map;
}

function get_image_url_by_id(string $id, ?array $images = null): string {
	$id = trim($id);
	if ($id === '') {
		return '';
	}
	foreach (($images ?? get_images()) as $img) {
		if ((string)$img['id'] === $id) {
			return (string)$img['url'];
		}
	}
	return '';
}

function get_image_url_by_filename(string $filename, ?array $images = null): string {
	$filename = basename(trim($filename));
	if ($filename === '') {
		return '';
	}
	foreach (($images ?? get_images()) as $img) {
		if ((string)$img['filename'] === $filename) {
			return (string)$img['url'];
		}
	}
	return '';
}

function enrich_event_with_detail(array $event, ?array $details = null, ?array $images = null): array {
	$detail = ($details ?? get_event_detail_map())[(string)($event['id'] ?? '')] ?? default_event_detail();
	$event['detail'] = $detail;
	$event['catchImageUrl'] = get_image_url_by_filename((string)($detail['imageFilename'] ?? ''), $images)
		?: get_image_url_by_id((string)($detail['catchImageId'] ?? ''), $images);
	$event['categoryText'] = (string)($detail['eventType'] ?? '');
	$event['displayDescription'] = (string)(strip_capacity_tag((string)($event['description'] ?? '')));
	$event['timeText'] = (string)($detail['timeText'] ?? '');
	$event['locationText'] = (string)($detail['locationText'] ?? '');
	$event['shortTitle'] = (string)($detail['shortTitle'] ?? '');
	$event['shortDescription'] = (string)($detail['shortDescription'] ?? '');
	$event['detailSubtitle'] = (string)($detail['detailSubtitle'] ?? '');
	$event['remainingText'] = (string)($detail['remainingText'] ?? '');
	$event['showRemaining'] = normalize_bool($detail['showRemaining'] ?? false, false);
	$event['capacityText'] = (string)($detail['capacityText'] ?? '');
	$event['venueText'] = (string)($detail['locationText'] ?? '');
	$event['applyUrl'] = (string)($detail['applyUrl'] ?? '');
	return $event;
}

function enrich_events_by_date(array $eventsByDate): array {
	$details = get_event_detail_map();
	$images = get_images();
	foreach ($eventsByDate as $dateKey => $list) {
		if (!is_array($list)) {
			continue;
		}
		foreach ($list as $i => $event) {
			if (is_array($event)) {
				$list[$i] = enrich_event_with_detail($event, $details, $images);
			}
		}
		$eventsByDate[$dateKey] = $list;
	}
	return $eventsByDate;
}

function find_event_by_id(string $eventId): ?array {
	$eventId = trim($eventId);
	if ($eventId === '') {
		return null;
	}
	foreach (get_cached_events_catalog() as $event) {
		if ((string)$event['id'] === $eventId) {
			return enrich_event_with_detail($event);
		}
	}
	return null;
}

function get_cached_event_options(): array {
	$options = [];
	foreach (get_cached_events_catalog() as $event) {
		$options[] = [
			'eventId' => $event['id'],
			'title' => $event['title'],
			'startIso' => $event['startIso'],
			'isAllDay' => $event['isAllDay'],
			'defaultDateText' => format_cached_event_datetime_text($event),
			'defaultTitleText' => (string)$event['title'],
			'label' => format_cached_event_label($event),
		];
	}

	return $options;
}

function resolve_recent_events_payload(): array {
	$catalog = [];
	$details = get_event_detail_map();
	$images = get_images();
	foreach (get_cached_events_catalog() as $event) {
		$catalog[$event['id']] = $event;
	}

	$now = new DateTime('today');
	$out = [];
	foreach ($details as $eventId => $detail) {
		if (empty($detail['recommended']) || !isset($catalog[$eventId])) {
			continue;
		}

		$event = enrich_event_with_detail($catalog[$eventId], $details, $images);
		$start = parse_event_datetime($event['startIso']);
		if (!$start || $start < $now) {
			continue;
		}

		$out[] = [
			'eventId' => $event['id'],
			'dateText' => format_cached_event_datetime_text($event),
			'titleText' => (string)($event['shortTitle'] ?: $event['title']),
			'leadText' => (string)$event['shortDescription'],
			'id' => $event['id'],
			'calendarId' => $event['calendarId'],
			'calendarName' => $event['calendarName'],
			'title' => $event['title'],
			'startIso' => $event['startIso'],
			'endIso' => $event['endIso'],
			'isAllDay' => $event['isAllDay'],
			'location' => $event['location'],
			'description' => $event['description'],
			'categoryText' => $event['categoryText'],
			'catchImageUrl' => $event['catchImageUrl'],
			'remainingTextDetail' => $event['remainingText'],
		];
	}
	usort($out, static fn(array $a, array $b): int => strcmp((string)$b['startIso'], (string)$a['startIso']));
	$out = array_slice($out, 0, 10);
	return $out;
}

function get_cached_events_catalog(): array {
	ensure_storage_files();
	$files = glob(cache_dir() . '/month-*.txt');
	if (!is_array($files) || $files === []) {
		return [];
	}

	sort($files, SORT_STRING);
	$events = [];
	foreach ($files as $path) {
		$payload = read_json_txt($path, []);
		$eventsByDate = is_array($payload['eventsByDate'] ?? null) ? $payload['eventsByDate'] : [];
		foreach ($eventsByDate as $list) {
			if (!is_array($list)) {
				continue;
			}
			foreach ($list as $event) {
				$normalized = normalize_cached_event_record($event);
				if ($normalized === null) {
					continue;
				}
				$events[] = $normalized;
			}
		}
	}

	usort($events, static function (array $a, array $b): int {
		$cmp = strcmp((string)$a['startIso'], (string)$b['startIso']);
		if ($cmp !== 0) {
			return $cmp;
		}
		$cmp = strcmp((string)$a['title'], (string)$b['title']);
		if ($cmp !== 0) {
			return $cmp;
		}
		return strcmp((string)$a['id'], (string)$b['id']);
	});

	$unique = [];
	foreach ($events as $event) {
		if (isset($unique[$event['id']])) {
			continue;
		}
		$unique[$event['id']] = $event;
	}

	return array_values($unique);
}

function normalize_cached_event_record($event): ?array {
	if (!is_array($event)) {
		return null;
	}

	$id = trim((string)($event['id'] ?? ''));
	$startIso = trim((string)($event['startIso'] ?? ''));
	$endIso = trim((string)($event['endIso'] ?? ''));
	if ($id === '' || $startIso === '' || $endIso === '') {
		return null;
	}

	return [
		'id' => $id,
		'calendarId' => trim((string)($event['calendarId'] ?? '')),
		'calendarName' => (string)($event['calendarName'] ?? ''),
		'title' => trim((string)($event['title'] ?? '')) ?: '(無題)',
		'startIso' => $startIso,
		'endIso' => $endIso,
		'isAllDay' => normalize_bool($event['isAllDay'] ?? false, false),
		'location' => (string)($event['location'] ?? ''),
		'description' => (string)($event['description'] ?? ''),
	];
}

function parse_event_datetime(string $iso): ?DateTime {
	$iso = trim($iso);
	if ($iso === '') {
		return null;
	}

	try {
		return new DateTime($iso);
	} catch (Throwable $e) {
		return null;
	}
}

function format_cached_event_label(array $event): string {
	$start = parse_event_datetime((string)($event['startIso'] ?? ''));
	$title = trim((string)($event['title'] ?? '')) ?: '(無題)';
	if (!$start) {
		return $title;
	}

	return format_cached_event_datetime_text($event) . ' ' . $title;
}

function format_cached_event_datetime_text(array $event): string {
	$start = parse_event_datetime((string)($event['startIso'] ?? ''));
	if (!$start) {
		return '';
	}

	$prefix = $start->format('Y/m/d');
	if (!empty($event['isAllDay'])) {
		return $prefix . ' 終日';
	}

	return $prefix . ' ' . $start->format('H:i');
}

function normalize_image_ids(array $ids, int $limit = 3): array {
	$out = [];
	foreach ($ids as $id) {
		$id = trim((string)$id);
		if ($id !== '') {
			$out[] = $id;
		}
	}
	return array_values(array_slice(array_unique($out), 0, max(0, $limit)));
}

function get_calendars(bool $includeDisabled = false): array {
	ensure_storage_files();
	$rows = read_json_txt(data_dir() . '/calendars.txt', []);
	if (!is_array($rows)) {
		return [];
	}

	$normalized = [];
	foreach (array_slice($rows, 0, 10) as $index => $row) {
		if (!is_array($row)) {
			continue;
		}
		$input = trim((string)($row['calendarInput'] ?? ''));
		$calendarId = trim((string)($row['calendarId'] ?? ''));
		$enabled = $input !== '' || $calendarId !== '';
		$resolved = $calendarId !== '' ? $calendarId : extract_calendar_id($input);
		if ($resolved === '') {
			continue;
		}
		if (!$includeDisabled && !$enabled) {
			continue;
		}
		$normalized[] = [
			'order' => $index + 1,
			'calendarInput' => $input,
			'calendarId' => $resolved,
			'enabled' => $enabled,
		];
	}

	return $normalized;
}

function save_calendars(array $rows): array {
	$out = [];
	foreach (array_slice($rows, 0, 10) as $index => $row) {
		if (!is_array($row)) {
			continue;
		}
		$input = trim((string)($row['calendarInput'] ?? ''));
		$calendarId = extract_calendar_id(trim((string)($row['calendarId'] ?? '')) ?: $input);
		if ($calendarId === '') {
			continue;
		}
		$out[] = [
			'order' => $index + 1,
			'calendarInput' => $input,
			'calendarId' => $calendarId,
			'enabled' => true,
		];
	}
	write_json_txt(data_dir() . '/calendars.txt', $out);
	return $out;
}

function extract_calendar_id(string $input): string {
	$raw = trim($input);
	if ($raw === '') {
		return '';
	}
	if (stripos($raw, 'http') !== 0) {
		return $raw;
	}

	if (preg_match('/[?&]cid=([^&]+)/i', $raw, $m)) {
		return urldecode($m[1]);
	}
	if (preg_match('/[?&]src=([^&]+)/i', $raw, $m)) {
		return urldecode($m[1]);
	}
	return $raw;
}

function get_images(): array {
	ensure_storage_files();
	$rows = read_json_txt(data_dir() . '/images.txt', []);
	if (!is_array($rows)) {
		return [];
	}

	$out = [];
	foreach ($rows as $row) {
		if (!is_array($row)) {
			continue;
		}
		$id = trim((string)($row['id'] ?? ''));
		$filename = basename((string)($row['filename'] ?? ''));
		if ($id === '' || $filename === '') {
			continue;
		}

		$out[] = [
			'id' => $id,
			'filename' => $filename,
			'originalName' => (string)($row['originalName'] ?? $filename),
			'createdAt' => (string)($row['createdAt'] ?? ''),
			'url' => app_url('uploads/' . rawurlencode($filename)),
		];
	}

	usort($out, static function (array $a, array $b): int {
		return strcmp($b['createdAt'], $a['createdAt']);
	});
	return $out;
}

function save_images(array $images): void {
	write_json_txt(data_dir() . '/images.txt', array_values($images));
}

function store_uploaded_images(array $files): array {
	$images = get_images();
	$stored = [];

	$names = $files['name'] ?? [];
	$tmpNames = $files['tmp_name'] ?? [];
	$errors = $files['error'] ?? [];

	foreach ((array)$names as $i => $name) {
		$error = $errors[$i] ?? UPLOAD_ERR_NO_FILE;
		if ($error !== UPLOAD_ERR_OK) {
			continue;
		}

		$tmp = (string)($tmpNames[$i] ?? '');
		if ($tmp === '' || !is_uploaded_file($tmp)) {
			continue;
		}

		$info = @getimagesize($tmp);
		if (!$info || empty($info['mime'])) {
			continue;
		}

		$mime = (string)$info['mime'];
		$ext = image_extension_from_mime($mime);
		if ($ext === '') {
			continue;
		}

		$id = bin2hex(random_bytes(8));
		$filename = $id . '.' . $ext;
		$dest = uploads_dir() . '/' . $filename;
		if (!move_uploaded_file($tmp, $dest)) {
			continue;
		}

		$row = [
			'id' => $id,
			'filename' => $filename,
			'originalName' => trim((string)$name),
			'createdAt' => gmdate('c'),
		];
		$images[] = $row;
		$stored[] = $row;
	}

	save_images($images);
	return $stored;
}

function delete_image(string $id): void {
	$id = trim($id);
	if ($id === '') {
		throw new RuntimeException('画像IDが不正です。');
	}

	$images = get_images();
	$next = [];
	$found = null;

	foreach ($images as $row) {
		if ($row['id'] === $id) {
			$found = $row;
			continue;
		}
		$next[] = $row;
	}

	if (!$found) {
		throw new RuntimeException('対象画像が見つかりません。');
	}

	$file = uploads_dir() . '/' . basename($found['filename']);
	if (is_file($file)) {
		@unlink($file);
	}

	save_images($next);

	$cfg = get_runtime_config();
	$cfg['headerImageIds'] = array_values(array_filter((array)($cfg['headerImageIds'] ?? []), static fn($v) => $v !== $id));
	$cfg['footerImageIds'] = array_values(array_filter((array)($cfg['footerImageIds'] ?? []), static fn($v) => $v !== $id));
	save_runtime_config($cfg);

	$details = get_event_details_config();
	foreach ($details as $i => $detail) {
		if ((string)($detail['catchImageId'] ?? '') === $id) {
			$details[$i]['catchImageId'] = '';
		}
	}
	save_event_details_config($details);
}

function image_extension_from_mime(string $mime): string {
	$map = [
		'image/jpeg' => 'jpg',
		'image/png' => 'png',
		'image/gif' => 'gif',
		'image/webp' => 'webp',
	];
	return $map[$mime] ?? '';
}

function get_selected_images(array $ids, ?array $images = null, int $limit = 3): array {
	$all = $images ?? get_images();
	$map = [];
	foreach ($all as $img) {
		$map[$img['id']] = $img;
	}

	$out = [];
	foreach ((array)$ids as $id) {
		if (isset($map[$id])) {
			$out[] = $map[$id];
		}
	}
	return array_slice($out, 0, max(0, $limit));
}

function get_month_key(int $year, int $month): string {
	return sprintf('%04d-%02d', $year, $month);
}

function month_cache_file(int $year, int $month): string {
	return cache_dir() . '/month-' . get_month_key($year, $month) . '.txt';
}

function get_cached_month_data(int $year, int $month): array {
	$payload = read_json_txt(month_cache_file($year, $month), []);
	if (!is_array($payload)) {
		$payload = [];
	}

	$cfg = get_runtime_config();
	$timezone = (string)($cfg['timezone'] ?? 'Asia/Tokyo');
	[$start, $end] = month_grid_range($year, $month, $timezone);

	return [
		'eventsByDate' => enrich_events_by_date(is_array($payload['eventsByDate'] ?? null) ? $payload['eventsByDate'] : []),
		'holidays' => slice_holidays_map(load_holidays_store(), $start, $end),
		'cacheUpdatedAt' => (string)($payload['cacheUpdatedAt'] ?? ''),
	];
}

function get_manage_month_events(int $year, int $month): array {
	$monthKey = get_month_key($year, $month);
	$details = get_event_detail_map();
	$payload = read_json_txt(month_cache_file($year, $month), []);
	$eventsByDate = is_array($payload['eventsByDate'] ?? null) ? $payload['eventsByDate'] : [];
	$events = [];
	foreach ($eventsByDate as $list) {
		if (!is_array($list)) {
			continue;
		}
		foreach ($list as $event) {
			$event = normalize_cached_event_record($event);
			if ($event === null || !str_starts_with((string)$event['startIso'], $monthKey)) {
				continue;
			}
			$events[] = array_merge($details[(string)$event['id']] ?? default_event_detail(), [
				'eventId' => (string)$event['id'],
				'dateText' => format_cached_event_datetime_text($event),
				'title' => (string)$event['title'],
			]);
		}
	}
	usort($events, static fn(array $a, array $b): int => strcmp((string)$a['dateText'], (string)$b['dateText']));
	return $events;
}

function get_manage_event_copy_sources(int $year, int $month): array {
	$selectedMonth = new DateTime(get_month_key($year, $month) . '-01');
	$sources = [];
	for ($offset = 0; $offset <= 2; $offset++) {
		$sourceMonth = (clone $selectedMonth)->modify('-' . $offset . ' months');
		foreach (get_manage_month_events((int)$sourceMonth->format('Y'), (int)$sourceMonth->format('n')) as $event) {
			$sources[] = $event;
		}
	}
	usort($sources, static fn(array $a, array $b): int => strcmp((string)$b['dateText'], (string)$a['dateText']));
	return $sources;
}

function save_manage_month_event_details(int $year, int $month, array $rows): array {
	$currentEventIds = [];
	foreach (get_manage_month_events($year, $month) as $event) {
		$currentEventIds[(string)$event['eventId']] = true;
	}

	$replacement = [];
	foreach ($rows as $row) {
		if (!is_array($row)) {
			continue;
		}
		$detail = normalize_event_detail_config($row);
		if (isset($currentEventIds[$detail['eventId']])) {
			$replacement[$detail['eventId']] = $detail;
		}
	}

	$merged = [];
	foreach (get_event_details_config() as $detail) {
		if (!isset($currentEventIds[$detail['eventId']])) {
			$merged[] = $detail;
		}
	}
	foreach ($replacement as $detail) {
		$merged[] = $detail;
	}
	return save_event_details_config($merged);
}

function save_cached_month_data(int $year, int $month, array $payload): void {
	write_json_txt(month_cache_file($year, $month), [
		'eventsByDate' => is_array($payload['eventsByDate'] ?? null) ? $payload['eventsByDate'] : [],
		'cacheUpdatedAt' => (string)($payload['cacheUpdatedAt'] ?? gmdate('c')),
	]);
}

function month_grid_range(int $year, int $month, string $timezone): array {
	$tz = new DateTimeZone($timezone);
	$monthStart = new DateTime(sprintf('%04d-%02d-01 00:00:00', $year, $month), $tz);
	$weekday = (int)$monthStart->format('w');

	$start = clone $monthStart;
	if ($weekday > 0) {
		$start->modify('-' . $weekday . ' days');
	}

	$end = clone $start;
	$end->modify('+42 days');

	return [$start, $end];
}

function refresh_month_events(int $year, int $month): array {
	$cfg = get_runtime_config();
	$timezone = $cfg['timezone'] ?? 'Asia/Tokyo';
	[$start, $end] = month_grid_range($year, $month, $timezone);

	$events = build_live_month_events($start, $end, $timezone);
	$holidays = get_holiday_map($year, $start, $end, $timezone, $cfg);

	$payload = [
		'eventsByDate' => $events,
		'holidays' => $holidays,
		'cacheUpdatedAt' => gmdate('c'),
	];

	save_cached_month_data($year, $month, $payload);
	$payload['eventsByDate'] = enrich_events_by_date($payload['eventsByDate']);
	return $payload;
}

function build_live_month_events(DateTime $start, DateTime $end, string $timezone): array {
	$cfg = load_app_config();
	$apiKey = trim((string)($cfg['google_api_key'] ?? ''));
	if ($apiKey === '') {
		return [];
	}

	$calendars = get_calendars(false);
	$out = [];

	foreach ($calendars as $cal) {
		$events = fetch_google_calendar_events($apiKey, (string)$cal['calendarId'], $start, $end);
		foreach ($events as $ev) {
			$dateKey = $ev['dateKey'];
			if (!isset($out[$dateKey])) {
				$out[$dateKey] = [];
			}
			$out[$dateKey][] = [
				'id' => $ev['id'],
				'calendarId' => $cal['calendarId'],
				'calendarName' => $ev['calendarName'] ?: ($cal['calendarId'] ?? ''),
				'title' => $ev['title'],
				'startIso' => $ev['startIso'],
				'endIso' => $ev['endIso'],
				'isAllDay' => $ev['isAllDay'],
				'location' => $ev['location'],
				'description' => $ev['description'],
			];
		}
	}

	foreach ($out as $dateKey => $list) {
		usort($list, static function (array $a, array $b): int {
			return strcmp((string)$a['startIso'], (string)$b['startIso']);
		});
		$out[$dateKey] = $list;
	}

	return $out;
}

function fetch_google_calendar_events(string $apiKey, string $calendarId, DateTime $start, DateTime $end): array {
	$query = http_build_query([
		'singleEvents' => 'true',
		'orderBy' => 'startTime',
		'timeMin' => $start->format(DateTimeInterface::RFC3339),
		'timeMax' => $end->format(DateTimeInterface::RFC3339),
		'maxResults' => 2500,
		'key' => $apiKey,
	]);

	$url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events?' . $query;
	$res = http_get_json($url);
	if (!is_array($res) || !is_array($res['items'] ?? null)) {
		return [];
	}

	$timeZone = new DateTimeZone($start->getTimezone()->getName());
	$calendarName = (string)($res['summary'] ?? '');
	$out = [];

	foreach ($res['items'] as $item) {
		if (!is_array($item)) {
			continue;
		}
		if (($item['status'] ?? '') === 'cancelled') {
			continue;
		}

		$startInfo = is_array($item['start'] ?? null) ? $item['start'] : [];
		$endInfo = is_array($item['end'] ?? null) ? $item['end'] : [];

		$isAllDay = isset($startInfo['date']) && !isset($startInfo['dateTime']);
		if ($isAllDay) {
			$startDate = (string)($startInfo['date'] ?? '');
			$endDate = (string)($endInfo['date'] ?? $startDate);
			if ($startDate === '') {
				continue;
			}
			$startDt = new DateTime($startDate . ' 00:00:00', $timeZone);
			$endDt = new DateTime(($endDate ?: $startDate) . ' 00:00:00', $timeZone);
			$dateKey = $startDt->format('Y-m-d');
			$startIso = $startDt->format(DateTimeInterface::RFC3339);
			$endIso = $endDt->format(DateTimeInterface::RFC3339);
		} else {
			$startRaw = (string)($startInfo['dateTime'] ?? '');
			$endRaw = (string)($endInfo['dateTime'] ?? '');
			if ($startRaw === '' || $endRaw === '') {
				continue;
			}
			$startDt = new DateTime($startRaw);
			$endDt = new DateTime($endRaw);
			$displayStart = (clone $startDt)->setTimezone($timeZone);
			$dateKey = $displayStart->format('Y-m-d');
			$startIso = $startDt->format(DateTimeInterface::RFC3339);
			$endIso = $endDt->format(DateTimeInterface::RFC3339);
		}

		$out[] = [
			'id' => (string)($item['id'] ?? ''),
			'calendarName' => $calendarName,
			'title' => trim((string)($item['summary'] ?? '')) ?: '(無題)',
			'startIso' => $startIso,
			'endIso' => $endIso,
			'isAllDay' => $isAllDay,
			'location' => (string)($item['location'] ?? ''),
			'description' => (string)($item['description'] ?? ''),
			'dateKey' => $dateKey,
		];
	}

	return $out;
}

function get_holiday_map(int $year, DateTime $start, DateTime $end, string $timezone, array $cfg): array {
	$holidays = load_holidays_store();
	$fetched = fetch_holiday_map_from_google($year, $timezone);
	$prefix = sprintf('%04d-', $year);

	foreach (array_keys($holidays) as $key) {
		if (strpos((string)$key, $prefix) === 0) {
			unset($holidays[$key]);
		}
	}

	foreach ($fetched as $key => $name) {
		$holidays[$key] = $name;
	}

	ksort($holidays);
	write_json_txt(data_dir() . '/holidays.txt', $holidays);

	return slice_holidays_map($holidays, $start, $end);
}

function load_holidays_store(): array {
	$holidays = read_json_txt(data_dir() . '/holidays.txt', []);
	if (!is_array($holidays)) {
		return [];
	}

	$out = [];
	foreach ($holidays as $dateKey => $name) {
		$key = trim((string)$dateKey);
		if ($key === '') {
			continue;
		}
		$out[$key] = (string)$name;
	}

	ksort($out);
	return $out;
}

function slice_holidays_map(array $holidays, DateTime $start, DateTime $end): array {
	$fromKey = $start->format('Y-m-d');
	$toKey = (clone $end)->modify('-1 second')->format('Y-m-d');
	$slice = [];

	foreach ($holidays as $dateKey => $name) {
		$key = (string)$dateKey;
		if ($key < $fromKey || $key > $toKey) {
			continue;
		}
		$slice[$key] = (string)$name;
	}

	return $slice;
}

function fetch_holiday_map_from_google(int $year, string $timezone): array {
	$cfg = load_app_config();
	$apiKey = trim((string)($cfg['google_api_key'] ?? ''));
	if ($apiKey === '') {
		return [];
	}

	$tz = new DateTimeZone($timezone ?: 'Asia/Tokyo');
	$start = new DateTime(sprintf('%04d-01-01 00:00:00', $year), $tz);
	$end = new DateTime(sprintf('%04d-01-01 00:00:00', $year + 1), $tz);

	$events = fetch_google_calendar_events($apiKey, HOLIDAY_CALENDAR_ID, $start, $end);
	$out = [];
	foreach ($events as $ev) {
		$out[$ev['dateKey']] = $ev['title'] ?: '祝日';
	}
	ksort($out);
	return $out;
}

function load_app_config(): array {
	$path = private_dir() . '/app_config.php';
	if (!is_file($path)) {
		throw new RuntimeException('private/app_config.php が見つかりません。');
	}

	$cfg = require $path;
	if (!is_array($cfg)) {
		throw new RuntimeException('app_config.php の形式が不正です。');
	}

	return $cfg;
}

function normalize_bool($value, bool $fallback): bool {
	if ($value === true || $value === 'true' || $value === 1 || $value === '1') {
		return true;
	}
	if ($value === false || $value === 'false' || $value === 0 || $value === '0') {
		return false;
	}
	return $fallback;
}

function sanitize_url(string $url): string {
	$url = trim($url);
	if ($url === '') {
		return '';
	}
	if (preg_match('/^https?:\/\//i', $url)) {
		return $url;
	}
	return '';
}

function strip_capacity_tag(string $text): string {
	return trim((string)preg_replace('/\[\[\d+\/\d+\]\]/', '', $text));
}

function infer_event_category(array $event): string {
	$haystack = (string)($event['title'] ?? '') . ' ' . (string)($event['calendarName'] ?? '');
	if (preg_match('/オンライン|Zoom|zoom/u', $haystack)) {
		return 'オンライン';
	}
	if (preg_match('/セミナー|講座|勉強/u', $haystack)) {
		return 'セミナー';
	}
	if (preg_match('/交流|座談|PR/u', $haystack)) {
		return '交流会';
	}
	if (preg_match('/チャレンジ|ピッチ|挑戦/u', $haystack)) {
		return 'チャレンジ';
	}
	return 'イベント';
}

function is_non_empty_string($value): bool {
	return trim((string)$value) !== '';
}

function json_response(array $payload, int $status = 200): void {
	http_response_code($status);
	header('Content-Type: application/json; charset=UTF-8');
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function get_request_json(): array {
	$raw = file_get_contents('php://input') ?: '';
	if (trim($raw) === '') {
		return [];
	}
	$decoded = json_decode($raw, true);
	return is_array($decoded) ? $decoded : [];
}

function http_get_json(string $url): ?array {
	$context = stream_context_create([
		'http' => [
			'timeout' => 15,
			'ignore_errors' => true,
			'header' => "Accept: application/json\r\n",
		],
	]);

	$res = @file_get_contents($url, false, $context);
	if ($res === false) {
		return null;
	}

	$decoded = json_decode($res, true);
	return is_array($decoded) ? $decoded : null;
}

function bootstrap_calendar_payload(): array {
	$cfg = get_runtime_config();
	$now = new DateTime('now', new DateTimeZone($cfg['timezone']));
	$year = (int)$now->format('Y');
	$month = (int)$now->format('n');

	return [
		'page' => 'calendar',
		'config' => [
			'timezone' => $cfg['timezone'],
			'assetBaseUrl' => app_url('assets/images/'),
		],
		'recentEvents' => resolve_recent_events_payload(),
		'calendars' => get_calendars(false),
		'cacheData' => get_cached_month_data($year, $month),
		'adminUrl' => app_url('manage.php'),
		'calendarUrl' => app_url('index.php'),
	];
}

function ensure_admin_session_started(): void {
	if (session_status() !== PHP_SESSION_ACTIVE) {
		session_start();
	}
}

function is_admin_logged_in(): bool {
	ensure_admin_session_started();
	return !empty($_SESSION['admin_logged_in']);
}

function admin_login(string $username, string $password): bool {
	$cfg = load_app_config();
	$expectedUser = (string)($cfg['manage_user'] ?? 'admin');
	$hash = (string)($cfg['manage_password_hash'] ?? '');

	if (!hash_equals($expectedUser, $username)) {
		return false;
	}

	if ($hash === '' || !password_verify($password, $hash)) {
		return false;
	}

	ensure_admin_session_started();
	$_SESSION['admin_logged_in'] = true;
	$_SESSION['admin_user'] = $username;
	return true;
}

function admin_logout(): void {
	ensure_admin_session_started();
	$_SESSION = [];
	if (ini_get('session.use_cookies')) {
		$params = session_get_cookie_params();
		setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
	}
	session_destroy();
}

function require_admin_or_json_error(): void {
	if (!is_admin_logged_in()) {
		json_response(['ok' => false, 'message' => '認証が必要です。'], 403);
	}
}
