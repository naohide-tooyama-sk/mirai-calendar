(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const state = { calendars: [], images: [], templates: [], eventDetails: [], eventOptions: [], month: currentMonth() };
	const eventTypes = ['勉強会', '交流会', 'セミナー', 'チャレンジ', 'オンライン'];

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
		const params = boot.page === 'events' ? { page: boot.page, month: state.month } : { page: boot.page };
		request(apiUrl('get_manage_data', params)).then((data) => {
			Object.assign(state, data);
			renderPage();
		}).catch((error) => setStatus(error.message, true));
	}

	function renderPage() {
		if (boot.page === 'calendars') renderCalendars();
		if (boot.page === 'images') renderImages();
		if (boot.page === 'templates') renderTemplates();
		if (boot.page === 'events') renderEvents();
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

	function renderTemplates() {
		content('<section class="card"><button class="btn" id="addTemplate">追加</button><div id="templateRows">' + state.templates.map(templateHtml).join('') + '</div></section>' + saveButton());
		document.getElementById('addTemplate').addEventListener('click', () => { state.templates.push({}); renderTemplates(); });
		bindDelete('[data-delete-template]', () => { state.templates = collectTemplates(); });
		document.getElementById('saveBtn').addEventListener('click', () => save({ templates: collectTemplates() }));
	}

	function renderEvents() {
		const [selectedYear, selectedMonth] = state.month.split('-');
		const monthControl = '<section class="card"><div class="row"><label>対象月</label><div class="admin-month-selects"><select id="targetYear" aria-label="対象年">' + yearOptions(selectedYear) + '</select><select id="targetMonth" aria-label="対象月">' + monthOptions(selectedMonth) + '</select><button class="btn" id="displayEventsBtn" type="button">表示</button></div></div></section>';
		const detailMap = Object.fromEntries(state.eventDetails.map((detail) => [detail.eventId, detail]));
		const events = state.eventOptions.filter((event) => String(event.startIso || '').slice(0, 7) === state.month).map((event) => eventHtml(event, detailMap[event.eventId] || {})).join('') || '<section class="card">この月の取得済みイベントはありません。</section>';
		content(monthControl + '<div id="eventRows">' + events + '</div>' + saveButton());
		document.getElementById('displayEventsBtn').addEventListener('click', () => { state.month = document.getElementById('targetYear').value + '-' + document.getElementById('targetMonth').value; load(); });
		document.querySelectorAll('[data-template-select]').forEach((select) => select.addEventListener('change', applyTemplate));
		document.getElementById('saveBtn').addEventListener('click', () => save({ month: state.month, eventDetails: collectDetails() }));
	}

	function yearOptions(selected) { return Array.from({ length: 21 }, (_, index) => String(2026 + index)).map((year) => '<option value="' + year + '"' + (year === selected ? ' selected' : '') + '>' + year + '年</option>').join(''); }
	function monthOptions(selected) { return Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((month) => '<option value="' + month + '"' + (month === selected ? ' selected' : '') + '>' + Number(month) + '月</option>').join(''); }

	function templateHtml(template) {
		return '<div class="admin-subcard template-row"><button class="btn delete-row" type="button" data-delete-template>削除</button>' + fields(template, 'template') + '</div>';
	}

	function eventHtml(event, detail) {
		const unconfigured = !detail.templateName;
		return '<details class="event-detail-admin' + (unconfigured ? ' is-unconfigured' : '') + '" open><summary>' + esc(event.label || event.title) + '</summary><input type="hidden" data-event-id value="' + esc(event.eventId) + '"><div class="row"><label>テンプレート名</label>' + templateSelect(detail.templateName || '') + '</div>' + fields(detail, 'event') + '<div class="row"><label>残り人数</label><input data-field="remainingText" value="' + esc(detail.remainingText) + '"></div><label class="toggle-row"><input type="checkbox" data-field="recommended"' + (detail.recommended ? ' checked' : '') + '>おすすめイベント</label></details>';
	}

	function fields(data, scope) {
		const prefix = scope === 'template' ? 'data-template-field' : 'data-field';
		if (scope === 'template') {
			return '<div class="admin-row-pair"><div class="row"><label>テンプレート名</label><input ' + prefix + '="name" value="' + esc(data.name) + '"></div><div class="row"><label>イベント種別</label>' + typeSelect(prefix, data.eventType) + '</div></div><div class="admin-row-pair"><div class="row"><label>アイキャッチ画像</label>' + imageSelect(prefix, data.imageFilename) + '</div><div class="row"><label>詳細画面用簡易説明</label><input ' + prefix + '="detailSubtitle" value="' + esc(data.detailSubtitle) + '"></div></div><div class="admin-row-pair"><div class="row"><label>時間</label><input ' + prefix + '="timeText" value="' + esc(data.timeText) + '"></div><div class="row"><label>場所</label><input ' + prefix + '="locationText" value="' + esc(data.locationText) + '"></div></div><div class="admin-row-pair"><div class="row"><label>定員</label><input ' + prefix + '="capacityText" value="' + esc(data.capacityText) + '"></div><div class="row"><label>申し込みフォームURL</label><input ' + prefix + '="applyUrl" value="' + esc(data.applyUrl) + '"></div></div><div class="admin-row-pair"><div class="row"><label>おすすめイベント用タイトル</label><input ' + prefix + '="shortTitle" value="' + esc(data.shortTitle) + '"></div><div class="row"><label>おすすめイベント用説明</label><textarea ' + prefix + '="shortDescription" rows="3">' + esc(data.shortDescription) + '</textarea></div></div>';
		}
		return '<div class="admin-row-pair"><div class="row"><label>イベント種別</label>' + typeSelect(prefix, data.eventType) + '</div><div class="row"><label>アイキャッチ画像</label>' + imageSelect(prefix, data.imageFilename) + '</div></div><div class="admin-row-pair"><div class="row"><label>詳細画面用簡易説明</label><input ' + prefix + '="detailSubtitle" value="' + esc(data.detailSubtitle) + '"></div><div class="row"><label>時間</label><input ' + prefix + '="timeText" value="' + esc(data.timeText) + '"></div></div><div class="admin-row-pair"><div class="row"><label>場所</label><input ' + prefix + '="locationText" value="' + esc(data.locationText) + '"></div><div class="row"><label>定員</label><input ' + prefix + '="capacityText" value="' + esc(data.capacityText) + '"></div></div><div class="admin-row-pair"><div class="row"><label>申し込みフォームURL</label><input ' + prefix + '="applyUrl" value="' + esc(data.applyUrl) + '"></div><div class="row"><label>おすすめイベント用タイトル</label><input ' + prefix + '="shortTitle" value="' + esc(data.shortTitle) + '"></div></div><div class="row"><label>おすすめイベント用説明</label><textarea ' + prefix + '="shortDescription" rows="3">' + esc(data.shortDescription) + '</textarea></div>';
	}

	function typeSelect(attr, selected) { return '<select ' + attr + '="eventType"><option value="">未設定</option>' + eventTypes.map((type) => '<option value="' + type + '"' + (type === selected ? ' selected' : '') + '>' + type + '</option>').join('') + '</select>'; }
	function imageSelect(attr, selected) { return '<select ' + attr + '="imageFilename"><option value="">未設定</option>' + state.images.map((image) => '<option value="' + esc(image.filename) + '"' + (image.filename === selected ? ' selected' : '') + '>' + esc(image.originalName || image.filename) + '</option>').join('') + '</select>'; }
	function templateSelect(selected) { return '<select data-template-select><option value="">未設定</option>' + state.templates.map((template) => '<option value="' + esc(template.name) + '"' + (template.name === selected ? ' selected' : '') + '>' + esc(template.name) + '</option>').join('') + '</select>'; }

	function applyTemplate(event) {
		const template = state.templates.find((item) => item.name === event.target.value);
		if (!template) return;
		const root = event.target.closest('details');
		root.querySelectorAll('[data-field]').forEach((input) => { if (input.dataset.field !== 'recommended' && template[input.dataset.field] !== undefined) input.value = template[input.dataset.field]; });
	}

	function collectTemplates() {
		return Array.from(document.querySelectorAll('.template-row')).map((row) => collectFields(row, 'data-template-field')).filter((item) => item.name);
	}
	function collectDetails() {
		return Array.from(document.querySelectorAll('.event-detail-admin')).map((row) => ({ eventId: row.querySelector('[data-event-id]').value, templateName: row.querySelector('[data-template-select]').value, ...collectFields(row, 'data-field'), recommended: row.querySelector('[data-field="recommended"]').checked }));
	}
	function collectFields(root, attr) { const item = {}; root.querySelectorAll('[' + attr + ']').forEach((input) => { item[input.getAttribute(attr)] = input.type === 'checkbox' ? input.checked : input.value.trim(); }); return item; }
	function bindDelete(selector, before) { document.querySelectorAll(selector).forEach((button) => button.addEventListener('click', () => { before(); button.closest('.template-row').remove(); })); }
	function save(payload) { request(apiUrl('save_manage_data'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: boot.page, ...payload }) }).then((data) => { setStatus(data.message, false, true); if (boot.page !== 'images') load(); }).catch((error) => setStatus(error.message, true)); }
	function uploadImages() { const files = document.getElementById('uploadImages').files; if (!files.length) return setStatus('画像を選択してください。', true); const form = new FormData(); Array.from(files).forEach((file) => form.append('images[]', file)); request(apiUrl('upload_image'), { method: 'POST', body: form }).then(() => { setStatus('アップロードしました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function deleteImage(id) { request(apiUrl('delete_image'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => { setStatus('削除しました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function content(html) { document.getElementById('content').innerHTML = html; }
	function saveButton() { return '<button class="btn primary-admin-save" id="saveBtn">保存</button>'; }
	function value(selector) { const input = document.querySelector(selector); return input ? input.value.trim() : ''; }
	function currentMonth() { const now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'); }
	function openModal(url) { document.getElementById('modalImage').src = url; document.getElementById('imageModal').hidden = false; }
	function closeModal() { document.getElementById('imageModal').hidden = true; }
	function setStatus(message, error, ok) { const status = document.getElementById('status'); status.textContent = message || ''; status.className = 'msg ' + (error ? 'err' : ok ? 'ok' : ''); }
	function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();