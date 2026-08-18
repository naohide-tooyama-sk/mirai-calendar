(function () {
	const boot = window.__BOOTSTRAP__ || {};
	const app = document.getElementById('app');
	let eventData = boot.event || null;

	render();
	if (!eventData && boot.eventId) loadEvent();
	window.addEventListener('pageshow', () => {
		document.body.classList.remove('detail-exit-right');
	});

	function apiUrl(action, params) {
		const url = new URL(boot.apiUrl || 'api.php', window.location.href);
		url.searchParams.set('action', action);
		Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
		return url.toString();
	}

	function loadEvent() {
		fetch(apiUrl('get_event_detail', { eventId: boot.eventId }))
			.then((res) => res.json().catch(() => ({})).then((body) => {
				if (!res.ok || !body || body.ok === false) throw new Error(body.message || '予定が見つかりません。');
				return body;
			}))
			.then((body) => {
				eventData = body.event;
				render();
			})
			.catch((err) => {
				app.innerHTML = '<div class="detail-error"><button class="detail-back" id="backBtn">‹ 戻る</button><p>' + esc(err.message || String(err)) + '</p></div>';
				document.getElementById('backBtn').addEventListener('click', goBack);
			});
	}

	function render() {
		if (!eventData) {
			app.innerHTML = '<div class="detail-loading">読み込み中...</div>';
			return;
		}

		const d = eventData.detail || {};
		const title = eventData.title || 'イベント';
		const subtitle = eventData.detailSubtitle || 'つながる。学ぶ。挑戦する。';
		const description = eventData.displayDescription || eventData.description || '';
		const imageUrl = eventData.catchImageUrl || 'assets/images/people.png';
		const applyUrl = String(eventData.applyUrl || '').trim();
		const assetBaseUrl = boot.assetBaseUrl || 'assets/images/';
		const calendarIconUrl = (boot.assetBaseUrl || 'assets/images/') + 'google_calendar.png';
		const typeIcon = categoryIcon(eventData);

		app.innerHTML = [
			'<main class="event-detail-v2">',
			'  <header class="detail-topbar">',
			'    <button type="button" class="detail-back" id="backBtn">‹ 戻る</button>',
			'    <img class="detail-logo" src="' + esc(assetBaseUrl + 'mirai_logo.png') + '" alt="未来勉強会">',
			'  </header>',
			'  <section class="detail-hero">',
			'    <img src="' + esc(imageUrl) + '" alt="">',
			'    <div class="detail-hero-shade"></div>',
			'    <div class="detail-hero-text">',
			eventData.categoryText ? '      <span class="detail-category ' + esc(categoryClass(eventData)) + '">' + (typeIcon ? '<img src="' + esc(assetBaseUrl + typeIcon) + '" alt="">' : '') + esc(eventData.categoryText) + '</span>' : '',
			'      <h1>' + esc(title) + '</h1>',
			'      <p>' + esc(subtitle) + '</p>',
			'    </div>',
			'  </section>',
			'  <section class="detail-summary">',
			summaryItem('開催日', formatDateParts(eventData.startIso), imageIcon(assetBaseUrl + 'schedule.png')),
			summaryItem('時間', formatTimeParts(eventData), imageIcon(assetBaseUrl + 'time.png')),
			summaryItem('場所', venueParts(eventData), imageIcon(assetBaseUrl + 'place.png')),
			summaryItem('定員', capacityParts(eventData), imageIcon(assetBaseUrl + 'team.png')),
			'  </section>',
			description ? plainCard('<div class="detail-description">' + formatDescription(description) + '</div>', 'text') : '',
			'  <div class="detail-bottom-actions">',
			applyUrl ? '    <button type="button" class="detail-apply" id="applyBtn"><span class="detail-apply-label">' + imageIcon(assetBaseUrl + 'edit.png') + 'このイベントに申し込む <b>›</b></span></button>' : '',
			'    <button type="button" class="detail-calendar" id="calendarBtn"><img src="' + esc(calendarIconUrl) + '" alt=""><span>Googleカレンダーに追加</span></button>',
			'  </div>',
			'</main>',
		].join('');

		document.getElementById('backBtn').addEventListener('click', goBack);
		document.getElementById('calendarBtn').addEventListener('click', addToGoogleCalendar);
		const applyBtn = document.getElementById('applyBtn');
		if (applyBtn) {
			applyBtn.addEventListener('click', () => window.open(applyUrl, '_blank', 'noopener'));
		}
	}

	function summaryItem(label, value, icon) {
		const valueHtml = label === '開催日' && value.length >= 3
			? '<span>' + esc(value[0]) + '</span><span class="detail-date-main"><span>' + esc(value[1]) + '</span><em>' + esc(value[2]) + '</em></span>'
			: value.map((line) => '<span>' + esc(line) + '</span>').join('');
		return '<div class="detail-summary-item' + (label === '定員' ? ' detail-capacity-item' : '') + '"><span class="detail-summary-icon">' + icon + '</span><small>' + esc(label) + '</small><strong>' + valueHtml + '</strong></div>';
	}

	function plainCard(body, kind) {
		return '<section class="detail-card detail-card-' + esc(kind) + ' detail-card-plain">' + body + '</section>';
	}

	function goBack() {
		document.body.classList.add('detail-exit-right');
		setTimeout(() => {
			if (history.length > 1) history.back();
			else window.location.href = boot.calendarUrl || 'index.php';
		}, 160);
	}

	function addToGoogleCalendar() {
		const base = 'https://calendar.google.com/calendar/r/eventedit';
		const params = new URLSearchParams();
		params.set('text', eventData.title || 'イベント');
		params.set('details', textOnly(eventData.displayDescription || eventData.description || ''));
		params.set('location', eventData.venueText || eventData.location || '');
		if (eventData.isAllDay) {
			const s = new Date(eventData.startIso);
			const e = new Date(eventData.endIso);
			params.set('dates', ymd(s) + '/' + ymd(e));
		} else {
			params.set('dates', googleUtc(eventData.startIso) + '/' + googleUtc(eventData.endIso));
		}
		window.open('https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(base + '?' + params.toString()), '_blank', 'noopener');
	}

	function formatDateParts(iso) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return ['未設定'];
		const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
		return [String(d.getFullYear()), (d.getMonth() + 1) + '.' + d.getDate(), w];
	}

	function formatTimeParts(ev) {
		const time = String(ev.timeText || '').trim();
		return [time || '詳細をご確認ください'];
	}

	function venueParts(ev) {
		const venue = String(ev.locationText || ev.venueText || '').trim();
		if (!venue) return ['詳細をご確認ください'];
		return venue.split(/\s*[／\/]\s*|\r?\n/).filter(Boolean).slice(0, 2);
	}

	function capacityParts(ev) {
		const capacity = String(ev.capacityText || '').trim();
		if (!capacity) return ['詳細をご確認ください'];
		const values = capacity.split(/\s*[／\/]\s*|\r?\n/).filter(Boolean).slice(0, 1);
		const remaining = String(ev.remainingText || '').trim();
		return remaining ? values.concat([remaining]) : values;
	}

	function formatTimeRange(ev) {
		if (ev.isAllDay) return '終日';
		const s = new Date(ev.startIso);
		const e = new Date(ev.endIso);
		return hm(s) + ' - ' + hm(e);
	}

	function hm(d) {
		return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
	}

	function ymd(d) {
		return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
	}

	function googleUtc(iso) {
		return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	}

	function cleanTitle(title) {
		return String(title || 'イベント').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'イベント';
	}

	function categoryClass(ev) {
		const text = String((ev && ev.categoryText) || '');
		return { '勉強会': 'cat-study', '交流会': 'cat-exchange', 'セミナー': 'cat-seminar', 'チャレンジ': 'cat-challenge', 'オンライン': 'cat-online' }[text] || 'cat-unset';
	}

	function categoryIcon(ev) {
		const type = String((ev && ev.categoryText) || '');
		return { '勉強会': 'study.png', '交流会': 'team.png', 'セミナー': 'seminar.png', 'チャレンジ': 'challenge.png', 'オンライン': 'online.png' }[type] || '';
	}

	function formatDescription(text) {
		const tpl = document.createElement('template');
		tpl.innerHTML = String(text || '').replace(/\[\[\d+\/\d+\]\]/g, '');
		tpl.content.querySelectorAll('script,style,iframe').forEach((el) => el.remove());
		tpl.content.querySelectorAll('a').forEach((a) => {
			const href = a.getAttribute('href') || '';
			if (!/^https?:\/\//i.test(href)) a.removeAttribute('href');
			a.target = '_blank';
			a.rel = 'noopener';
		});
		return tpl.innerHTML;
	}

	function imageIcon(src) {
		return '<img src="' + esc(src) + '" alt="">';
	}

	function textOnly(html) {
		const div = document.createElement('div');
		div.innerHTML = html;
		return div.textContent || div.innerText || '';
	}

	function esc(s) {
		return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
})();
