<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$action = trim((string)($_GET['action'] ?? ''));

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
					'recentEvents' => get_recent_events_config(),
					'eventOptions' => get_cached_event_options(),
				]);
				break;
			}

		case 'save_admin_data': {
				require_admin_or_json_error();
				$payload = get_request_json();
				$cfg = save_runtime_config([
					'headerRotationSec' => $payload['headerRotationSec'] ?? 6,
					'timezone' => $payload['timezone'] ?? 'Asia/Tokyo',
					'headerImageIds' => (array)($payload['headerImageIds'] ?? []),
					'footerImageIds' => (array)($payload['footerImageIds'] ?? []),
				]);
				save_calendars((array)($payload['calendars'] ?? []));
				save_recent_events_config((array)($payload['recentEvents'] ?? []));
				json_response(['ok' => true, 'message' => '保存しました。', 'config' => $cfg]);
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
} catch (Throwable $e) {
	json_response(['ok' => false, 'message' => $e->getMessage()], 500);
}
