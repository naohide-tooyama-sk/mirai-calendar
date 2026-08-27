<?php

declare(strict_types=1);

function event_type_definitions(): array {
	return [
		'study' => '勉強会',
		'networking' => '交流会',
		'seminar' => 'セミナー',
		'challenge' => 'チャレンジ',
		'online' => 'オンライン',
	];
}

function purpose_type_definitions(): array {
	return [
		'networking' => '手軽に交流したい',
		'connections' => '人脈を増やしたい',
		'promotion' => '事業や自分をPRしたい',
		'startup' => '起業したい',
		'study' => 'ビジネスを学びたい',
		'sports' => '体を動かしたい',
	];
}
