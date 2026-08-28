(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	const today = new Date();
	const currentMonthIndex = today.getFullYear() * 12 + today.getMonth();
	const pastMonths = Number.isInteger(boot.config && boot.config.pastMonths) ? boot.config.pastMonths : null;
	const futureMonths = Number.isInteger(boot.config && boot.config.futureMonths) ? boot.config.futureMonths : null;
	const minMonthIndex = pastMonths === null ? -Infinity : currentMonthIndex - pastMonths;
	const maxMonthIndex = futureMonths === null ? Infinity : currentMonthIndex + futureMonths;

	const state = {
		year: today.getFullYear(),
		month: today.getMonth() + 1,
		monthCache: {},
		eventsByDate: {},
		holidays: {},
		activeEvents: {},
		calendarCacheById: calendarCacheById(boot.calendarCache),
		recommended: Array.isArray(boot.recentEvents) ? boot.recentEvents : [],
		eventCache: Array.isArray(boot.eventCache) ? boot.eventCache : [],
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
			'  <section class="recommended-v2" id="recommendedSection">',
			'    <h2 class="recommend-heading-v2"><span class="recommend-dots-v2"></span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_left.png" alt=""><span>おすすめイベント</span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_right.png" alt=""><span class="recommend-dots-v2"></span></h2>',
			'    <div class="recommend-list-v2" id="recommendList"></div>',
			'  </section>',
			'  <section class="event-search-section"><h2 class="recommend-heading-v2"><span class="recommend-dots-v2"></span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_left.png" alt=""><span>イベントを検索する</span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_right.png" alt=""><span class="recommend-dots-v2"></span></h2><form id="eventSearchForm" class="event-search-form"><select id="eventType"><option value="">種別選択</option><option value="study">勉強会</option><option value="networking">交流会</option><option value="seminar">セミナー</option><option value="challenge">チャレンジ</option><option value="online">オンライン</option></select><select id="purpose"><option value="">参加目的選択</option><option value="networking">手軽に交流したい</option><option value="connections">人脈を増やしたい</option><option value="promotion">事業や自分をPRしたい</option><option value="startup">起業したい</option><option value="study">ビジネスを学びたい</option><option value="sports">体を動かしたい</option></select><button class="btn" type="submit">検索</button></form></section>',
			'  <section class="calendar-card-v2" id="calendarSection">',
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
			'  <section class="recommended-v2 event-list-section" id="eventListSection"><h2 class="recommend-heading-v2"><span class="recommend-dots-v2"></span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_left.png" alt=""><span>イベント一覧</span><img class="recommend-decoration-v2" src="assets/images/recomended_decoration_right.png" alt=""><span class="recommend-dots-v2"></span></h2><div class="recommend-list-v2" id="eventList"></div></section>',
			'</main>',
			'<nav class="floating-nav" aria-label="ページ内ナビゲーション">',
			'  <a href="#recommendedSection" aria-label="おすすめイベントへ"><img src="assets/images/recommended_button.png" alt="おすすめイベント"></a>',
			'  <a href="#calendarSection" aria-label="カレンダーへ"><img src="assets/images/calender_button.png" alt="カレンダー"></a>',
			'  <a href="#eventListSection" aria-label="イベント一覧へ"><img src="assets/images/events_button.png" alt="イベント一覧"></a>',
			'</nav>',
		].join('');
		document.querySelectorAll('.floating-nav a').forEach((link) => link.addEventListener('click', (event) => {
			event.preventDefault();
			const target = document.querySelector(link.getAttribute('href'));
			if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}));
		document.getElementById('prevMonth').addEventListener('click', () => moveMonth(-1));
		document.getElementById('nextMonth').addEventListener('click', () => moveMonth(1));
		document.getElementById('goToday').addEventListener('click', goToday);
		document.getElementById('eventSearchForm').addEventListener('submit', (event) => { event.preventDefault(); const q = new URLSearchParams(); const type = document.getElementById('eventType').value; const purpose = document.getElementById('purpose').value; if (type) q.set('eventType', type); if (purpose) q.set('purpose', purpose); window.location.href = 'search.php' + (q.toString() ? '?' + q : ''); });
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
		if (Array.isArray(data.calendarCache)) state.calendarCacheById = calendarCacheById(data.calendarCache);
		state.eventsByDate = data.eventsByDate || {};
		state.holidays = data.holidays || {};
		renderCalendar();
		renderRecommended();
		renderEventList();
		renderLegend();
	}

	function renderEventList() {
		const list = document.getElementById('eventList');
		if (!list) return;
		list.innerHTML = state.eventCache.map((item) => eventCard(item, false)).join('');
		list.querySelectorAll('.event-list-card-v2').forEach((card) => card.addEventListener('click', () => {
			openDetail({ eventId: card.dataset.eventId });
		}));
	}

	function eventCard(item, recommended) {
		const id = String(item.eventId || item.id || '');
		const detailUrl = 'detail.php?eventId=' + encodeURIComponent(id);
		const cardClass = recommended ? 'recommended-event-card-v2' : 'event-list-card-v2';
		const dateParts = formatRecommendDateParts(item);
		const date = '<strong class="recommend-date-v2"><span class="recommend-date-main-v2">' + esc(dateParts.date) + '</span>' + (dateParts.weekday ? '<span class="recommend-weekday-v2">' + esc(dateParts.weekday) + '</span>' : '') + '<span class="recommend-start-time">' + esc(formatCardTime(item)) + '</span></strong>';
		const typeClass = categoryClass(item);
		const typeIcon = categoryIcon(item) || categoryIconById(item.eventTypeId);
		const icon = typeIcon ? '<img class="recommend-type-icon ' + esc(typeClass) + '" src="assets/images/' + esc(typeIcon) + '" alt="">' : '';
		const details = recommended ? (() => {
			const summaryItems = [];
			const location = String(item.location || '').trim();
			if (location) summaryItems.push({ icon: 'place.png', value: location });
			const capacity = String(item.capacity ?? '').trim();
			const remaining = item.showRemaining && String(item.remainingNumber ?? '').trim() ? String(item.remainingNumber) : '';
			const capacityValue = [];
			if (capacity) capacityValue.push(esc(capacity));
			if (remaining) capacityValue.push('<span class="recommended-remaining-badge">' + esc(remaining) + '</span>');
			if (capacityValue.length) summaryItems.push({ icon: 'team.png', value: capacityValue.join(' ') });
			const fee = String(item.fee || '').trim();
			if (fee) summaryItems.push({ icon: 'price.png', value: fee });
			const summaryHtml = summaryItems.length ? '<div class="recommended-card-summary">' + summaryItems.map((entry) => '<div class="recommended-summary-item"><img class="recommended-summary-icon" src="assets/images/' + esc(entry.icon) + '" alt=""><span class="recommended-summary-value">' + entry.value + '</span></div>').join('') + '</div>' : '';
			const optional = [['対象者', item.targetAudience], ['参加メリット', item.merit], ['申し込み締め切り日時', item.applicationDeadline]].filter(([, value]) => String(value || '').trim()).map(([label, value]) => '<div><small>' + label + '</small><span>' + esc(value) + '</span></div>').join('');
			return '<div class="recommended-card-side"><div class="recommended-card-summary-wrap">' + summaryHtml + '</div>' + (optional ? '<div class="event-card-meta">' + optional + '</div>' : '') + '</div>';
		})() : '';
		const actions = recommended ? '<div class="event-card-actions"><a class="btn" href="' + esc(detailUrl) + '">詳細を見る</a>' + (item.applicationUrl ? '<a class="btn primary-admin-save" href="' + esc(item.applicationUrl) + '" target="_blank" rel="noopener">申し込む</a>' : '') + '</div>' : '';
		return '<article class="event-card-common ' + cardClass + ' ' + typeClass + '" data-detail-url="' + esc(detailUrl) + '" data-event-id="' + esc(id) + '">' + icon + '<div class="recommended-card-body"><div class="recommended-card-main"><div class="event-card-top"><img class="event-list-image" src="' + esc(item.mainImageUrl || 'assets/images/people.png') + '" alt=""></div><div class="event-card-content"><div class="event-card-date">' + date + '</div><h3>' + esc(item.shortTitle || item.title || 'イベント') + '</h3><p>' + esc(item.shortDescription || '') + '</p></div></div>' + details + '</div>' + actions + '</article>';
	}

	function formatCardDate(item) {
		const date = new Date(item.startTime || item.date || '');
		return Number.isNaN(date.getTime()) ? String(item.date || '') : (date.getMonth() + 1) + '/' + date.getDate();
	}

	function formatCardTime(item) {
		const date = new Date(item.startTime || '');
		return Number.isNaN(date.getTime()) ? String(item.startTime || '') : date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
	}

	function categoryIconById(id) {
		const icons = { study: 'study.png', networking: 'team.png', seminar: 'seminar.png', challenge: 'challenge.png', online: 'online.png' };
		return icons[id] ? '<img class="event-list-type-icon" src="assets/images/' + icons[id] + '" alt="">' : '';
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
				html += '<button type="button" class="event-chip-v2 ' + esc(categoryClass(ev)) + '" data-event-id="' + esc(id) + '">' + esc(calendarEventLabel(ev)) + '</button>';
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
		list.innerHTML = items.map((item) => eventCard(item, true)).join('');
		list.querySelectorAll('.recommended-event-card-v2').forEach((card) => card.addEventListener('click', (event) => {
			if (event.target.closest('a')) return;
			openDetail({ eventId: card.dataset.eventId });
		}));
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
		const id = String((ev && ev.eventTypeId) || '');
		if (id === 'online') return 'cat-online';
		if (id === 'challenge') return 'cat-challenge';
		if (id === 'seminar') return 'cat-seminar';
		if (id === 'networking') return 'cat-exchange';
		if (id === 'study') return 'cat-study';
		if (text === 'オンライン') return 'cat-online';
		if (text === 'チャレンジ') return 'cat-challenge';
		if (text === 'セミナー') return 'cat-seminar';
		if (text === '交流会') return 'cat-exchange';
		if (text === '勉強会') return 'cat-study';
		return 'cat-unset';
	}

	function categoryIcon(ev) {
		const type = String((ev && ev.categoryText) || '');
		const id = String((ev && ev.eventTypeId) || '');
		return { study: 'study.png', networking: 'team.png', seminar: 'seminar.png', challenge: 'challenge.png', online: 'online.png' }[id] || { '勉強会': 'study.png', '交流会': 'team.png', 'セミナー': 'seminar.png', 'チャレンジ': 'challenge.png', 'オンライン': 'online.png' }[type] || '';
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
			calendarCache: (res && res.calendarCache) || [],
			cacheUpdatedAt: (res && res.cacheUpdatedAt) || '',
		};
	}

	function emptyMonthData() {
		return { eventsByDate: {}, holidays: {}, calendarCache: [], cacheUpdatedAt: '' };
	}

	function calendarCacheById(rows) {
		return (Array.isArray(rows) ? rows : []).reduce((map, row) => {
			const id = String(row && row.eventId || '');
			if (id) map[id] = row;
			return map;
		}, {});
	}

	function calendarEventLabel(event) {
		const cached = state.calendarCacheById[String(event && (event.id || event.eventId) || '')] || {};
		const title = String(cached.shortTitle || '').trim() || String(event && (event.title || event.titleText) || 'イベント');
		const startTime = String(cached.startTime || '').trim();
		if (!startTime) return title;
		const match = startTime.match(/[T\s](\d{2}):(\d{2})/);
		return match ? title + ' ' + match[1] + ':' + match[2] : title;
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
