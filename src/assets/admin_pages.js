(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const today = new Date();
	const config = boot.config || {};
	const monthChoices = availableMonthChoices();
	const dateParam = new URLSearchParams(window.location.search).get('date') || '';
	const requestedYear = /^\d{6}$/.test(dateParam) ? Number(dateParam.slice(0, 4)) : today.getFullYear();
	const requestedMonth = /^\d{6}$/.test(dateParam) ? Number(dateParam.slice(4, 6)) : today.getMonth() + 1;
	const requestedMonthChoice = requestedYear * 12 + requestedMonth - 1;
	const selectedMonthChoice = monthChoices.reduce((nearest, choice) => Math.abs(choice.value - requestedMonthChoice) < Math.abs(nearest.value - requestedMonthChoice) ? choice : nearest, monthChoices[0]);
	const state = { calendars: [], images: [], events: [], copySources: [], eventYear: selectedMonthChoice.year, eventMonth: selectedMonthChoice.month };

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
		app.innerHTML = '<div class="admin-v2"><header class="admin-header-v2"><div class="admin-title-v2"><a class="admin-back-button" href="' + esc(boot.topUrl || 'manage.php') + '" aria-label="設定トップへ" title="設定トップへ">←</a><h1>' + esc(boot.title || '設定') + '</h1></div></header><div id="content"></div></div><div class="image-modal" id="imageModal" hidden><button class="image-modal-close" type="button" aria-label="閉じる">×</button><img id="modalImage" alt=""></div>';
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
		if (boot.page === 'config') renderConfig();
		if (boot.page === 'calendars') renderCalendars();
		if (boot.page === 'images') renderImages();
		if (boot.page === 'events') renderEventManager();
	}

	function renderConfig() {
		const cfg = state.config || {};
		content('<section class="card"><div class="row"><label>タイムゾーン</label><input id="timezone" value="' + esc(cfg.timezone || 'Asia/Tokyo') + '"></div><div class="admin-row-pair"><div class="row"><label>過去の有効月数</label><input id="pastMonths" type="number" min="0" value="' + (cfg.pastMonths === null || cfg.pastMonths === undefined ? '' : Number(cfg.pastMonths)) + '"></div><div class="row"><label>未来の有効月数</label><input id="futureMonths" type="number" min="0" value="' + (cfg.futureMonths === null || cfg.futureMonths === undefined ? '' : Number(cfg.futureMonths)) + '"></div></div></section>' + saveButton());
		document.getElementById('saveBtn').addEventListener('click', () => request(apiUrl('save_admin_data'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timezone: value('#timezone'), pastMonths: value('#pastMonths') === '' ? null : Number(value('#pastMonths')), futureMonths: value('#futureMonths') === '' ? null : Number(value('#futureMonths')) }) }).then((data) => setStatus(data.message, false, true)).catch((error) => setStatus(error.message, true)));
	}

	function renderCalendars() {
		const rows = Array.from({ length: 10 }, (_, index) => '<div class="row"><label>カレンダーURL/ID ' + (index + 1) + '</label><input data-calendar="' + index + '" value="' + esc((state.calendars[index] || {}).calendarInput || '') + '"></div>').join('');
		content('<section class="card"><p>URLまたはIDを入力したカレンダーを表示します。</p>' + rows + '</section>' + saveButton());
		document.getElementById('saveBtn').addEventListener('click', () => save({ calendars: Array.from({ length: 10 }, (_, index) => ({ calendarInput: value('[data-calendar="' + index + '"]') })) }));
	}

	function renderImages() {
		const images = state.images.length ? state.images.map((image) => '<div class="admin-image-row"><button type="button" class="image-thumb" data-preview="' + esc(image.url) + '"><img src="' + esc(image.url) + '" alt="' + esc(image.originalName || image.filename) + '"></button><span>' + esc(image.originalName || image.filename) + '</span><button class="btn" data-delete="' + esc(image.id) + '">削除</button></div>').join('') : '<div class="msg">画像はまだありません。</div>';
		content('<section class="card"><div class="row"><label>画像ファイル</label><input id="uploadImages" type="file" accept="image/*" multiple></div><button class="btn" id="uploadBtn">アップロード</button><div class="admin-image-list">' + images + '</div></section><div class="msg" id="status"></div>');
		document.getElementById('uploadBtn').addEventListener('click', uploadImages);
		document.querySelectorAll('[data-preview]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.preview)));
		document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteImage(button.dataset.delete)));
	}

	function loadEvents(year, month) {
		document.body.classList.add('admin-loading');
		setStatus('予定を読み込み中...', false);
		request(apiUrl('refresh_month_events', { year, month })).then(() => request(apiUrl('get_manage_events', { year, month }))).then((data) => {
			Object.assign(state, data, { eventYear: data.year, eventMonth: data.month });
			renderEventManager();
			setStatus('', false);
			document.body.classList.remove('admin-loading');
		}).catch((error) => { document.body.classList.remove('admin-loading'); setStatus(error.message, true); });
	}

	function renderEventManager() {
		const monthOptions = monthChoices.map((choice) => '<option value="' + choice.value + '"' + (choice.year === state.eventYear && choice.month === state.eventMonth ? ' selected' : '') + '>' + choice.label + '</option>').join('');
		const events = state.events.length ? state.events.map(renderEventForm).join('') : '<div class="msg">この月のイベントはありません。</div>';
		content('<section class="card event-manager"><div class="admin-month-selects"><select id="eventMonth" aria-label="年月">' + monthOptions + '</select><button class="btn" id="showEventsBtn" type="button">表示</button></div></section><section class="event-form-list">' + events + '</section>' + (state.events.length ? saveButton() : ''));
		document.getElementById('showEventsBtn').addEventListener('click', () => { const choice = monthChoices.find((item) => item.value === Number(value('#eventMonth'))); if (choice) loadEvents(choice.year, choice.month); });
		document.querySelectorAll('.event-copy-source').forEach((select) => select.addEventListener('change', () => copyEventFields(select)));
		document.querySelectorAll('[data-field="eventTypeId"]').forEach((select) => select.addEventListener('change', () => updateEventTypeStatus(select.closest('.event-form'))));
		document.querySelectorAll('.event-form').forEach(updateEventTypeStatus);
		const saveBtn = document.getElementById('saveBtn');
		if (saveBtn) saveBtn.addEventListener('click', saveEvents);
	}

	function renderEventForm(event) {
		const sourceOptions = state.copySources.map((source) => '<option value="' + esc(source.eventId) + '">' + esc(source.dateText + ' ' + source.title) + '</option>').join('');
		const imageOptions = (selected) => ['<option value="">選択してください</option>'].concat(state.images.map((image) => '<option value="' + esc(image.id) + '"' + (image.id === selected ? ' selected' : '') + '>' + esc(image.originalName || image.filename) + '</option>')).join('');
		const typeOptions = [['', '選択してください'], ['study', '勉強会'], ['networking', '交流会'], ['seminar', 'セミナー'], ['challenge', 'チャレンジ'], ['online', 'オンライン']].map(([id, label]) => '<option value="' + esc(id) + '"' + (id === event.eventTypeId ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
		const purposes = [['networking', '手軽に交流したい'], ['connections', '人脈を増やしたい'], ['promotion', '事業や自分をPRしたい'], ['startup', '起業したい'], ['study', 'ビジネスを学びたい'], ['sports', '体を動かしたい']].map(([id, label]) => '<label><input data-purpose="' + id + '" type="checkbox"' + ((event.purposeTypeIds || []).includes(id) ? ' checked' : '') + '> ' + label + '</label>').join('');
		const field = (label, name, value, type, placeholder) => '<div class="row"><label>' + label + '</label><input data-field="' + name + '"' + (type ? ' type="' + type + '"' : '') + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + ' value="' + esc(value || '') + '"></div>';
		return '<details class="event-detail-admin event-form" data-event-id="' + esc(event.eventId) + '" open>'
			+ '<summary><span>' + esc(event.dateText + ' ' + event.title) + '</span><strong class="event-type-warning">イベント種別未選択</strong></summary>'
			+ '<div class="row"><label>コピー元</label><select class="event-copy-source"><option value="">選択してください</option>' + sourceOptions + '</select></div>'
			+ '<div class="row"><label>イベント種別</label><select data-field="eventTypeId">' + typeOptions + '</select></div>'
			+ '<div class="row"><label>参加目的種別</label><div class="purpose-checkboxes">' + purposes + '</div></div>'
			+ field('簡易タイトル', 'shortTitle', event.shortTitle)
			+ '<div class="row"><label>簡易説明</label><textarea data-field="shortDescription" rows="3">' + esc(event.shortDescription) + '</textarea></div>'
			+ field('開催時間', 'timeText', event.timeText, '', '18:00〜20:00')
			+ field('開始時刻', 'startTime', event.startTime, '', '18:00')
			+ field('場所', 'location', event.location, '', '上野 PPconnectオフィス')
			+ '<div class="admin-row-pair">' + field('定員', 'capacity', event.capacity, '', '20名') + field('残り人数', 'remainingNumber', event.remainingNumber, '', '残り10名') + '</div>'
			+ '<label class="event-recommended"><input data-field="showRemaining" type="checkbox"' + (event.showRemaining ? ' checked' : '') + '> 残り人数を公開する</label>'
			+ field('参加費', 'fee', event.fee, '', '3,000円')
			+ field('申し込みURL', 'applicationUrl', event.applicationUrl, 'url', 'https://forms.gle/...')
			+ field('申し込み締め切り日時', 'applicationDeadline', event.applicationDeadline, '', '8/31 17:59')
			+ field('対象者', 'targetAudience', event.targetAudience, '', '起業に興味のある方。会社員も歓迎！')
			+ field('参加メリット', 'merit', event.merit, '', '多業種の経営者と気軽に人脈を構築できます')
			+ '<div class="admin-row-pair"><div class="row"><label>メイン画像</label><select data-field="mainImageId">' + imageOptions(event.mainImageId) + '</select></div><div class="row"><label>文頭画像</label><select data-field="headerImageId">' + imageOptions(event.headerImageId) + '</select></div></div>'
			+ '<div class="row"><label>文末画像</label><select data-field="footerImageId">' + imageOptions(event.footerImageId) + '</select></div>'
			+ '<label class="event-recommended"><input data-field="recommendedFlag" type="checkbox"' + (event.recommendedFlag ? ' checked' : '') + '> おすすめイベントとして表示する</label></details>';
	}

	function copyEventFields(select) {
		const source = state.copySources.find((event) => event.eventId === select.value);
		if (!source) return;
		const form = select.closest('.event-form');
		['eventTypeId', 'startTime', 'mainImageId', 'headerImageId', 'footerImageId', 'shortTitle', 'shortDescription', 'timeText', 'location', 'capacity', 'remainingNumber', 'fee', 'applicationUrl', 'applicationDeadline', 'targetAudience', 'merit'].forEach((field) => {
			const input = form.querySelector('[data-field="' + field + '"]');
			if (input) input.value = source[field] || '';
		});
		const recommended = form.querySelector('[data-field="recommendedFlag"]');
		if (recommended) recommended.checked = !!source.recommendedFlag;
		const showRemaining = form.querySelector('[data-field="showRemaining"]');
		if (showRemaining) showRemaining.checked = !!source.showRemaining;
		form.querySelectorAll('[data-purpose]').forEach((input) => { input.checked = (source.purposeTypeIds || []).includes(input.dataset.purpose); });
		updateEventTypeStatus(form);
	}

	function updateEventTypeStatus(form) {
		const unset = !form.querySelector('[data-field="eventTypeId"]').value;
		form.classList.toggle('event-type-unset', unset);
		form.querySelector('.event-type-warning').hidden = !unset;
	}

	function saveEvents() {
		const events = Array.from(document.querySelectorAll('.event-form')).map((form) => {
			const event = { eventId: form.dataset.eventId };
			['eventTypeId', 'startTime', 'mainImageId', 'headerImageId', 'footerImageId', 'shortTitle', 'shortDescription', 'timeText', 'location', 'capacity', 'remainingNumber', 'fee', 'applicationUrl', 'applicationDeadline', 'targetAudience', 'merit'].forEach((field) => { event[field] = valueIn(form, field); });
			event.purposeTypeIds = Array.from(form.querySelectorAll('[data-purpose]:checked')).map((input) => input.dataset.purpose);
			event.showRemaining = form.querySelector('[data-field="showRemaining"]').checked;
			event.recommendedFlag = form.querySelector('[data-field="recommendedFlag"]').checked;
			return event;
		});
		request(apiUrl('save_manage_events'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year: state.eventYear, month: state.eventMonth, events }) }).then((data) => setStatus(data.message, false, true)).catch((error) => setStatus(error.message, true));
	}
	function save(payload) { request(apiUrl('save_manage_data'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: boot.page, ...payload }) }).then((data) => { setStatus(data.message, false, true); if (boot.page !== 'images') load(); }).catch((error) => setStatus(error.message, true)); }
	function uploadImages() { const files = document.getElementById('uploadImages').files; if (!files.length) return setStatus('画像を選択してください。', true); const form = new FormData(); Array.from(files).forEach((file) => form.append('images[]', file)); request(apiUrl('upload_image'), { method: 'POST', body: form }).then(() => { setStatus('アップロードしました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function deleteImage(id) { request(apiUrl('delete_image'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => { setStatus('削除しました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function content(html) { document.getElementById('content').innerHTML = html; }
	function saveButton() { return '<div class="save-actions"><button class="btn primary-admin-save" id="saveBtn">保存</button><div class="msg" id="status"></div></div>'; }
	function value(selector) { const input = document.querySelector(selector); return input ? input.value.trim() : ''; }
	function valueIn(form, field) { const input = form.querySelector('[data-field="' + field + '"]'); return input ? input.value.trim() : ''; }
	function openModal(url) { document.getElementById('modalImage').src = url; document.getElementById('imageModal').hidden = false; }
	function closeModal() { document.getElementById('imageModal').hidden = true; }
	function setStatus(message, error, ok) { const status = document.getElementById('status'); if (!status) return; status.textContent = message || ''; status.className = 'msg ' + (error ? 'err' : ok ? 'ok' : ''); }
	function availableMonthChoices() { const base = new Date(today.getFullYear(), today.getMonth(), 1); const pastMonths = Number.isInteger(Number(config.pastMonths)) ? Number(config.pastMonths) + 1 : 12; const futureMonths = Number.isInteger(Number(config.futureMonths)) ? Number(config.futureMonths) + 1 : 12; const choices = []; for (let offset = -pastMonths; offset <= futureMonths; offset += 1) { const date = new Date(base.getFullYear(), base.getMonth() + offset, 1); choices.push({ year: date.getFullYear(), month: date.getMonth() + 1, value: date.getFullYear() * 12 + date.getMonth(), label: date.getFullYear() + '年' + (date.getMonth() + 1) + '月' }); } return choices; }
	function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();