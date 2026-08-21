(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const today = new Date();
	const currentMonthIndex = today.getFullYear() * 12 + today.getMonth();
	const minMonthIndex = currentMonthIndex - 2;
	const maxMonthIndex = currentMonthIndex + 2;

	const state = {
		year: today.getFullYear(),
		month: today.getMonth() + 1,
		monthCache: {},
		eventsByDate: {},
		holidays: {},
		activeEvents: {},
		recommended: Array.isArray(boot.recentEvents) ? boot.recentEvents : [],
		requestSeq: 0,
	};

	renderShell();
	initialize();
	window.addEventListener('pageshow', () => {
		document.body.classList.remove('page-exit-left');
	});

	function apiUrl(action, params) {
		const url = new URL('api.php', window.location.href);
		url.searchParams.set('action', action);
		Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
		return url.toString();
	}

	function fetchJson(url) {
		return fetch(url).then((res) => res.json().catch(() => ({})).then((body) => {
			if (!res.ok || !body || body.ok === false) throw new Error(body.message || 'APIエラー');
			return body;
		}));
	}

	function renderShell() {
		app.innerHTML = [
			'<main class="v2-main">',
			'  <section class="hero-v2">',
			'    <img class="hero-logo" src="assets/images/mirai_logo.png" alt="未来勉強会">',
			'    <img class="hero-title" src="assets/images/title.png" alt="イベントカレンダー">',
			'  </section>',
			'  <section class="calendar-card-v2">',
			'    <div class="month-v2">',
			'      <button type="button" class="month-arrow prev" id="prevMonth" aria-label="前の月">‹</button>',
			'      <button type="button" class="month-label-v2" id="goToday"></button>',
			'      <button type="button" class="month-arrow next" id="nextMonth" aria-label="次の月">›</button>',
			'    </div>',
			'    <div class="weekday-row-v2"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div>',
			'    <div class="calendar-grid-v2" id="calendarGrid"></div>',
			'    <div class="legend-v2" id="legend"></div>',
			'  </section>',
			'  <div class="msg v2-status" id="status"></div>',
			'  <section class="recommended-v2" id="recommendedSection">',
			'    <h2 class="recommend-heading-v2"><span class="recommend-dots-v2"></span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_left.png" alt=""><span>おすすめイベント</span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_right.png" alt=""><span class="recommend-dots-v2"></span></h2>',
			'    <div class="recommend-list-v2" id="recommendList"></div>',
			'  </section>',
			'</main>',
		].join('');
		document.getElementById('prevMonth').addEventListener('click', () => moveMonth(-1));
		document.getElementById('nextMonth').addEventListener('click', () => moveMonth(1));
		document.getElementById('goToday').addEventListener('click', goToday);
	}

	function initialize() {
		const key = monthKey(state.year, state.month);
		if (boot.cacheData) state.monthCache[key] = normalizeMonthPayload(boot.cacheData);
		renderMonthLabel();
		renderMonthFromData(state.monthCache[key] || emptyMonthData());
		loadMonth();
	}

	function loadMonth() {
		const seq = ++state.requestSeq;
		const key = monthKey(state.year, state.month);
		setStatus('予定を読み込み中...');
		if (state.monthCache[key]) renderMonthFromData(state.monthCache[key]);
		else renderMonthFromData(emptyMonthData());

		fetchJson(apiUrl('get_cached_month_events', { year: state.year, month: state.month }))
			.then((res) => {
				if (seq !== state.requestSeq) return;
				state.monthCache[key] = normalizeMonthPayload(res);
				renderMonthFromData(state.monthCache[key]);
				return fetchJson(apiUrl('refresh_month_events', { year: state.year, month: state.month }));
			})
			.then((res) => {
				if (!res || seq !== state.requestSeq) return;
				state.monthCache[key] = normalizeMonthPayload(res);
				renderMonthFromData(state.monthCache[key]);
				setStatus('');
			})
			.catch((err) => setStatus(err.message || String(err), true));
	}

	function renderMonthFromData(data) {
		state.eventsByDate = data.eventsByDate || {};
		state.holidays = data.holidays || {};
		renderCalendar();
		renderRecommended();
		renderLegend();
	}

	function renderMonthLabel() {
		document.getElementById('goToday').textContent = String(state.year) + '.' + String(state.month).padStart(2, '0');
		updateMonthNavigation();
	}

	function updateMonthNavigation() {
		const index = state.year * 12 + state.month - 1;
		document.getElementById('prevMonth').disabled = index <= minMonthIndex;
		document.getElementById('nextMonth').disabled = index >= maxMonthIndex;
	}

	function renderCalendar() {
		const grid = document.getElementById('calendarGrid');
		state.activeEvents = {};
		const first = new Date(state.year, state.month - 1, 1);
		const days = new Date(state.year, state.month, 0).getDate();
		const start = new Date(state.year, state.month - 1, 1 - first.getDay());
		const rows = Math.max(5, Math.ceil((first.getDay() + days) / 7));
		const cells = rows * 7;
		grid.classList.toggle('rows-5', rows === 5);
		const weekEventCounts = Array.from({ length: rows }, () => 1);
		for (let i = 0; i < cells; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			const dateKey = toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
			const count = (state.eventsByDate[dateKey] || []).length;
			const week = Math.floor(i / 7);
			weekEventCounts[week] = Math.max(weekEventCounts[week], count || 1);
		}
		grid.style.gridTemplateRows = weekEventCounts.map((count) => (34 + count * 34) + 'px').join(' ');

		let html = '';
		for (let i = 0; i < cells; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			const dateKey = toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
			const current = d.getMonth() === state.month - 1;
			const dow = i % 7;
			const holiday = !!state.holidays[dateKey];
			const cls = (dow === 0 || holiday ? ' sun' : dow === 6 ? ' sat' : '') + (current ? '' : ' adjacent');
			html += '<div class="cell-v2' + cls + '"><div class="day-number-v2">' + d.getDate() + '</div>';
			(state.eventsByDate[dateKey] || []).forEach((ev, idx) => {
				const id = dateKey + '-' + idx;
				state.activeEvents[id] = ev;
				html += '<button type="button" class="event-chip-v2 ' + esc(categoryClass(ev)) + '" data-event-id="' + esc(id) + '">' + esc(ev.title || ev.titleText || 'イベント') + '</button>';
			});
			html += '</div>';
		}
		grid.innerHTML = html;
		grid.querySelectorAll('[data-event-id]').forEach((el) => {
			el.addEventListener('click', () => openDetail(state.activeEvents[el.getAttribute('data-event-id')]));
		});
	}

	function renderRecommended() {
		const list = document.getElementById('recommendList');
		const section = document.getElementById('recommendedSection');
		const items = [...state.recommended]
			.filter((item) => item && (item.eventId || item.id))
			.sort((a, b) => compareRecommendDate(a, b))
			.slice(0, 10);
		if (!items.length) {
			section.style.display = 'none';
			return;
		}
		section.style.display = '';
		list.innerHTML = items.map((item) => {
			const eventId = String(item.eventId || item.id || '');
			const dateParts = formatRecommendDateParts(item);
			const icon = categoryIcon(item);
			return [
				'<button type="button" class="recommend-card-v2" data-recommend-id="' + esc(eventId) + '">',
				icon ? '  <img class="recommend-type-icon ' + esc(categoryClass(item)) + '" src="assets/images/' + esc(icon) + '" alt="">' : '',
				item.catchImageUrl ? '  <img src="' + esc(item.catchImageUrl) + '" alt="">' : '  <span class="recommend-image-fallback"></span>',
				'  <span class="recommend-body-v2">',
				'    <strong class="recommend-date-v2"><span class="recommend-date-main-v2">' + esc(dateParts.date) + '</span>' + (dateParts.weekday ? '<span class="recommend-weekday-v2">' + esc(dateParts.weekday) + '</span>' : '') + '</strong>',
				'    <span class="recommend-title-v2">' + esc(item.titleText || item.title || 'イベント') + '</span>',
				'    <span class="recommend-lead-v2">' + esc(item.leadText || item.remainingText || item.remainingTextDetail || '詳細をチェックしよう。') + '</span>',
				'  </span>',
				'</button>',
			].join('');
		}).join('');
		list.querySelectorAll('[data-recommend-id]').forEach((el) => {
			el.addEventListener('click', () => {
				const eventId = el.getAttribute('data-recommend-id');
				const ev = items.find((item) => String(item.eventId || item.id || '') === eventId);
				openDetail(ev);
			});
		});
	}

	function renderLegend() {
		const legend = document.getElementById('legend');
		const names = ['勉強会', '交流会', 'セミナー', 'チャレンジ', 'オンライン'];
		legend.innerHTML = names.map((name) => '<span><i class="' + esc(categoryClass({ categoryText: name, title: name })) + '"></i>' + esc(name) + '</span>').join('');
	}

	function openDetail(ev) {
		if (!ev) return;
		const eventId = String(ev.eventId || ev.id || '');
		if (!eventId) return;
		document.body.classList.add('page-exit-left');
		setTimeout(() => {
			window.location.href = 'detail.php?eventId=' + encodeURIComponent(eventId);
		}, 170);
	}

	function moveMonth(diff) {
		const targetIndex = state.year * 12 + state.month - 1 + diff;
		if (targetIndex < minMonthIndex || targetIndex > maxMonthIndex) return;
		const d = new Date(Math.floor(targetIndex / 12), targetIndex % 12, 1);
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

	function categoryClass(ev) {
		const text = String((ev && ev.categoryText) || '');
		if (text === 'オンライン') return 'cat-online';
		if (text === 'チャレンジ') return 'cat-challenge';
		if (text === 'セミナー') return 'cat-seminar';
		if (text === '交流会') return 'cat-exchange';
		if (text === '勉強会') return 'cat-study';
		return 'cat-unset';
	}

	function categoryIcon(ev) {
		const type = String((ev && ev.categoryText) || '');
		return { '勉強会': 'study.png', '交流会': 'team.png', 'セミナー': 'seminar.png', 'チャレンジ': 'challenge.png', 'オンライン': 'online.png' }[type] || '';
	}

	function formatEventDate(iso) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
		return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + weekdays[d.getDay()] + ')';
	}

	function compareRecommendDate(a, b) {
		const aTime = recommendDateTime(a);
		const bTime = recommendDateTime(b);
		if (aTime === bTime) return 0;
		if (aTime == null && bTime != null) return 1;
		if (aTime != null && bTime == null) return -1;
		return aTime - bTime;
	}

	function recommendDateTime(item) {
		if (!item) return null;
		const value = item.startIso || item.startDate || item.dateText || item.date || '';
		if (!value) return null;
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? null : d.getTime();
	}

	function formatRecommendDateParts(item) {
		const iso = item && item.startIso;
		if (iso) {
			const d = new Date(iso);
			if (!Number.isNaN(d.getTime())) {
				const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
				return {
					date: (d.getMonth() + 1) + '/' + d.getDate(),
					weekday: weekdays[d.getDay()],
				};
			}
		}
		const fromIso = formatEventDate(item && item.startIso);
		const text = fromIso || String((item && item.dateText) || '').trim();
		const m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\s*\(?([日月火水木金土])\)?)?/);
		if (m) {
			return {
				date: m[1] + '/' + m[2],
				weekday: m[3] || '',
			};
		}
		return { date: text, weekday: '' };
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

	function monthKey(year, month) {
		return String(year) + '-' + String(month).padStart(2, '0');
	}

	function toDateKey(y, m, d) {
		return String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
	}

	function setStatus(msg, isError) {
		const el = document.getElementById('status');
		if (!el) return;
		el.textContent = msg || '';
		el.className = 'msg v2-status ' + (isError ? 'err' : '');
	}

	function esc(s) {
		return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
})();
