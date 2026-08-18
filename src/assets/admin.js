(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');

	const state = {
		config: {},
		calendars: [],
		images: [],
		eventDetails: [],
		eventOptions: [],
	};

	renderShell();
	loadAdminData();

	function apiUrl(action) {
		const url = new URL(boot.apiUrl || 'api.php', window.location.href);
		url.searchParams.set('action', action);
		return url.toString();
	}

	function fetchJson(url, options) {
		return fetch(url, options || {}).then((res) => res.json().catch(() => ({})).then((body) => {
			if (!res.ok || !body || body.ok === false) throw new Error(body.message || 'APIエラー');
			return body;
		}));
	}

	function renderShell() {
		app.innerHTML = [
			'<div class="admin-v2">',
			'  <header class="admin-header-v2">',
			'    <div><h1>管理ページ</h1><p>イベント情報を編集します。</p></div>',
			'    <div class="admin-actions-v2"><button class="btn" id="toCalendarBtn">カレンダーへ</button><a class="btn" href="' + esc(boot.logoutUrl || 'manage.php?logout=1') + '">ログアウト</a></div>',
			'  </header>',
			'  <section class="card"><h2>カレンダー設定</h2><div id="calendarRows"></div></section>',
			'  <section class="card"><h2>画像管理</h2><div class="row"><label>キャッチ画像ファイル</label><input id="uploadImages" type="file" accept="image/*" multiple></div><button class="btn" id="uploadBtn">アップロード</button><div id="imageList" class="admin-image-list"></div></section>',
			'  <section class="card"><h2>全予定の詳細情報</h2><div id="eventDetailRows"></div></section>',
			'  <button class="btn primary-admin-save" id="saveBtn">保存</button>',
			'  <div class="msg" id="status"></div>',
			'</div>',
			'<div class="blocking-overlay" id="blockingOverlay"><div class="loading-panel"><div class="loading-spinner"></div><div id="loadingText">読み込み中</div></div></div>',
		].join('');

		document.getElementById('saveBtn').addEventListener('click', save);
		document.getElementById('toCalendarBtn').addEventListener('click', () => window.location.assign(boot.calendarUrl || 'index.php'));
		document.getElementById('uploadBtn').addEventListener('click', uploadImages);
	}

	function loadAdminData() {
		showBlockingOverlay('設定読み込み中');
		fetchJson(apiUrl('get_admin_data'))
			.then((res) => {
				state.config = res.config || {};
				state.calendars = (res.calendars || []).slice(0, 5);
				state.images = Array.isArray(res.images) ? res.images : [];
				state.eventDetails = Array.isArray(res.eventDetails) ? res.eventDetails : [];
				state.eventOptions = Array.isArray(res.eventOptions) ? res.eventOptions : [];
				fillForm();
				hideBlockingOverlay();
				setStatus('');
			})
			.catch((err) => {
				hideBlockingOverlay();
				setStatus(err.message || String(err), true);
			});
	}

	function fillForm() {
		renderCalendarRows();
		renderImageList();
		renderEventDetailRows();
	}

	function renderCalendarRows() {
		const holder = document.getElementById('calendarRows');
		const rows = [];
		for (let i = 0; i < 5; i++) {
			const data = state.calendars[i] || {};
			rows.push(
				'<div class="admin-row-pair">' +
				'<div class="row"><label>カレンダーURL/ID ' + (i + 1) + '</label><input data-cal-input="' + i + '" value="' + esc(data.calendarInput || data.calendarId || '') + '"></div>' +
				'<div class="row"><label>有効</label><select data-cal-enabled="' + i + '"><option value="true"' + (data.enabled === false ? '' : ' selected') + '>有効</option><option value="false"' + (data.enabled === false ? ' selected' : '') + '>無効</option></select></div>' +
				'</div>'
			);
		}
		holder.innerHTML = rows.join('');
	}

	function renderImageList() {
		const holder = document.getElementById('imageList');
		if (!state.images.length) {
			holder.innerHTML = '<div class="msg">画像はまだありません。</div>';
			return;
		}
		holder.innerHTML = state.images.map((img) => [
			'<div class="admin-image-row">',
			'  <img src="' + esc(img.url) + '" alt="">',
			'  <span>' + esc(img.originalName || img.filename) + '</span>',
			'  <button class="btn" data-delete-image="' + esc(img.id) + '">削除</button>',
			'</div>',
		].join('')).join('');
		holder.querySelectorAll('[data-delete-image]').forEach((btn) => {
			btn.addEventListener('click', () => removeImage(btn.getAttribute('data-delete-image')));
		});
	}

	function renderEventDetailRows() {
		const holder = document.getElementById('eventDetailRows');
		const detailMap = buildDetailMap();
		holder.innerHTML = state.eventOptions.map((option, i) => {
			const eventId = String(option.eventId || '');
			const d = detailMap[eventId] || {};
			return [
				'<details class="event-detail-admin" data-detail-index="' + i + '">',
				'  <summary><span>' + esc(option.label || eventId) + '</span><strong>' + esc(d.categoryText || '') + '</strong></summary>',
				'  <input type="hidden" data-detail-event-id="' + i + '" value="' + esc(eventId) + '">',
				'  <div class="admin-row-pair"><div class="row"><label>カテゴリ</label><input data-detail-category-text="' + i + '" value="' + esc(d.categoryText || '') + '" placeholder="セミナー / 交流会 など"></div>',
				'  <div class="row"><label>キャッチ画像</label>' + imageSelectHtml('data-detail-catch-image-id="' + i + '"', d.catchImageId || '') + '</div></div>',
				'  <div class="row"><label>詳細ページ見出し</label><input data-detail-hero-title="' + i + '" value="' + esc(d.heroTitle || '') + '"></div>',
				'  <div class="row"><label>サブコピー</label><input data-detail-hero-subtitle="' + i + '" value="' + esc(d.heroSubtitle || '') + '"></div>',
				'  <div class="admin-row-pair"><div class="row"><label>残り人数</label><input data-detail-remaining-text="' + i + '" value="' + esc(d.remainingText || '') + '"></div>',
				'  <div class="row"><label>定員</label><input data-detail-capacity-text="' + i + '" value="' + esc(d.capacityText || '') + '"></div></div>',
				'  <div class="admin-row-pair"><div class="row"><label>参加費</label><input data-detail-fee-text="' + i + '" value="' + esc(d.feeText || '') + '"></div>',
				'  <div class="row"><label>会場</label><input data-detail-venue-text="' + i + '" value="' + esc(d.venueText || '') + '"></div></div>',
				'  <div class="admin-row-pair"><div class="row"><label>主催</label><input data-detail-organizer-text="' + i + '" value="' + esc(d.organizerText || '') + '"></div>',
				'  <div class="row"><label>申込URL</label><input data-detail-apply-url="' + i + '" value="' + esc(d.applyUrl || '') + '" placeholder="https://..."></div></div>',
				'  <div class="row"><label>説明文</label><textarea data-detail-description-text="' + i + '" rows="5">' + esc(d.descriptionText || '') + '</textarea></div>',
				'  <div class="row"><label>こんな方におすすめ（1行1項目）</label><textarea data-detail-recommendations-text="' + i + '" rows="4">' + esc(d.recommendationsText || '') + '</textarea></div>',
				'  <div class="row"><label>当日の流れ（1行1項目）</label><textarea data-detail-flow-text="' + i + '" rows="4">' + esc(d.flowText || '') + '</textarea></div>',
				'  <div class="row"><label>注意事項（1行1項目）</label><textarea data-detail-notes-text="' + i + '" rows="3">' + esc(d.notesText || '') + '</textarea></div>',
				'</details>',
			].join('');
		}).join('');
	}

	function imageSelectHtml(attr, selectedId) {
		const options = ['<option value="">未選択</option>'].concat(state.images.map((img) => {
			return '<option value="' + esc(img.id) + '"' + (String(img.id) === String(selectedId) ? ' selected' : '') + '>' + esc(img.originalName || img.filename) + '</option>';
		}));
		return '<select ' + attr + '>' + options.join('') + '</select>';
	}

	function buildDetailMap() {
		const map = {};
		state.eventDetails.forEach((item) => {
			const eventId = String(item.eventId || '');
			if (eventId) map[eventId] = item;
		});
		return map;
	}

	function collectCalendars() {
		const out = [];
		for (let i = 0; i < 5; i++) {
			const input = document.querySelector('[data-cal-input="' + i + '"]');
			const enabled = document.querySelector('[data-cal-enabled="' + i + '"]');
			out.push({ calendarInput: (input && input.value.trim()) || '', enabled: !enabled || enabled.value === 'true' });
		}
		return out;
	}

	function collectEventDetails() {
		const out = [];
		for (let i = 0; i < state.eventOptions.length; i++) {
			const eventId = valueOf('[data-detail-event-id="' + i + '"]');
			if (!eventId) continue;
			const row = {
				eventId,
				catchImageId: valueOf('[data-detail-catch-image-id="' + i + '"]'),
				categoryText: valueOf('[data-detail-category-text="' + i + '"]'),
				heroTitle: valueOf('[data-detail-hero-title="' + i + '"]'),
				heroSubtitle: valueOf('[data-detail-hero-subtitle="' + i + '"]'),
				descriptionText: valueOf('[data-detail-description-text="' + i + '"]'),
				remainingText: valueOf('[data-detail-remaining-text="' + i + '"]'),
				capacityText: valueOf('[data-detail-capacity-text="' + i + '"]'),
				feeText: valueOf('[data-detail-fee-text="' + i + '"]'),
				venueText: valueOf('[data-detail-venue-text="' + i + '"]'),
				organizerText: valueOf('[data-detail-organizer-text="' + i + '"]'),
				applyUrl: valueOf('[data-detail-apply-url="' + i + '"]'),
				recommendationsText: valueOf('[data-detail-recommendations-text="' + i + '"]'),
				flowText: valueOf('[data-detail-flow-text="' + i + '"]'),
				notesText: valueOf('[data-detail-notes-text="' + i + '"]'),
			};
			const hasManualValue = Object.keys(row).some((key) => key !== 'eventId' && row[key]);
			if (hasManualValue) out.push(row);
		}
		return out;
	}

	function valueOf(selector) {
		const el = document.querySelector(selector);
		return (el && el.value) ? el.value.trim() : '';
	}

	function save() {
		const payload = {
			timezone: 'Asia/Tokyo',
			calendars: collectCalendars(),
			eventDetails: collectEventDetails(),
		};
		setStatus('保存中...');
		fetchJson(apiUrl('save_admin_data'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		}).then((res) => {
			state.eventDetails = payload.eventDetails;
			setStatus((res && res.message) || '保存しました。', false, true);
		}).catch((err) => setStatus(err.message || String(err), true));
	}

	function uploadImages() {
		const files = document.getElementById('uploadImages').files;
		if (!files || !files.length) {
			setStatus('画像を選択してください。', true);
			return;
		}
		const fd = new FormData();
		Array.from(files).forEach((file) => fd.append('images[]', file));
		setStatus('アップロード中...');
		fetchJson(apiUrl('upload_image'), { method: 'POST', body: fd })
			.then(() => {
				document.getElementById('uploadImages').value = '';
				setStatus('アップロードしました。', false, true);
				loadAdminData();
			})
			.catch((err) => setStatus(err.message || String(err), true));
	}

	function removeImage(id) {
		if (!id) return;
		setStatus('削除中...');
		fetchJson(apiUrl('delete_image'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id }),
		}).then(() => {
			setStatus('削除しました。', false, true);
			loadAdminData();
		}).catch((err) => setStatus(err.message || String(err), true));
	}

	function showBlockingOverlay(message) {
		const overlay = document.getElementById('blockingOverlay');
		if (!overlay) return;
		const text = document.getElementById('loadingText');
		if (text) text.textContent = message || '読み込み中';
		overlay.classList.add('is-visible');
	}

	function hideBlockingOverlay() {
		const overlay = document.getElementById('blockingOverlay');
		if (overlay) overlay.classList.remove('is-visible');
	}

	function setStatus(msg, isError, isOk) {
		const el = document.getElementById('status');
		if (!el) return;
		el.textContent = msg || '';
		el.className = 'msg ' + (isError ? 'err' : isOk ? 'ok' : '');
	}

	function esc(s) {
		return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
})();
