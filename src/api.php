<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$action = trim((string)($_GET['action'] ?? ''));

function event_csv_columns(): array {
	return [
		'eventId' => 'イベントID',
		'eventType' => 'イベント種別',
		'dateText' => '開催日時',
		'title' => 'イベント名',
		'imageFilename' => 'アイキャッチ画像',
		'detailSubtitle' => '詳細画面用簡易説明',
		'timeText' => '時間',
		'locationText' => '場所',
		'capacityText' => '定員',
		'remainingText' => '残り人数',
		'applyUrl' => '申し込みフォームURL',
		'recommended' => 'おすすめイベント',
		'shortTitle' => 'おすすめイベント用タイトル',
		'shortDescription' => 'おすすめイベント用説明',
	];
}

function event_csv_value(array $row, string $field): string {
	if ($field === 'recommended') {
		return normalize_bool($row[$field] ?? false, false) ? '1' : '0';
	}
	if ($field === 'imageFilename') {
		$filename = trim((string)($row[$field] ?? ''));
		foreach (get_images() as $image) {
			if ((string)($image['filename'] ?? '') === $filename) {
				return trim((string)($image['originalName'] ?? $filename));
			}
		}
	}
	return trim((string)($row[$field] ?? ''));
}

function normalize_event_csv_rows(array $rows): array {
	$images = [];
	foreach (get_images() as $image) {
		$originalName = trim((string)($image['originalName'] ?? ''));
		$filename = trim((string)($image['filename'] ?? ''));
		if ($originalName !== '' && $filename !== '') {
			$images[$originalName] = $filename;
		}
	}
	foreach ($rows as &$row) {
		$imageName = trim((string)($row['imageFilename'] ?? ''));
		if ($imageName !== '') {
			$row['imageFilename'] = $images[$imageName] ?? $imageName;
		}
	}
	unset($row);
	return $rows;
}

function read_event_csv_rows(array $file): array {
	if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
		throw new InvalidArgumentException('CSVファイルを読み込めません。');
	}
	$handle = fopen((string)$file['tmp_name'], 'rb');
	if ($handle === false) {
		throw new InvalidArgumentException('CSVファイルを開けません。');
	}
	try {
		$header = fgetcsv($handle);
		if (!is_array($header)) {
			throw new InvalidArgumentException('CSVにヘッダー行がありません。');
		}
		$header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string)$header[0]);
		$columns = event_csv_columns();
		$headerMap = [];
		foreach ($header as $index => $name) {
			$field = array_search(trim((string)$name), $columns, true);
			if ($field !== false) {
				$headerMap[$index] = $field;
			}
		}
		$rows = [];
		while (($values = fgetcsv($handle)) !== false) {
			if ($values === [null] || count(array_filter($values, static fn($value): bool => trim((string)$value) !== '')) === 0) {
				continue;
			}
			$row = [];
			foreach ($headerMap as $index => $field) {
				$row[$field] = $values[$index] ?? '';
			}
			$rows[] = $row;
		}
		return $rows;
	} finally {
		fclose($handle);
	}
}

