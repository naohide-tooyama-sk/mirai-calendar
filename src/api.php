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
					'eventDetails' => get_event_details_config(),
					'eventOptions' => get_cached_event_options(),
				]);
				break;
			}

		case 'get_manage_data': {
				require_admin_or_json_error();
				$page = trim((string)($_GET['page'] ?? ''));
				$month = trim((string)($_GET['month'] ?? ''));
				if ($page === 'calendars') {
					json_response(['ok' => true, 'calendars' => get_calendars(true)]);
				}
				if ($page === 'images') {
					json_response(['ok' => true, 'images' => get_images()]);
				}
				if ($page === 'templates') {
					json_response(['ok' => true, 'templates' => get_event_templates(), 'images' => get_images()]);
				}
				if ($page === 'events') {
					if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
						json_response(['ok' => false, 'message' => '年月を指定してください。'], 400);
					}
					json_response([
						'ok' => true,
						'eventDetails' => get_event_details_config($month),
						'eventOptions' => get_cached_event_options(),
						'templates' => get_event_templates(),
						'images' => get_images(),
					]);
				}
				json_response(['ok' => false, 'message' => 'ページが不正です。'], 400);
				break;
			}

		case 'save_manage_data': {
				require_admin_or_json_error();
				$payload = get_request_json();
				$page = trim((string)($payload['page'] ?? ''));
				if ($page === 'calendars') {
					save_calendars((array)($payload['calendars'] ?? []));
				} elseif ($page === 'templates') {
					save_event_templates((array)($payload['templates'] ?? []));
				} elseif ($page === 'events') {
					$month = trim((string)($payload['month'] ?? ''));
					if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
						json_response(['ok' => false, 'message' => '年月を指定してください。'], 400);
					}
					save_event_details_config((array)($payload['eventDetails'] ?? []), $month);
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
} catch (Throwable $e) {
	json_response(['ok' => false, 'message' => $e->getMessage()], 500);
}
