(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const today = new Date();
	const state = { calendars: [], images: [], events: [], copySources: [], eventYear: Math.min(2036, Math.max(2026, today.getFullYear())), eventMonth: today.getMonth() + 1 };

	render();
	load();

	function apiUrl(action, params) {
		const url = new URL(boot.apiUrl || 'api.php', window.location.href);
		url.searchParams.set('action', action);
		Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
		return url.toString();
	}

	function request(url, options) {
		return fetch(url, options).then((res) => res.json().catch(() => ({})).then((body) => {
			if (!res.ok || !body || body.ok === false) throw new Error(body.message || 'APIエラー');
			return body;
		}));
	}

	function render() {
		app.innerHTML = '<div class="admin-v2"><header class="admin-header-v2"><div class="admin-title-v2"><a class="admin-back-button" href="' + esc(boot.topUrl || 'manage.php') + '" aria-label="設定トップへ" title="設定トップへ">←</a><h1>' + esc(boot.title || '設定') + '</h1></div></header><div id="content"></div><div class="msg" id="status"></div></div><div class="image-modal" id="imageModal" hidden><button class="image-modal-close" type="button" aria-label="閉じる">×</button><img id="modalImage" alt=""></div>';
		document.getElementById('imageModal').addEventListener('click', (event) => { if (event.target.id === 'imageModal' || event.target.className === 'image-modal-close') closeModal(); });
	}

	function load() {
		if (boot.page === 'events') return loadEvents(state.eventYear, state.eventMonth);
		const params = { page: boot.page };
		request(apiUrl('get_manage_data', params)).then((data) => {
			Object.assign(state, data);
			renderPage();
		}).catch((error) => setStatus(error.message, true));
	}

	function renderPage() {
		if (boot.page === 'calendars') renderCalendars();
		if (boot.page === 'images') renderImages();
		if (boot.page === 'events') renderEventManager();
	}

	function renderCalendars() {
		const rows = Array.from({ length: 10 }, (_, index) => '<div class="row"><label>カレンダーURL/ID ' + (index + 1) + '</label><input data-calendar="' + index + '" value="' + esc((state.calendars[index] || {}).calendarInput || '') + '"></div>').join('');
		content('<section class="card"><p>URLまたはIDを入力したカレンダーを表示します。</p>' + rows + '</section>' + saveButton());
		document.getElementById('saveBtn').addEventListener('click', () => save({ calendars: Array.from({ length: 10 }, (_, index) => ({ calendarInput: value('[data-calendar="' + index + '"]') })) }));
	}

	function renderImages() {
		const images = state.images.length ? state.images.map((image) => '<div class="admin-image-row"><button type="button" class="image-thumb" data-preview="' + esc(image.url) + '"><img src="' + esc(image.url) + '" alt="' + esc(image.originalName || image.filename) + '"></button><span>' + esc(image.originalName || image.filename) + '</span><button class="btn" data-delete="' + esc(image.id) + '">削除</button></div>').join('') : '<div class="msg">画像はまだありません。</div>';
		content('<section class="card"><div class="row"><label>画像ファイル</label><input id="uploadImages" type="file" accept="image/*" multiple></div><button class="btn" id="uploadBtn">アップロード</button><div class="admin-image-list">' + images + '</div></section>');
		document.getElementById('uploadBtn').addEventListener('click', uploadImages);
		document.querySelectorAll('[data-preview]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.preview)));
		document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteImage(button.dataset.delete)));
	}

	function loadEvents(year, month) {
		request(apiUrl('get_manage_events', { year, month })).then((data) => {
			Object.assign(state, data, { eventYear: data.year, eventMonth: data.month });
			renderEventManager();
		}).catch((error) => setStatus(error.message, true));
	}

	function renderEventManager() {
		const yearOptions = Array.from({ length: 11 }, (_, index) => 2026 + index).map((year) => '<option value="' + year + '"' + (year === state.eventYear ? ' selected' : '') + '>' + year + '年</option>').join('');
		const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1).map((month) => '<option value="' + month + '"' + (month === state.eventMonth ? ' selected' : '') + '>' + month + '月</option>').join('');
		const events = state.events.length ? state.events.map(renderEventForm).join('') : '<div class="msg">この月のイベントはありません。</div>';
		content('<section class="card event-manager"><div class="admin-month-selects"><select id="eventYear" aria-label="年">' + yearOptions + '</select><select id="eventMonth" aria-label="月">' + monthOptions + '</select><button class="btn" id="showEventsBtn" type="button">表示</button></div></section><section class="event-form-list">' + events + '</section>' + (state.events.length ? saveButton() : ''));
		document.getElementById('showEventsBtn').addEventListener('click', () => loadEvents(Number(value('#eventYear')), Number(value('#eventMonth'))));
		document.querySelectorAll('.event-copy-source').forEach((select) => select.addEventListener('change', () => copyEventFields(select)));
		document.querySelectorAll('[data-field="eventType"]').forEach((select) => select.addEventListener('change', () => updateEventTypeStatus(select.closest('.event-form'))));
		document.querySelectorAll('.event-form').forEach(updateEventTypeStatus);
		const saveBtn = document.getElementById('saveBtn');
		if (saveBtn) saveBtn.addEventListener('click', saveEvents);
	}

	function renderEventForm(event) {
		const sourceOptions = state.copySources.map((source) => '<option value="' + esc(source.eventId) + '">' + esc(source.dateText + ' ' + source.title) + '</option>').join('');
		const imageOptions = ['<option value="">選択してください</option>'].concat(state.images.map((image) => '<option value="' + esc(image.filename) + '"' + (image.filename === event.imageFilename ? ' selected' : '') + '>' + esc(image.originalName || image.filename) + '</option>')).join('');
		const typeOptions = ['', '勉強会', '交流会', 'セミナー', 'チャレンジ', 'オンライン'].map((type) => '<option value="' + esc(type) + '"' + (type === event.eventType ? ' selected' : '') + '>' + esc(type || '選択してください') + '</option>').join('');
		return '<details class="event-detail-admin event-form" data-event-id="' + esc(event.eventId) + '" open><summary><span>' + esc(event.dateText + ' ' + event.title) + '</span><strong class="event-type-warning">イベント種別未選択</strong></summary><div class="row"><label>コピー元</label><select class="event-copy-source"><option value="">選択してください</option>' + sourceOptions + '</select></div><div class="admin-row-pair"><div class="row"><label>イベント種別</label><select data-field="eventType">' + typeOptions + '</select></div><div class="row"><label>アイキャッチ画像</label><select data-field="imageFilename">' + imageOptions + '</select></div></div><div class="row"><label>詳細画面用簡易説明</label><input data-field="detailSubtitle" value="' + esc(event.detailSubtitle) + '"></div><div class="admin-row-pair"><div class="row"><label>時間</label><input data-field="timeText" value="' + esc(event.timeText) + '"></div><div class="row"><label>場所</label><input data-field="locationText" value="' + esc(event.locationText) + '"></div></div><div class="admin-row-pair"><div class="row"><label>定員</label><input data-field="capacityText" value="' + esc(event.capacityText) + '"></div><div class="row"><label>残り人数</label><input data-field="remainingText" value="' + esc(event.remainingText) + '"></div></div><label class="event-recommended"><input data-field="showRemaining" type="checkbox"' + (event.showRemaining ? ' checked' : '') + '> 残り人数を表示する</label><div class="row"><label>申し込みフォームURL</label><input data-field="applyUrl" type="url" value="' + esc(event.applyUrl) + '"></div><label class="event-recommended"><input data-field="recommended" type="checkbox"' + (event.recommended ? ' checked' : '') + '> おすすめイベント</label><div class="admin-row-pair"><div class="row"><label>おすすめイベント用タイトル</label><input data-field="shortTitle" value="' + esc(event.shortTitle) + '"></div><div class="row"><label>おすすめイベント用説明</label><textarea data-field="shortDescription" rows="3">' + esc(event.shortDescription) + '</textarea></div></div></details>';
	}

	function copyEventFields(select) {
		const source = state.copySources.find((event) => event.eventId === select.value);
		if (!source) return;
		const form = select.closest('.event-form');
		['eventType', 'imageFilename', 'detailSubtitle', 'timeText', 'locationText', 'capacityText', 'remainingText', 'applyUrl', 'shortTitle', 'shortDescription'].forEach((field) => {
			const input = form.querySelector('[data-field="' + field + '"]');
			if (input) input.value = source[field] || '';
		});
		const recommended = form.querySelector('[data-field="recommended"]');
		if (recommended) recommended.checked = !!source.recommended;
		const showRemaining = form.querySelector('[data-field="showRemaining"]');
		if (showRemaining) showRemaining.checked = !!source.showRemaining;
		updateEventTypeStatus(form);
	}

	function updateEventTypeStatus(form) {
		const unset = !form.querySelector('[data-field="eventType"]').value;
		form.classList.toggle('event-type-unset', unset);
		form.querySelector('.event-type-warning').hidden = !unset;
	}

	function saveEvents() {
		const events = Array.from(document.querySelectorAll('.event-form')).map((form) => {
			const event = { eventId: form.dataset.eventId };
			['eventType', 'imageFilename', 'detailSubtitle', 'timeText', 'locationText', 'capacityText', 'remainingText', 'applyUrl', 'shortTitle', 'shortDescription'].forEach((field) => { event[field] = valueIn(form, field); });
			event.showRemaining = form.querySelector('[data-field="showRemaining"]').checked;
			event.recommended = form.querySelector('[data-field="recommended"]').checked;
			return event;
		});
		request(apiUrl('save_manage_events'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year: state.eventYear, month: state.eventMonth, events }) }).then((data) => setStatus(data.message, false, true)).catch((error) => setStatus(error.message, true));
	}
	function save(payload) { request(apiUrl('save_manage_data'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: boot.page, ...payload }) }).then((data) => { setStatus(data.message, false, true); if (boot.page !== 'images') load(); }).catch((error) => setStatus(error.message, true)); }
	function uploadImages() { const files = document.getElementById('uploadImages').files; if (!files.length) return setStatus('画像を選択してください。', true); const form = new FormData(); Array.from(files).forEach((file) => form.append('images[]', file)); request(apiUrl('upload_image'), { method: 'POST', body: form }).then(() => { setStatus('アップロードしました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function deleteImage(id) { request(apiUrl('delete_image'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => { setStatus('削除しました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function content(html) { document.getElementById('content').innerHTML = html; }
	function saveButton() { return '<button class="btn primary-admin-save" id="saveBtn">保存</button>'; }
	function value(selector) { const input = document.querySelector(selector); return input ? input.value.trim() : ''; }
	function valueIn(form, field) { const input = form.querySelector('[data-field="' + field + '"]'); return input ? input.value.trim() : ''; }
	function openModal(url) { document.getElementById('modalImage').src = url; document.getElementById('imageModal').hidden = false; }
	function closeModal() { document.getElementById('imageModal').hidden = true; }
	function setStatus(message, error, ok) { const status = document.getElementById('status'); status.textContent = message || ''; status.className = 'msg ' + (error ? 'err' : ok ? 'ok' : ''); }
	function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();