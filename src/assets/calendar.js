(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const layoutMode = String(window.__LAYOUT_MODE__ || boot.layoutMode || 'default');
	const app = document.getElementById('app');

	const state = {
		year: new Date().getFullYear(),
		month: new Date().getMonth() + 1,
		layoutMode,
		config: null,
		titleImages: [],
		footerImageUrl: '',
		calendars: [],
		monthCache: {},
		titleFadeTimer: null,
		titleIndex: 0,
		eventsByDate: {},
		holidays: {},
		activeEvents: {},
		attractionEvents: {},
		modalEvent: null,
		requestSeq: 0,
		liveCompleted: {},
		liveRefreshTimer: null,
		isInitialLoad: true,
		requireInitialBlocking: false,
	};

	renderShell();
	initializeFromBootstrap();

	function apiUrl(action, params) {
		const url = new URL('api.php', window.location.href);
		url.searchParams.set('action', action);
		Object.entries(params || {}).forEach(([k, v]) => {
			url.searchParams.set(k, String(v));
		});
		return url.toString();
	}

	function fetchJson(url, options) {
		return fetch(url, options || {}).then((res) => {
			if (!res.ok) {
				return res.json().catch(() => ({})).then((body) => {
					throw new Error(body.message || 'APIエラー');
				});
			}
			return res.json();
		}).then((body) => {
			if (!body || body.ok === false) {
				throw new Error((body && body.message) || '処理に失敗しました。');
			}
			return body;
		});
	}

	function renderShell() {
		app.classList.toggle('layout-2col', state.layoutMode === '2col');
		app.classList.toggle('layout-2row', state.layoutMode === '2row');

		const attractionSection = [
			'<section class="spaced attraction-section" id="attractionSection">',
			'  <div class="attraction-panel">',
			'    <h3 class="attraction-title">直近のイベント</h3>',
			'    <div id="attractionBody"></div>',
			'  </div>',
			'</section>',
		].join('');

		const calendarSection = [
			'<section class="spaced calendar-section" id="calendarSection">',
			'  <div class="calendar-grid" id="calendarGrid"></div>',
			'</section>',
		].join('');

		let centerLayoutHtml = calendarSection;
		if (state.layoutMode === '2col') {
			centerLayoutHtml = [
				'<section class="spaced two-col-layout">',
				'  <div class="two-col-left">',
				attractionSection,
				'  </div>',
				'  <div class="two-col-right">',
				calendarSection,
				'  </div>',
				'</section>',
			].join('');
		} else if (state.layoutMode === '2row') {
			centerLayoutHtml = attractionSection + calendarSection;
		}

		app.innerHTML = [
			'<a class="gear-link" href="' + esc(boot.adminUrl || 'manage.php') + '" title="管理">⚙</a>',
			'<section class="spaced" id="titleZone"></section>',
			'<section class="month-bar spaced">',
			'<div class="month-nav">',
			'<button class="btn" id="prevMonth">◀</button>',
			'<div class="month-label" id="monthLabel"></div>',
			'<button class="btn" id="nextMonth">▶</button>',
			'</div>',
			'<button class="btn today-btn" id="goToday">今月</button>',
			'</section>',
			centerLayoutHtml,
			'<section class="spaced footer-image-section" id="footerImageSection">',
			'  <div class="footer-image-frame" id="footerImageFrame"></div>',
			'</section>',
			'<div class="msg" id="status"></div>',
			'<div class="blocking-overlay" id="blockingOverlay">',
			'  <div class="loading-panel" id="loadingPanel">',
			'    <div class="loading-spinner"></div>',
			'    <div id="loadingText">読み込み中...</div>',
			'  </div>',
			'</div>',
			'<div class="modal-backdrop" id="modalBackdrop">',
			'  <div class="modal">',
			'    <div class="modal-content" id="modalBody"></div>',
			'    <div class="modal-actions">',
			'      <button class="btn modal-add-btn" id="addMyCalendarBtn">自分のカレンダーに追加</button>',
			'      <button class="btn modal-close" id="closeModal" aria-label="閉じる">×</button>',
			'    </div>',
			'  </div>',
			'</div>',
		].join('');

		const modalBackdrop = document.getElementById('modalBackdrop');
		if (modalBackdrop && modalBackdrop.parentElement !== document.body) {
			document.body.appendChild(modalBackdrop);
		}

		document.getElementById('prevMonth').addEventListener('click', () => moveMonth(-1));
		document.getElementById('nextMonth').addEventListener('click', () => moveMonth(1));
		document.getElementById('goToday').addEventListener('click', goToday);
		document.getElementById('closeModal').addEventListener('click', closeModal);
		document.getElementById('addMyCalendarBtn').addEventListener('click', addToMyCalendar);
		document.getElementById('modalBackdrop').addEventListener('click', (ev) => {
			if (ev.target.id === 'modalBackdrop') closeModal();
		});
	}

	function initializeFromBootstrap() {
		state.config = boot.config || {};
		const headerImageUrls = Array.isArray(state.config.headerImageUrls)
			? state.config.headerImageUrls
			: (Array.isArray(state.config.titleImageUrls) ? state.config.titleImageUrls : []);
		state.titleImages = headerImageUrls.filter(Boolean).slice(0, 3);
		state.footerImageUrl = String(state.config.footerImageUrl || '');
		state.calendars = boot.calendars || [];
		const currentKey = getMonthKey(state.year, state.month);
		if (boot.cacheData) {
			state.monthCache[currentKey] = normalizeMonthPayload(boot.cacheData);
		}
		state.requireInitialBlocking = !hasEventData_(state.monthCache[currentKey]);
		renderTitle();
		renderFooterImage();
		renderMonthLabel();
		renderMonthFromData(state.monthCache[currentKey] || emptyMonthData());
		prefetchAttractionMonths_();
		loadMonth();
	}

	function prefetchAttractionMonths_() {
		if (state.layoutMode !== '2col' && state.layoutMode !== '2row') {
			return;
		}

		const now = new Date();
		const cacheTasks = [];
		for (let i = 0; i < 12; i++) {
			const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
			const year = d.getFullYear();
			const month = d.getMonth() + 1;
			const key = getMonthKey(year, month);
			if (state.monthCache[key] && hasMonthPayload_(state.monthCache[key])) {
				continue;
			}
			cacheTasks.push(
				fetchJson(apiUrl('get_cached_month_events', { year, month }))
					.then((res) => {
						state.monthCache[key] = normalizeMonthPayload(res);
					})
					.catch(() => null)
			);
		}

		Promise.all(cacheTasks)
			.then(() => {
				renderAttraction();
				const refreshTasks = [];
				for (let i = 0; i < 6; i++) {
					const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
					const year = d.getFullYear();
					const month = d.getMonth() + 1;
					const key = getMonthKey(year, month);
					refreshTasks.push(
						fetchJson(apiUrl('refresh_month_events', { year, month }))
							.then((res) => {
								state.monthCache[key] = normalizeMonthPayload(res);
							})
							.catch(() => null)
					);
				}
				return Promise.all(refreshTasks);
			})
			.then(() => {
				renderAttraction();
			});
	}

	function loadMonth() {
		const requestSeq = ++state.requestSeq;
		const cacheKey = getMonthKey(state.year, state.month);
		state.liveCompleted[cacheKey] = false;
		setStatus('最新の予定を取得しています・・・');

		const shouldBlockInitial = state.isInitialLoad && state.requireInitialBlocking;
		if (shouldBlockInitial) {
			showBlockingOverlay('予定読み込み中');
		}

		if (state.monthCache[cacheKey]) {
			const cached = state.monthCache[cacheKey];
			renderMonthFromData(cached);
			if (shouldBlockInitial && hasMonthPayload_(cached)) {
				hideBlockingOverlay();
				state.requireInitialBlocking = false;
			}
			runLiveRefresh_(requestSeq, cacheKey, shouldBlockInitial);
			return;
		}

		renderMonthFromData(emptyMonthData());
		fetchJson(apiUrl('get_cached_month_events', { year: state.year, month: state.month }))
			.then((res) => {
				if (requestSeq !== state.requestSeq) return;
				const cached = normalizeMonthPayload(res);
				state.monthCache[cacheKey] = cached;
				if (hasMonthPayload_(cached)) {
					renderMonthFromData(cached);
					if (shouldBlockInitial) {
						hideBlockingOverlay();
						state.requireInitialBlocking = false;
					}
				}
				runLiveRefresh_(requestSeq, cacheKey, shouldBlockInitial && !hasMonthPayload_(cached));
			})
			.catch((err) => {
				if (requestSeq !== state.requestSeq) return;
				setStatus(err.message || String(err), true);
				runLiveRefresh_(requestSeq, cacheKey, shouldBlockInitial);
			});
	}

	function runLiveRefresh_(requestSeq, cacheKey, shouldBlockInitial) {
		fetchJson(apiUrl('refresh_month_events', { year: state.year, month: state.month }))
			.then((res) => {
				if (requestSeq !== state.requestSeq) return;
				const live = normalizeMonthPayload(res);
				state.monthCache[cacheKey] = live;
				state.liveCompleted[cacheKey] = true;
				renderMonthFromData(live);
				if (shouldBlockInitial) {
					hideBlockingOverlay();
					state.requireInitialBlocking = false;
				}
				state.isInitialLoad = false;
				setStatus('');
			})
			.catch((err) => {
				if (requestSeq !== state.requestSeq) return;
				state.liveCompleted[cacheKey] = true;
				if (shouldBlockInitial) {
					hideBlockingOverlay();
				}
				state.isInitialLoad = false;
				setStatus(err.message || String(err), true);
			});
	}

	function renderTitle() {
		const zone = document.getElementById('titleZone');
		const images = (state.titleImages || []).filter(Boolean).slice(0, 3);
		state.titleIndex = 0;
		if (state.titleFadeTimer) clearInterval(state.titleFadeTimer);
		if (!images.length) {
			zone.innerHTML = '';
			return;
		}

		zone.innerHTML = ['<div class="title-shell is-loaded">', '<div class="title-carousel" id="titleCarousel">']
			.concat(images.map((url) => '<div class="title-frame"><img class="title-image" src="' + esc(url) + '" alt="title" /></div>'))
			.concat(['</div>', '</div>'])
			.join('');

		const items = zone.querySelectorAll('.title-frame');
		if (items.length) {
			items[0].classList.add('is-active');
		}

		if (images.length > 1) {
			state.titleFadeTimer = setInterval(() => {
				state.titleIndex = (state.titleIndex + 1) % images.length;
				items.forEach((el, idx) => {
					if (idx === state.titleIndex) {
						el.classList.add('is-active');
					} else {
						el.classList.remove('is-active');
					}
				});
			}, Math.max(2, Number(state.config.headerRotationSec || 6)) * 1000);
		}
	}

	function renderFooterImage() {
		const section = document.getElementById('footerImageSection');
		const frame = document.getElementById('footerImageFrame');
		if (!section || !frame) return;

		if (!state.footerImageUrl) {
			section.style.display = 'none';
			frame.innerHTML = '';
			return;
		}

		section.style.display = '';
		frame.innerHTML = '<img class="footer-image" src="' + esc(state.footerImageUrl) + '" alt="footer" />';
	}

	function renderMonthLabel() {
		document.getElementById('monthLabel').textContent = state.month + '月';
	}

	function renderMonthFromData(data) {
		state.eventsByDate = data.eventsByDate || {};
		state.holidays = data.holidays || {};
		renderCalendar();
		renderAttraction();
	}

	function renderAttraction() {
		if (state.layoutMode !== '2col' && state.layoutMode !== '2row') {
			return;
		}

		const section = document.getElementById('attractionSection');
		const body = document.getElementById('attractionBody');
		if (!section || !body) return;

		const upcoming = collectUpcomingCapacityEvents_();
		const monthTotal = getCurrentMonthCapacityTotals_();

		if (monthTotal.taggedCount <= 0) {
			body.innerHTML = '';
			section.style.display = 'none';
			return;
		}

		const itemsHtml = upcoming.length
			? '<div class="attraction-list">' + upcoming.map((item) => {
				return [
					'<button type="button" class="attraction-item" data-attraction-event-id="' + esc(item.eventId) + '">',
					'  <div class="attraction-event-title">' + esc(item.title) + '</div>',
					'  <div class="attraction-event-count">人数 ' + esc(item.current + '/' + item.max) + '</div>',
					'</button>',
				].join('');
			}).join('') + '</div>'
			: '';

		body.innerHTML = [
			itemsHtml,
			'<div class="attraction-total">今月の合計人数: ' + esc(monthTotal.current + '/' + monthTotal.max) + '</div>',
		].join('');
		body.querySelectorAll('[data-attraction-event-id]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const eventId = btn.getAttribute('data-attraction-event-id');
				const ev = state.attractionEvents && state.attractionEvents[eventId];
				openModal(ev);
			});
		});
		section.style.display = '';
	}

	function collectUpcomingCapacityEvents_() {
		const tomorrow = new Date();
		tomorrow.setHours(0, 0, 0, 0);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const out = [];
		const seen = new Set();
		state.attractionEvents = {};
		Object.keys(state.monthCache).forEach((key) => {
			const payload = state.monthCache[key] || {};
			const eventsByDate = payload.eventsByDate || {};
			Object.keys(eventsByDate).forEach((dateKey) => {
				const events = eventsByDate[dateKey] || [];
				events.forEach((ev) => {
					const cap = parseCapacityTag_(ev.description || '');
					if (!cap) return;

					const start = new Date(ev.startIso || '');
					if (Number.isNaN(start.getTime()) || start < tomorrow) return;

					const eventId = buildAttractionEventId_(ev);
					if (seen.has(eventId)) return;
					seen.add(eventId);

					out.push({
						eventId,
						title: String(ev.title || '(無題)'),
						current: cap.current,
						max: cap.max,
						startTs: start.getTime(),
						event: ev,
					});
					state.attractionEvents[eventId] = ev;
				});
			});
		});

		out.sort((a, b) => a.startTs - b.startTs);
		return out.slice(0, 10);
	}

	function buildAttractionEventId_(ev) {
		return String(ev.calendarId || '') + '|' + String(ev.id || '') + '|' + String(ev.startIso || '');
	}

	function getCurrentMonthCapacityTotals_() {
		const now = new Date();
		const key = getMonthKey(now.getFullYear(), now.getMonth() + 1);
		const payload = state.monthCache[key] || {};
		const eventsByDate = payload.eventsByDate || {};
		let current = 0;
		let max = 0;
		let taggedCount = 0;

		Object.keys(eventsByDate).forEach((dateKey) => {
			const events = eventsByDate[dateKey] || [];
			events.forEach((ev) => {
				const cap = parseCapacityTag_(ev.description || '');
				if (!cap) return;
				taggedCount += 1;
				current += cap.current;
				max += cap.max;
			});
		});

		return { current, max, taggedCount };
	}

	function parseCapacityTag_(description) {
		const m = String(description || '').match(/\[\[\s*(\d+)\s*\/\s*(\d+)\s*\]\]/);
		if (!m) return null;
		return {
			current: Number(m[1] || 0),
			max: Number(m[2] || 0),
		};
	}

	function renderCalendar() {
		const grid = document.getElementById('calendarGrid');
		state.activeEvents = {};
		const firstDay = new Date(state.year, state.month - 1, 1);
		const daysInMonth = new Date(state.year, state.month, 0).getDate();
		const firstWeekday = firstDay.getDay();
		const weekRows = Math.max(5, Math.ceil((firstWeekday + daysInMonth) / 7));
		const gridStart = new Date(state.year, state.month - 1, 1 - firstWeekday);
		const currentMonthIndex = state.month - 1;
		const totalCells = weekRows * 7;

		grid.classList.toggle('rows-5', weekRows === 5);

		let html = '';
		for (let i = 0; i < totalCells; i++) {
			const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
			const day = cellDate.getDate();
			const inCurrentMonth = cellDate.getMonth() === currentMonthIndex;
			const dateKey = toDateKey(cellDate.getFullYear(), cellDate.getMonth() + 1, day);
			const dow = i % 7;
			const isHoliday = !!state.holidays[dateKey];
			const baseCls = dow === 0 || isHoliday ? 'sun' : dow === 6 ? 'sat' : 'weekday';
			const cls = baseCls + (inCurrentMonth ? '' : ' adjacent') + (isHoliday ? ' holiday' : '');

			const events = state.eventsByDate[dateKey] || [];

			html += '<div class="cell ' + cls + '">';
			html += '<div class="day-number">' + day + '</div>';

			events.slice(0, 3).forEach((ev, idx) => {
				const id = 'ev-' + dateKey + '-' + idx;
				html += '<button class="event-chip" data-event-id="' + esc(id) + '">' + esc(ev.title || '(無題)') + '</button>';
				state.activeEvents[id] = ev;
			});

			if (events.length > 3) {
				html += '<div class="event-more">+' + (events.length - 3) + '件</div>';
			}

			html += '</div>';
		}

		grid.innerHTML = html;
		grid.querySelectorAll('[data-event-id]').forEach((el) => {
			el.addEventListener('click', () => {
				const eventId = el.getAttribute('data-event-id');
				const ev = state.activeEvents[eventId];
				openModal(ev);
			});
		});
	}

	function openModal(ev) {
		if (!ev) return;
		state.modalEvent = ev;
		const backdrop = document.getElementById('modalBackdrop');
		const modal = document.querySelector('#modalBackdrop .modal');
		const body = document.getElementById('modalBody');
		body.innerHTML = [
			'<h3 class="modal-title">' + esc(ev.title) + '</h3>',
			'<p class="modal-time"><span class="modal-label">日時：</span>' + esc(formatDateRangeSingleLine(ev.startIso, ev.endIso, ev.isAllDay)) + '</p>',
			ev.location ? '<p class="modal-location"><span class="modal-label">場所：</span>' + esc(ev.location) + '</p>' : '',
			ev.description ? '<div class="modal-description">' + formatDescription_(ev.description) + '</div>' : '',
		].join('');
		body.scrollTop = 0;

		body.querySelectorAll('.modal-link').forEach((link) => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				window.open(link.href, '_blank');
			});
		});

		if (backdrop) backdrop.classList.add('is-open');
		document.body.classList.add('modal-open');
		if (modal) {
			modal.classList.remove('is-leaving');
			modal.classList.add('is-entering');
		}
	}

	function closeModal() {
		const backdrop = document.getElementById('modalBackdrop');
		const modal = document.querySelector('#modalBackdrop .modal');
		if (!backdrop || !modal || !backdrop.classList.contains('is-open')) return;
		state.modalEvent = null;

		modal.classList.remove('is-entering');
		modal.classList.add('is-leaving');
		setTimeout(() => {
			modal.classList.remove('is-leaving');
			backdrop.classList.remove('is-open');
			document.body.classList.remove('modal-open');
		}, 200);
	}

	function addToMyCalendar() {
		if (!state.modalEvent) return;
		const createUrl = buildGoogleCalendarCreateUrl(state.modalEvent);
		const url = buildGoogleAccountChooserUrl(createUrl);
		window.open(url, '_blank', 'noopener');
	}

	function moveMonth(diff) {
		const d = new Date(state.year, state.month - 1 + diff, 1);
		state.year = d.getFullYear();
		state.month = d.getMonth() + 1;
		renderMonthLabel();
		loadMonth();
	}

	function goToday() {
		const now = new Date();
		state.year = now.getFullYear();
		state.month = now.getMonth() + 1;
		renderMonthLabel();
		loadMonth();
	}

	function formatDateRangeSingleLine(startIso, endIso, allDay) {
		const s = new Date(startIso);
		const e = new Date(endIso);
		const date = s.getFullYear() + '/' + (s.getMonth() + 1) + '/' + s.getDate();
		if (allDay) {
			return date + ' 終日';
		}
		const from = String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0');
		const to = String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0');
		return date + ' ' + from + ' 〜 ' + to;
	}

	function toDateKey(y, m, d) {
		return String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
	}

	function setStatus(msg, isError) {
		const el = document.getElementById('status');
		if (!el) return;
		el.textContent = msg || '';
		el.className = 'msg ' + (isError ? 'err' : '');
	}

	function normalizeMonthPayload(res) {
		return {
			eventsByDate: (res && res.eventsByDate) || {},
			holidays: (res && res.holidays) || {},
			cacheUpdatedAt: (res && res.cacheUpdatedAt) || '',
		};
	}

	function emptyMonthData() {
		return { eventsByDate: {}, holidays: {}, cacheUpdatedAt: '' };
	}

	function getMonthKey(year, month) {
		return String(year) + '-' + String(month).padStart(2, '0');
	}

	function hasEventData_(monthData) {
		const eventsByDate = (monthData && monthData.eventsByDate) || {};
		const keys = Object.keys(eventsByDate);
		for (let i = 0; i < keys.length; i++) {
			const list = eventsByDate[keys[i]];
			if (Array.isArray(list) && list.length) return true;
		}
		return false;
	}

	function hasMonthPayload_(monthData) {
		if (!monthData) return false;
		if (hasEventData_(monthData)) return true;
		return !!String(monthData.cacheUpdatedAt || '').trim();
	}

	function showBlockingOverlay(message) {
		const overlay = document.getElementById('blockingOverlay');
		if (!overlay) return;
		const text = document.getElementById('loadingText');
		if (text) text.textContent = message || '予定読み込み中';
		overlay.classList.add('is-visible');
	}

	function hideBlockingOverlay() {
		const overlay = document.getElementById('blockingOverlay');
		if (!overlay) return;
		overlay.classList.remove('is-visible');
	}

	function buildGoogleCalendarCreateUrl(ev) {
		const base = 'https://calendar.google.com/calendar/r/eventedit';
		const params = new URLSearchParams();
		params.set('text', ev.title || '予定');
		params.set('details', ev.description || '');
		params.set('location', ev.location || '');

		if (ev.isAllDay) {
			const s = new Date(ev.startIso);
			const e = new Date(ev.endIso);
			const startDate = formatDateYYYYMMDD_(s);
			let endDate = formatDateYYYYMMDD_(e);
			if (startDate === endDate) {
				const next = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
				endDate = formatDateYYYYMMDD_(next);
			}
			params.set('dates', startDate + '/' + endDate);
		} else {
			params.set('dates', toGoogleUtc_(ev.startIso) + '/' + toGoogleUtc_(ev.endIso));
		}

		return base + '?' + params.toString();
	}

	function buildGoogleAccountChooserUrl(continueUrl) {
		const base = 'https://accounts.google.com/AccountChooser';
		const params = new URLSearchParams();
		params.set('continue', continueUrl);
		return base + '?' + params.toString();
	}

	function toGoogleUtc_(iso) {
		return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	}

	function formatDateYYYYMMDD_(d) {
		return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
	}

	function formatDescription_(text) {
		if (!text) return '';

		// Remove [[x/x]] capacity tags
		text = String(text).replace(/\[\[\d+\/\d+\]\]/g, '').trim();
		if (!text) return '';

		const ALLOWED = new Set(['br', 'p', 'a', 'ol', 'ul', 'li', 'u', 'strong', 'em', 'b', 'i']);
		const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

		function textToNodes(str) {
			const frag = document.createDocumentFragment();
			const parts = str.split(URL_RE);
			parts.forEach((part) => {
				if (URL_RE.test(part)) {
					const a = document.createElement('a');
					a.href = part;
					a.target = '_self';
					a.className = 'modal-link';
					a.textContent = part;
					frag.appendChild(a);
				} else if (part) {
					const lines = part.split('\n');
					lines.forEach((line, i) => {
						if (i > 0) frag.appendChild(document.createElement('br'));
						if (line) frag.appendChild(document.createTextNode(line));
					});
				}
				URL_RE.lastIndex = 0;
			});
			return frag;
		}

		function sanitize(node) {
			if (node.nodeType === 3) return textToNodes(node.textContent);
			if (node.nodeType !== 1) return null;
			const tag = node.tagName.toLowerCase();
			if (!ALLOWED.has(tag)) {
				const frag = document.createDocumentFragment();
				node.childNodes.forEach((c) => { const s = sanitize(c); if (s) frag.appendChild(s); });
				return frag;
			}
			const el = document.createElement(tag);
			if (tag === 'a') {
				const href = node.getAttribute('href') || '';
				if (/^https?:\/\//i.test(href)) {
					el.href = href;
					el.target = '_self';
					el.className = 'modal-link';
				}
			}
			node.childNodes.forEach((c) => { const s = sanitize(c); if (s) el.appendChild(s); });
			return el;
		}

		const tpl = document.createElement('template');
		tpl.innerHTML = text;
		const wrap = document.createElement('div');
		tpl.content.childNodes.forEach((c) => { const s = sanitize(c); if (s) wrap.appendChild(s); });
		return wrap.innerHTML;
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
