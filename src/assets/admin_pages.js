(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const state = { calendars: [], images: [] };

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
		const params = { page: boot.page };
		request(apiUrl('get_manage_data', params)).then((data) => {
			Object.assign(state, data);
			renderPage();
		}).catch((error) => setStatus(error.message, true));
	}

	function renderPage() {
		if (boot.page === 'calendars') renderCalendars();
		if (boot.page === 'images') renderImages();
		if (boot.page === 'events') renderEventCsv();
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

	function renderEventCsv() {
		content('<section class="card csv-manager"><h2>イベントCSV管理</h2><p>イベント一覧をCSVでダウンロードし、ローカルで編集したCSVをアップロードしてください。アップロードした行だけが保存されます。</p><div class="csv-actions"><a class="btn" href="' + esc(apiUrl('download_event_csv')) + '">CSVをダウンロード</a><label class="btn csv-upload-label" for="eventCsv">CSVを選択</label><input id="eventCsv" type="file" accept=".csv,text/csv"><button class="btn primary-admin-save" id="uploadCsvBtn" type="button">CSVをアップロード</button></div><div id="csvFileName" class="msg">CSVが選択されていません。</div></section>');
		const input = document.getElementById('eventCsv');
		input.addEventListener('change', () => { document.getElementById('csvFileName').textContent = input.files[0] ? input.files[0].name : 'CSVが選択されていません。'; });
		document.getElementById('uploadCsvBtn').addEventListener('click', uploadEventCsv);
	}

	function uploadEventCsv() {
		const input = document.getElementById('eventCsv');
		if (!input.files.length) return setStatus('CSVファイルを選択してください。', true);
		const form = new FormData();
		form.append('csv', input.files[0]);
		request(apiUrl('upload_event_csv'), { method: 'POST', body: form }).then((data) => { setStatus(data.message, false, true); renderEventCsv(); }).catch((error) => setStatus(error.message, true));
	}
	function save(payload) { request(apiUrl('save_manage_data'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'events', ...payload }) }).then((data) => { setStatus(data.message, false, true); if (boot.page !== 'images') load(); }).catch((error) => setStatus(error.message, true)); }
	function uploadImages() { const files = document.getElementById('uploadImages').files; if (!files.length) return setStatus('画像を選択してください。', true); const form = new FormData(); Array.from(files).forEach((file) => form.append('images[]', file)); request(apiUrl('upload_image'), { method: 'POST', body: form }).then(() => { setStatus('アップロードしました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function deleteImage(id) { request(apiUrl('delete_image'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => { setStatus('削除しました。', false, true); load(); }).catch((error) => setStatus(error.message, true)); }
	function content(html) { document.getElementById('content').innerHTML = html; }
	function saveButton() { return '<button class="btn primary-admin-save" id="saveBtn">保存</button>'; }
	function value(selector) { const input = document.querySelector(selector); return input ? input.value.trim() : ''; }
	function openModal(url) { document.getElementById('modalImage').src = url; document.getElementById('imageModal').hidden = false; }
	function closeModal() { document.getElementById('imageModal').hidden = true; }
	function setStatus(message, error, ok) { const status = document.getElementById('status'); status.textContent = message || ''; status.className = 'msg ' + (error ? 'err' : ok ? 'ok' : ''); }
	function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();