try {
	ensure_storage_files();

	switch ($action) {
		case 'get_cached_month_events': {
				$year = (int)($_GET['year'] ?? 0);
				$month = (int)($_GET['month'] ?? 0);
				if ($year < 1970 || $month < 1 || $month > 12) {
					json_response(['ok' => false, 'message' => '年月パラメータが不正です。'], 400);
				}
				$data = get_cached_month_data($year, $month);
				json_response(['ok' => true, 'year' => $year, 'month' => $month] + $data);
				break;
			}

		case 'refresh_month_events': {
				$year = (int)($_GET['year'] ?? 0);
				$month = (int)($_GET['month'] ?? 0);
				if ($year < 1970 || $month < 1 || $month > 12) {
					json_response(['ok' => false, 'message' => '年月パラメータが不正です。'], 400);
				}
				$data = refresh_month_events($year, $month);
				json_response(['ok' => true, 'year' => $year, 'month' => $month] + $data);
				break;
			}

		case 'get_admin_data': {
				require_admin_or_json_error();
				$cfg = get_runtime_config();
				$images = get_images();
				json_response([
					'ok' => true,
					'config' => $cfg,
					'calendars' => get_calendars(true),
					'images' => $images,
					'eventDetails' => get_event_details_config(),
					'eventOptions' => get_cached_event_options(),
				]);
				break;
			}

		case 'get_manage_data': {
				require_admin_or_json_error();
				$page = trim((string)($_GET['page'] ?? ''));
				if ($page === 'calendars') {
					json_response(['ok' => true, 'calendars' => get_calendars(true)]);
				}
				if ($page === 'images') {
					json_response(['ok' => true, 'images' => get_images()]);
				}
				if ($page === 'events') {
					json_response([
						'ok' => true,
						'eventDetails' => get_event_details_config(),
						'eventOptions' => get_cached_event_options(),
						'images' => get_images(),
					]);
				}
				json_response(['ok' => false, 'message' => 'ページが不正です。'], 400);
				break;
			}

		case 'download_event_csv': {
				require_admin_or_json_error();
				$columns = event_csv_columns();
				$details = get_event_detail_map();
				$timezone = new DateTimeZone((string)(get_runtime_config()['timezone'] ?? 'Asia/Tokyo'));
				$csvStart = new DateTime('first day of this month', $timezone);
				$csvStart->modify('-4 months');
				header('Content-Type: text/csv; charset=UTF-8');
				header('Content-Disposition: attachment; filename="events.csv"');
				echo "\xEF\xBB\xBF";
				$handle = fopen('php://output', 'wb');
				fputcsv($handle, array_values($columns));
				foreach (get_cached_event_options() as $event) {
					$eventStart = parse_event_datetime((string)($event['startIso'] ?? ''));
					if (!$eventStart || $eventStart < $csvStart) {
						continue;
					}
					$row = array_merge($event, $details[(string)$event['eventId']] ?? default_event_detail());
					$row['dateText'] = (string)($event['defaultDateText'] ?? '');
					fputcsv($handle, array_map(static fn(string $field): string => event_csv_value($row, $field), array_keys($columns)));
				}
				fclose($handle);
				exit;
			}

		case 'upload_event_csv': {
				require_admin_or_json_error();
				if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
					json_response(['ok' => false, 'message' => 'POSTで送信してください。'], 405);
				}
				$rows = normalize_event_csv_rows(read_event_csv_rows($_FILES['csv'] ?? []));
				$saved = save_event_details_config($rows);
				foreach (glob(data_dir() . '/event_details-????-??.txt') ?: [] as $legacyFile) {
					if (!unlink($legacyFile)) {
						throw new RuntimeException('旧月別イベント設定を削除できません。');
					}
				}
				json_response(['ok' => true, 'message' => count($saved) . '件を保存しました。', 'count' => count($saved)]);
			}

		case 'save_manage_data': {
				require_admin_or_json_error();
				$payload = get_request_json();
				$page = trim((string)($payload['page'] ?? ''));
				if ($page === 'calendars') {
					save_calendars((array)($payload['calendars'] ?? []));
				} else {
					json_response(['ok' => false, 'message' => '保存対象が不正です。'], 400);
				}
				json_response(['ok' => true, 'message' => '保存しました。']);
				break;
			}

		case 'save_admin_data': {
				require_admin_or_json_error();
				$payload = get_request_json();
				$cfg = save_runtime_config([
					'timezone' => $payload['timezone'] ?? 'Asia/Tokyo',
				]);
				save_calendars((array)($payload['calendars'] ?? []));
				save_event_details_config((array)($payload['eventDetails'] ?? []));
				json_response(['ok' => true, 'message' => '保存しました。', 'config' => $cfg]);
				break;
			}

		case 'get_event_detail': {
				$eventId = trim((string)($_GET['eventId'] ?? ''));
				$event = find_event_by_id($eventId);
				if (!$event) {
					json_response(['ok' => false, 'message' => '予定が見つかりません。'], 404);
				}
				json_response(['ok' => true, 'event' => $event]);
				break;
			}

		case 'upload_image': {
				require_admin_or_json_error();
				if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
					json_response(['ok' => false, 'message' => 'POSTで送信してください。'], 405);
				}
				$files = $_FILES['images'] ?? null;
				if (!$files) {
					json_response(['ok' => false, 'message' => '画像が指定されていません。'], 400);
				}
				$stored = store_uploaded_images($files);
				json_response(['ok' => true, 'storedCount' => count($stored)]);
				break;
			}

		case 'delete_image': {
				require_admin_or_json_error();
				$payload = get_request_json();
				delete_image((string)($payload['id'] ?? ''));
				json_response(['ok' => true, 'message' => '削除しました。']);
				break;
			}

		default:
			json_response(['ok' => false, 'message' => 'actionが不正です。'], 404);
	}
} catch (InvalidArgumentException $e) {
	json_response(['ok' => false, 'message' => $e->getMessage()], 400);
} catch (Throwable $e) {
	json_response(['ok' => false, 'message' => $e->getMessage()], 500);
}
