(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');

	const state = {
		config: null,
		calendars: [],
		images: [],
	};

	renderShell();
	loadAdminData();

	function apiUrl(action) {
		const url = new URL(boot.apiUrl || 'api.php', window.location.href);
		url.searchParams.set('action', action);
		return url.toString();
	}

	function fetchJson(url, options) {
		return fetch(url, options || {}).then((res) => {
			return res.json().catch(() => ({})).then((body) => {
				if (!res.ok || !body || body.ok === false) {
					throw new Error(body.message || 'APIエラー');
				}
				return body;
			});
		});
	}

	function renderShell() {
		app.innerHTML = [
			'<div class="admin-grid">',
			'  <section class="card">',
			'    <h3>画像管理</h3>',
			'    <div class="row">',
			'      <label>画像ファイル</label>',
			'      <input id="uploadImages" type="file" accept="image/*" multiple />',
			'    </div>',
			'    <button class="btn" id="uploadBtn">アップロード</button>',
			'    <div style="margin-top:12px;" id="imageList"></div>',
			'  </section>',
			'  <section class="card">',
			'    <h3>ヘッダー画像（有効は最大3件）</h3>',
			'    <div id="headerEnabledRows"></div>',
			'    <div class="row">',
			'      <label>ヘッダー切替秒数</label>',
			'      <input id="headerRotationSec" type="number" min="2" max="60" />',
			'    </div>',
			'  </section>',
			'  <section class="card">',
			'    <h3>フッター画像（表示は1件）</h3>',
			'    <div id="footerEnabledRows"></div>',
			'  </section>',
			'  <section class="card">',
			'    <h3>カレンダー設定（最大5件）</h3>',
			'    <div id="calendarRows"></div>',
			'  </section>',
			'  <div class="row-2">',
			'    <button class="btn" id="saveBtn">保存</button>',
			'    <button class="btn" id="toCalendarBtn">カレンダー画面へ</button>',
			'  </div>',
			'  <div class="row-2">',
			'    <a class="btn center" href="' + esc(boot.logoutUrl || 'manage.php?logout=1') + '">ログアウト</a>',
			'    <div></div>',
			'  </div>',
			'  <div class="msg" id="status"></div>',
			'</div>',
			'<div class="blocking-overlay" id="blockingOverlay">',
			'  <div class="loading-panel">',
			'    <div class="loading-spinner"></div>',
			'    <div id="loadingText">設定読み込み中</div>',
			'  </div>',
			'</div>',
		].join('');

		document.getElementById('saveBtn').addEventListener('click', save);
		document.getElementById('toCalendarBtn').addEventListener('click', () => {
			window.location.assign(boot.calendarUrl || 'index.php');
		});
		document.getElementById('uploadBtn').addEventListener('click', uploadImages);
	}

	function loadAdminData() {
		showBlockingOverlay('設定読み込み中');
		setStatus('設定を読み込み中...');

		fetchJson(apiUrl('get_admin_data'))
			.then((res) => {
				state.config = res.config || {};
				state.calendars = (res.calendars || []).slice(0, 5);
				state.images = Array.isArray(res.images) ? res.images : [];
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
		document.getElementById('headerRotationSec').value = Number(state.config.headerRotationSec || 6);
		renderEnabledRows('header', 3);
		renderEnabledRows('footer', 1);
		renderCalendarRows();
		renderImageList();
	}

	function renderEnabledRows(category, limit) {
		const holder = document.getElementById(category === 'header' ? 'headerEnabledRows' : 'footerEnabledRows');
		const selectedIds = category === 'header'
			? (state.config.headerImageIds || [])
			: (state.config.footerImageIds || []);
		const candidates = state.images;

		const rows = [];
		for (let i = 0; i < limit; i++) {
			const options = ['<option value="">未選択</option>'].concat(candidates.map((img) => {
				const selected = selectedIds[i] === img.id ? ' selected' : '';
				return '<option value="' + esc(img.id) + '"' + selected + '>' + esc(img.originalName || img.filename) + '</option>';
			}));
			const label = category === 'header' ? 'ヘッダー画像 ' : 'フッター画像 ';
			rows.push(
				'<div class="row">' +
				'<label>' + label + (i + 1) + '</label>' +
				'<select data-' + category + '-enabled="' + i + '">' + options.join('') + '</select>' +
				'</div>'
			);
		}

		holder.innerHTML = rows.join('');
	}

	function renderCalendarRows() {
		const holder = document.getElementById('calendarRows');
		const rows = [];
		for (let i = 0; i < 5; i++) {
			const data = state.calendars[i] || {};
			rows.push(
				'<div class="row-2">' +
				'<div class="row"><label>カレンダーURL/ID ' +
				(i + 1) +
				'</label><input data-cal-input="' +
				i +
				'" value="' +
				esc(data.calendarInput || data.calendarId || '') +
				'" /></div>' +
				'<div class="row"><label>有効</label><select data-cal-enabled="' +
				i +
				'"><option value="true"' +
				(data.enabled === false ? '' : ' selected') +
				'>有効</option><option value="false"' +
				(data.enabled === false ? ' selected' : '') +
				'>無効</option></select></div>' +
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

		holder.innerHTML = state.images.map((img) => {
			return [
				'<div class="row-2" style="align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">',
				'<div>',
				'<div style="font-size:13px;">' + esc(img.originalName || img.filename) + '</div>',
				'<img src="' + esc(img.url) + '" alt="image" style="margin-top:6px; max-width:100%; max-height:80px; object-fit:contain;" />',
				'</div>',
				'<div style="text-align:right;">',
				'<button class="btn" data-delete-image="' + esc(img.id) + '">削除する</button>',
				'</div>',
				'</div>'
			].join('');
		}).join('');

		holder.querySelectorAll('[data-delete-image]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = btn.getAttribute('data-delete-image');
				removeImage(id);
			});
		});
	}

	function collectEnabledIds(category, limit) {
		const out = [];
		for (let i = 0; i < limit; i++) {
			const el = document.querySelector('[data-' + category + '-enabled="' + i + '"]');
			const v = (el && el.value.trim()) || '';
			if (v) out.push(v);
		}
		return Array.from(new Set(out)).slice(0, limit);
	}

	function collectCalendars() {
		const out = [];
		for (let i = 0; i < 5; i++) {
			const input = document.querySelector('[data-cal-input="' + i + '"]');
			const enabled = document.querySelector('[data-cal-enabled="' + i + '"]');
			out.push({
				calendarInput: (input && input.value.trim()) || '',
				enabled: !enabled || enabled.value === 'true',
			});
		}
		return out;
	}

	function save() {
		const payload = {
			headerRotationSec: Number(document.getElementById('headerRotationSec').value || 6),
			timezone: 'Asia/Tokyo',
			headerImageIds: collectEnabledIds('header', 3),
			footerImageIds: collectEnabledIds('footer', 1),
			calendars: collectCalendars(),
		};

		setStatus('保存中...');
		fetchJson(apiUrl('save_admin_data'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
			.then((res) => {
				setStatus((res && res.message) || '保存しました。', false, true);
			})
			.catch((err) => {
				setStatus(err.message || String(err), true);
			});
	}

	function uploadImages() {
		const files = document.getElementById('uploadImages').files;
		if (!files || !files.length) {
			setStatus('画像を選択してください。', true);
			return;
		}

		const fd = new FormData();
		Array.from(files).forEach((file) => {
			fd.append('images[]', file);
		});

		setStatus('アップロード中...');
		fetchJson(apiUrl('upload_image'), { method: 'POST', body: fd })
			.then(() => {
				setStatus('アップロードしました。', false, true);
				document.getElementById('uploadImages').value = '';
				loadAdminData();
			})
			.catch((err) => {
				setStatus(err.message || String(err), true);
			});
	}

	function removeImage(id) {
		if (!id) return;

		setStatus('削除中...');
		fetchJson(apiUrl('delete_image'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id }),
		})
			.then(() => {
				setStatus('削除しました。', false, true);
				loadAdminData();
			})
			.catch((err) => {
				setStatus(err.message || String(err), true);
			});
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
		if (!overlay) return;
		overlay.classList.remove('is-visible');
	}

	function setStatus(msg, isError, isOk) {
		const el = document.getElementById('status');
		if (!el) return;
		el.textContent = msg || '';
		el.className = 'msg ' + (isError ? 'err' : isOk ? 'ok' : '');
	}

	function esc(s) {
		return String(s || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
})();
