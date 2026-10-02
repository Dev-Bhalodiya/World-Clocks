/*!
 * Meridian — a minimal world clock.
 * MIT License. No dependencies, no build step.
 */
(() => {
  'use strict';

  const Z = window.MERIDIAN_ZONES;
  const STORAGE_KEY = 'meridian:v1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EASE = 'cubic-bezier(.16, 1, .3, 1)';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad2 = n => String(n).padStart(2, '0');
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const ICON = {
    sun: '<svg class="i i-sun" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    moon: '<svg class="i i-moon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-5M8 3h8l-1 6 3 3.5H6L9 9 8 3z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  /* ────────────────────────────────────────────────
     Time zone maths
     ──────────────────────────────────────────────── */
  const fmtCache = new Map();
  function getFmt(tz) {
    let f = fmtCache.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', weekday: 'short',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
      fmtCache.set(tz, f);
    }
    return f;
  }
  const validTz = tz => { try { getFmt(tz); return true; } catch (_) { return false; } };
  const canon = tz => { try { return getFmt(tz).resolvedOptions().timeZone; } catch (_) { return tz; } };

  const LOCAL_TZ = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; }
  })();

  function zoneParts(ms, tz) {
    const o = {};
    for (const p of getFmt(tz).formatToParts(ms)) if (p.type !== 'literal') o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, wd: o.weekday };
  }
  const offsetMin = (p, ms) => Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
  const dayNum = p => Math.floor(Date.UTC(p.y, p.mo - 1, p.d) / 864e5);

  function fmtOffset(min) {
    if (!min) return 'UTC';
    const a = Math.abs(min);
    return `UTC${min < 0 ? '−' : '+'}${Math.floor(a / 60)}${a % 60 ? ':' + pad2(a % 60) : ''}`;
  }
  function fmtDiff(min) {
    if (!min) return 'Same time';
    const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
    return `${[h && h + 'h', m && m + 'm'].filter(Boolean).join(' ')} ${min > 0 ? 'ahead' : 'behind'}`;
  }
  function fmtShift(min) {
    if (!min) return 'Now';
    const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
    return `${min < 0 ? '−' : '+'}${[h && h + 'h', m && m + 'm'].filter(Boolean).join(' ')}`;
  }
  const hour12Of = h => h % 12 || 12;
  function fmtTime(p, hour12) {
    return hour12 ? `${hour12Of(p.h)}:${pad2(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}` : `${pad2(p.h)}:${pad2(p.mi)}`;
  }

  /* ────────────────────────────────────────────────
     Sky: every city's card is tinted by its local time
     ──────────────────────────────────────────────── */
  const SKY = [ // hour, top colour, horizon colour
    [0,    [5, 8, 20],    [9, 13, 34]],
    [4.5,  [8, 12, 32],   [22, 24, 58]],
    [6,    [20, 26, 58],  [92, 56, 70]],
    [7.5,  [24, 38, 78],  [120, 86, 84]],
    [10,   [24, 52, 98],  [46, 86, 138]],
    [13,   [26, 56, 104], [50, 92, 146]],
    [16.5, [26, 46, 92],  [88, 84, 110]],
    [18,   [32, 36, 84],  [150, 84, 72]],
    [19.5, [24, 24, 64],  [96, 52, 82]],
    [21,   [10, 14, 38],  [28, 28, 70]],
    [24,   [5, 8, 20],    [9, 13, 34]]
  ];
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  function skyAt(t) {
    for (let i = 1; i < SKY.length; i++) {
      if (t <= SKY[i][0]) {
        const a = SKY[i - 1], b = SKY[i], k = (t - a[0]) / (b[0] - a[0]);
        return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  function starsAt(t) {
    if (t < 4.5 || t >= 21) return 1;
    if (t < 7) return (7 - t) / 2.5;
    if (t >= 19) return (t - 19) / 2;
    return 0;
  }

  /* ────────────────────────────────────────────────
     Catalog: curated cities + every IANA zone
     ──────────────────────────────────────────────── */
  const regionOf = id => id.includes('/') ? id.split('/').slice(0, -1).join(' / ').replace(/_/g, ' ') : '';
  const cityOf = id => Z.names[id] || id.split('/').pop().replace(/_/g, ' ');

  const wordsOf = text => norm(text).split(/[^a-z0-9]+/).filter(Boolean);

  const curated = Z.cities.map(line => {
    const [name, tz, sub, kw = ''] = line.split('|');
    return { name, tz, sub, kw };
  }).filter(it => validTz(it.tz)).map(it => ({
    ...it,
    c: canon(it.tz),
    nameN: norm(it.name),
    words: wordsOf([it.name, it.sub, Z.aliases[it.sub] || '', it.kw, it.tz.replace(/[_/]/g, ' ')].join(' ')),
    meta: wordsOf([it.sub, Z.aliases[it.sub] || '', it.kw].join(' ')), // country, nicknames, abbreviations
    curated: true
  }));

  let catalog = null;
  function getCatalog() {
    if (catalog) return catalog;
    const items = curated.slice();
    const seen = new Set(items.map(i => i.nameN + '|' + i.c));
    let ids = [];
    try { ids = Intl.supportedValuesOf('timeZone'); } catch (_) { /* older browsers: curated list only */ }
    for (const id of ids) {
      if (id.startsWith('Etc/')) continue;
      const name = cityOf(id), nameN = norm(name), c = canon(id), key = nameN + '|' + c;
      if (seen.has(key)) continue;
      seen.add(key);
      const sub = regionOf(id);
      items.push({ name, tz: id, sub, kw: '', c, nameN, words: wordsOf([name, sub, id.replace(/[_/]/g, ' ')].join(' ')), meta: wordsOf(sub), curated: false });
    }
    return (catalog = items);
  }

  function countryOf(tz) {
    const c = canon(tz);
    const hit = curated.find(i => i.c === c);
    return hit ? hit.sub : regionOf(tz);
  }

  function search(raw) {
    const q = norm(raw.trim());
    const out = [];

    // Custom fixed offsets: "utc+5", "gmt-8"
    const m = /^(?:utc|gmt)\s*([+-])\s*(\d{1,2})$/.exec(q);
    if (m) {
      const h = +m[2], plus = m[1] === '+';
      if (plus ? h <= 14 : h <= 12) {
        const tz = h === 0 ? 'UTC' : `Etc/GMT${plus ? '-' : '+'}${h}`;
        if (validTz(tz)) out.push({ name: h === 0 ? 'UTC' : `UTC${plus ? '+' : '−'}${h}`, tz, sub: 'Fixed offset', custom: true });
      }
    }
    if (!q) return out;

    const terms = q.split(/\s+/);
    const scored = [];
    getCatalog().forEach((it, idx) => {
      if (!terms.every(t => it.words.some(w => w.startsWith(t)))) return;
      let s = 10;
      if (it.nameN === q) s = 100;
      else if (terms.length === 1 && it.meta.includes(q) && !it.nameN.split(/[^a-z0-9]+/).includes(q)) s = 90; // country, nickname or abbreviation
      else if (it.nameN.startsWith(q)) s = 80;
      else if (it.nameN.split(/[^a-z0-9]+/).some(w => w.startsWith(terms[0]))) s = 60;
      if (it.curated) s += 5;
      scored.push([s, idx, it]);
    });
    scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]); // ties keep the curated order (big cities first)
    return out.concat(scored.slice(0, 60).map(x => x[2]));
  }

  function popularItems() {
    return Z.popular.map(n => curated.find(i => i.name === n)).filter(Boolean);
  }

  /* ────────────────────────────────────────────────
     State
     ──────────────────────────────────────────────── */
  const state = { clocks: [], hour12: false, seconds: true, shift: 0, perRow: 0, topRow: 1 };

  const clampInt = (v, lo, hi, dflt) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; };

  function defaultClocks() {
    const out = [], seen = new Set();
    const add = (tz, name, sub) => {
      const c = canon(tz);
      if (seen.has(c) || !validTz(tz)) return;
      seen.add(c);
      out.push({ id: uid(), tz, name, sub });
    };
    add(LOCAL_TZ, cityOf(LOCAL_TZ), countryOf(LOCAL_TZ));
    ['New York', 'London', 'Dubai', 'Singapore', 'Tokyo', 'Sydney'].forEach(n => {
      const it = curated.find(i => i.name === n);
      if (it) add(it.tz, it.name, it.sub);
    });
    return out;
  }

  /* ────────────────────────────────────────────────
     Saving: every change is written to this device straight away,
     so closing the tab or returning later restores exactly this setup.
     ──────────────────────────────────────────────── */
  const MAX_CLOCKS = 40;
  let storageOk = true;
  try { localStorage.setItem('__meridian', '1'); localStorage.removeItem('__meridian'); } catch (_) { storageOk = false; }

  function readStore() {
    if (!storageOk) return null;
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
  }

  // Accepts anything (saved data, another tab, a shared link) and returns clean state, or null.
  function sanitize(raw) {
    if (!raw || !Array.isArray(raw.clocks)) return null;
    const clean = raw.clocks.slice(0, MAX_CLOCKS)
      .filter(e => e && typeof e.tz === 'string' && validTz(e.tz))
      .map(e => ({
        id: String(e.id || uid()).slice(0, 24),
        tz: e.tz,
        name: String(e.name || cityOf(e.tz)).slice(0, 60),
        sub: String(e.sub || '').slice(0, 60)
      }));
    return {
      clocks: clean,
      hour12: !!raw.hour12,
      seconds: raw.seconds !== false,
      perRow: clampInt(raw.perRow, 0, 6, 0), // 0 = Auto
      topRow: clampInt(raw.topRow, 1, 6, 1)
    };
  }

  // First visit: follow the device's own 12/24-hour habit.
  const prefers12h = () => {
    try {
      const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
      return hc === 'h12' || hc === 'h11';
    } catch (_) { return false; }
  };

  function save() {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, clocks: state.clocks, hour12: state.hour12, seconds: state.seconds, perRow: state.perRow, topRow: state.topRow }));
    } catch (_) {
      storageOk = false;
      showSaveStatus();
    }
  }

  function load() {
    const saved = sanitize(readStore());
    if (saved) {
      Object.assign(state, saved);
      return true;
    }
    state.clocks = defaultClocks();
    state.hour12 = prefers12h();
    save(); // remember the starting setup too, so it never changes under the person
    return false;
  }

  // Another tab on this device changed something: follow it.
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    let next = null;
    try { next = sanitize(JSON.parse(e.newValue)); } catch (_) { /* ignore */ }
    if (!next) return;
    Object.assign(state, next);
    applySettings();
    render();
  });

  /* Share link: carry a setup to another phone or computer. */
  const toB64 = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64 = str => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)));

  function shareUrl() {
    const payload = { c: state.clocks.map(e => [e.tz, e.name, e.sub]), h: state.hour12 ? 1 : 0, s: state.seconds ? 1 : 0, pr: state.perRow, tr: state.topRow };
    return location.href.split('#')[0] + '#setup=' + toB64(JSON.stringify(payload));
  }

  function readSharedHash() {
    const m = /^#setup=([\w-]+)$/.exec(location.hash);
    if (!m) return null;
    try {
      const p = JSON.parse(fromB64(m[1]));
      return sanitize({
        clocks: (p.c || []).map(r => ({ tz: r[0], name: r[1], sub: r[2] })),
        hour12: p.h === 1,
        seconds: p.s !== 0,
        perRow: p.pr,
        topRow: p.tr
      });
    } catch (_) { return null; }
  }

  /* ────────────────────────────────────────────────
     Rolling digits
     ──────────────────────────────────────────────── */
  function makeDigit() {
    const el = document.createElement('span');
    el.className = 'dg';
    el.appendChild(Object.assign(document.createElement('span'), { className: 'dg-c' }));
    el._v = null;
    return el;
  }

  function setDigit(el, v, animate, delay = 0) {
    if (el._v === v) return;
    const first = el._v === null;
    el._v = v;
    const cur = el.firstChild;
    el.classList.toggle('empty', v === '');
    if (animate && !reduceMotion) {
      if (!first) {
        const old = document.createElement('span');
        old.className = 'dg-o';
        old.textContent = cur.textContent;
        el.appendChild(old);
        old.animate(
          [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-55%)', opacity: 0 }],
          { duration: 420, easing: 'cubic-bezier(.5, 0, .8, .4)', delay }
        ).onfinish = () => old.remove();
      }
      cur.textContent = v;
      cur.animate(
        [{ transform: 'translateY(55%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 600, easing: EASE, delay, fill: 'backwards' }
      );
    } else {
      cur.textContent = v;
    }
  }

  /* ────────────────────────────────────────────────
     Clock cards
     ──────────────────────────────────────────────── */
  const heroEl = $('#hero');
  const gridEl = $('#grid');
  const mainEl = $('main');
  const GAP = 14, MIN_CARD = 160; // smallest card width we allow before dropping a column
  const emptyEl = $('#empty');
  const clocks = new Map(); // id -> clock

  function createClock(entry, delayBase, intro) {
    const el = document.createElement('article');
    el.className = 'clock';
    el.dataset.id = entry.id;
    el.innerHTML = `
      <div class="sky" aria-hidden="true"><i class="stars"></i></div>
      <header class="c-head">
        <div class="c-id">
          <h2 class="c-name"><span class="c-city"></span><span class="chip" hidden>Local</span></h2>
          <div class="c-sub"><span class="c-country"></span><span class="c-off"></span></div>
        </div>
        <div class="c-actions">
          <button class="c-btn" type="button" data-act="pin" aria-label="Make primary" title="Make primary">${ICON.pin}</button>
          <button class="c-btn" type="button" data-act="del" aria-label="Remove clock" title="Remove">${ICON.x}</button>
        </div>
      </header>
      <div class="c-time" aria-hidden="true"></div>
      <p class="sr"></p>
      <div class="ruler" aria-hidden="true"><i class="now"></i></div>
      <footer class="c-foot">
        <span class="c-when">${ICON.sun}${ICON.moon}<span class="c-date"></span><span class="c-rel"></span></span>
        <span class="c-diff"></span>
      </footer>`;

    const d = { h1: makeDigit(), h2: makeDigit(), m1: makeDigit(), m2: makeDigit(), s1: makeDigit(), s2: makeDigit() };
    const hm = Object.assign(document.createElement('span'), { className: 'hm' });
    const colon = Object.assign(document.createElement('span'), { className: 'colon', innerHTML: '<i></i><i></i>' });
    hm.append(d.h1, d.h2, colon, d.m1, d.m2);
    const side = Object.assign(document.createElement('span'), { className: 'side' });
    const sec = Object.assign(document.createElement('span'), { className: 'sec' });
    const ampm = Object.assign(document.createElement('span'), { className: 'ampm' });
    sec.append(d.s1, d.s2);
    side.append(sec, ampm);
    $('.c-time', el).append(hm, side);

    $('.c-city', el).textContent = entry.name;
    $('.c-country', el).textContent = entry.sub;
    const isLocal = canon(entry.tz) === canon(LOCAL_TZ);
    $('.chip', el).hidden = !isLocal;

    return {
      id: entry.id, tz: entry.tz, name: entry.name, isLocal, el, d, ampm, delayBase, intro,
      off: $('.c-off', el), date: $('.c-date', el), rel: $('.c-rel', el), diff: $('.c-diff', el),
      now: $('.now', el), sr: $('.sr', el),
      _mk: null, _ap: null, skyB: '9,13,34', label: ''
    };
  }

  function updateClock(c, now, L, animate, force) {
    const p = zoneParts(now, c.tz);
    const h12 = state.hour12;
    const H = h12 ? hour12Of(p.h) : p.h;
    const base = c.delayBase, step = c.intro ? 45 : 0;
    const ap = h12 ? (p.h < 12 ? 'AM' : 'PM') : '';

    setDigit(c.d.h1, h12 && H < 10 ? '' : String(Math.floor(H / 10)), animate, base);
    setDigit(c.d.h2, String(H % 10), animate, base + step);
    setDigit(c.d.m1, String(Math.floor(p.mi / 10)), animate, base + step * 2);
    setDigit(c.d.m2, String(p.mi % 10), animate, base + step * 3);
    const animSec = animate && state.seconds;
    setDigit(c.d.s1, String(Math.floor(p.s / 10)), animSec, base + step * 4);
    setDigit(c.d.s2, String(p.s % 10), animSec, base + step * 5);
    if (c._ap !== ap) { c.ampm.textContent = ap; c._ap = ap; }
    c.delayBase = 0;
    c.intro = false;

    const mk = `${p.d}.${p.h}.${p.mi}.${h12}`;
    if (!force && mk === c._mk) return;
    c._mk = mk;

    const t = p.h + p.mi / 60;
    const [a, b] = skyAt(t);
    c.skyB = b.join(',');
    c.el.style.setProperty('--sky-a', a.join(','));
    c.el.style.setProperty('--sky-b', c.skyB);
    c.el.style.setProperty('--stars', starsAt(t).toFixed(2));
    c.el.classList.toggle('is-night', t < 6 || t >= 19);
    c.now.style.left = ((p.h * 60 + p.mi) / 14.4).toFixed(2) + '%';

    const off = offsetMin(p, now);
    c.off.textContent = fmtOffset(off);
    c.diff.textContent = c.isLocal ? 'Your time' : fmtDiff(off - L.off);
    c.date.textContent = `${p.wd} ${p.d} ${MONTHS[p.mo - 1]}`;
    const rel = dayNum(p) - L.day;
    c.rel.textContent = rel === 1 ? 'tomorrow' : rel === -1 ? 'yesterday' : '';
    c.label = fmtTime(p, h12);
    c.sr.textContent = `${c.name}, ${c.label}, ${c.date.textContent}`;
  }

  /* ────────────────────────────────────────────────
     Layout: how many clocks per row
     ──────────────────────────────────────────────── */
  const topCount = () => Math.min(state.topRow, state.clocks.length);

  // Apply the chosen column counts, never letting cards shrink below MIN_CARD (so phones stay readable).
  function layout() {
    const w = mainEl.clientWidth || 1;
    const fit = Math.max(1, Math.floor((w + GAP) / (MIN_CARD + GAP)));
    const cardW = n => (w - GAP * (n - 1)) / n;

    const tCols = Math.max(1, Math.min(state.topRow, fit, topCount() || 1));
    heroEl.style.gridTemplateColumns = `repeat(${tCols}, minmax(0, 1fr))`;
    heroEl.classList.toggle('multi', tCols > 1);
    heroEl.classList.toggle('dense', tCols > 1 && cardW(tCols) < 250);

    if (state.perRow) {
      const gCols = Math.min(state.perRow, fit);
      gridEl.style.gridTemplateColumns = `repeat(${gCols}, minmax(0, 1fr))`;
      gridEl.classList.toggle('dense', cardW(gCols) < 250);
    } else {
      gridEl.style.gridTemplateColumns = '';
      gridEl.classList.remove('dense');
    }
  }
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(mainEl);
  else window.addEventListener('resize', layout);

  /* ────────────────────────────────────────────────
     Render (keyed, with FLIP movement)
     ──────────────────────────────────────────────── */
  function render(initial = false) {
    const before = new Map();
    if (!initial) {
      clocks.forEach((c, id) => before.set(id, { rect: c.el.getBoundingClientRect(), hero: c.el.classList.contains('is-hero') }));
    }

    const ids = new Set(state.clocks.map(e => e.id));
    clocks.forEach((c, id) => { if (!ids.has(id)) { c.el.remove(); clocks.delete(id); } });

    const fresh = [];
    state.clocks.forEach((e, i) => {
      let c = clocks.get(e.id);
      if (!c) {
        c = createClock(e, initial ? i * 70 : 0, initial);
        clocks.set(e.id, c);
        fresh.push(c);
      }
      const hero = i < topCount();
      c.el.classList.toggle('is-hero', hero);
      c.el.draggable = !(topCount() === 1 && i === 0); // a lone hero stays put
    });

    const top = state.clocks.slice(0, topCount());
    const rest = state.clocks.slice(topCount());
    top.forEach((e, k) => {
      const el = clocks.get(e.id).el, cur = heroEl.children[k];
      if (cur !== el) heroEl.insertBefore(el, cur || null);
    });
    rest.forEach((e, k) => {
      const el = clocks.get(e.id).el, cur = gridEl.children[k];
      if (cur !== el) gridEl.insertBefore(el, cur || null);
    });
    emptyEl.hidden = state.clocks.length > 0;
    layout();

    if (!initial && !reduceMotion) {
      clocks.forEach((c, id) => {
        const b = before.get(id);
        if (!b) return;
        const isHero = c.el.classList.contains('is-hero');
        if (b.hero !== isHero) {
          c.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: EASE });
          return;
        }
        const r = c.el.getBoundingClientRect();
        const dx = b.rect.left - r.left, dy = b.rect.top - r.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          c.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 600, easing: EASE });
        }
      });
      fresh.forEach(c => c.el.animate(
        [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, easing: EASE }
      ));
    }
    requestTick(true);
  }

  /* ────────────────────────────────────────────────
     Ticking: one rAF loop that updates exactly on the second
     ──────────────────────────────────────────────── */
  let lastSecond = -1;
  let forceNext = true;
  let quietUntil = 0;
  let lastTitle = '';
  let lastGlow = '';

  function requestTick(force = false) {
    lastSecond = -1;
    if (force) forceNext = true;
  }

  function tick(now, animate, force) {
    const lp = zoneParts(now, LOCAL_TZ);
    const L = { off: offsetMin(lp, now), day: dayNum(lp) };
    clocks.forEach(c => updateClock(c, now, L, animate, force));

    const primary = state.clocks[0] && clocks.get(state.clocks[0].id);
    if (primary) {
      const title = `${primary.label} in ${primary.name} · Meridian`;
      if (title !== lastTitle) { lastTitle = title; document.title = title; }
      if (primary.skyB !== lastGlow) {
        lastGlow = primary.skyB;
        document.documentElement.style.setProperty('--glow', primary.skyB);
      }
    } else if (lastTitle !== 'Meridian') {
      lastTitle = 'Meridian';
      document.title = 'Meridian — World Clock';
    }
  }

  function frame() {
    const now = Date.now() + state.shift * 60000;
    const sec = Math.floor(now / 1000);
    if (sec !== lastSecond) {
      lastSecond = sec;
      tick(now, performance.now() > quietUntil, forceNext);
      forceNext = false;
    }
    requestAnimationFrame(frame);
  }

  /* ────────────────────────────────────────────────
     Actions
     ──────────────────────────────────────────────── */
  const indexOf = id => state.clocks.findIndex(e => e.id === id);

  function addEntry(it) {
    const entry = { id: uid(), tz: it.tz, name: it.name, sub: it.sub || '' };
    state.clocks.push(entry);
    save();
    render();
    return entry;
  }

  function removeClock(id) {
    const c = clocks.get(id);
    if (!c || c.el.classList.contains('leaving')) return;
    state.clocks = state.clocks.filter(e => e.id !== id);
    save(); // saved before the animation, so closing the tab right now still remembers it
    c.el.classList.add('leaving');
    setTimeout(render, reduceMotion ? 0 : 230);
  }

  function pinClock(id) {
    const i = indexOf(id);
    if (i < 1) return;
    state.clocks.unshift(state.clocks.splice(i, 1)[0]);
    save();
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.clock')?.dataset.id;
    if (!id) return;
    if (btn.dataset.act === 'del') removeClock(id);
    if (btn.dataset.act === 'pin') pinClock(id);
  });

  /* Drag to reorder (desktop). On touch screens use “Make primary”. */
  let dragId = null, lastSwap = 0;
  const dragZones = [heroEl, gridEl];
  const onDragStart = e => {
    const el = e.target.closest && e.target.closest('.clock');
    if (!el) return;
    dragId = el.dataset.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (_) { /* ignore */ }
  };
  const onDragOver = e => {
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest('.clock');
    if (!over || over.dataset.id === dragId) return;
    const t = performance.now();
    if (t - lastSwap < 320) return;
    const from = indexOf(dragId), to = indexOf(over.dataset.id);
    if (from < 0 || to < 0 || from === to) return;
    if (topCount() === 1 && (from < 1 || to < 1)) return; // a lone hero stays put
    state.clocks.splice(to, 0, state.clocks.splice(from, 1)[0]);
    lastSwap = t;
    render();
  };
  const onDragEnd = () => {
    const c = clocks.get(dragId);
    if (c) c.el.classList.remove('dragging');
    dragId = null;
    save();
  };
  dragZones.forEach(z => {
    z.addEventListener('dragstart', onDragStart);
    z.addEventListener('dragover', onDragOver);
    z.addEventListener('drop', e => e.preventDefault());
    z.addEventListener('dragend', onDragEnd);
  });

  /* ────────────────────────────────────────────────
     Settings
     ──────────────────────────────────────────────── */
  const settingsBtn = $('#settingsBtn');
  const settingsEl = $('#settings');
  const sw24 = $('#sw24');
  const swSec = $('#swSec');

  const perRowSeg = $('#perRowSeg');
  const topRowSeg = $('#topRowSeg');

  function syncSeg(seg, value) {
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.v === value)));
  }
  function applySettings() {
    sw24.setAttribute('aria-checked', String(!state.hour12));
    swSec.setAttribute('aria-checked', String(state.seconds));
    syncSeg(perRowSeg, state.perRow);
    syncSeg(topRowSeg, state.topRow);
    document.body.classList.toggle('no-seconds', !state.seconds);
  }
  perRowSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.perRow = +b.dataset.v;
    applySettings(); save(); render();
  });
  topRowSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.topRow = +b.dataset.v;
    applySettings(); save(); render();
  });
  function toggleSettings(open) {
    settingsEl.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
  }
  settingsBtn.addEventListener('click', () => toggleSettings(settingsEl.hidden));
  document.addEventListener('pointerdown', e => {
    if (!settingsEl.hidden && !e.target.closest('.pop-wrap')) toggleSettings(false);
  });
  sw24.addEventListener('click', () => { state.hour12 = !state.hour12; applySettings(); save(); requestTick(true); });
  swSec.addEventListener('click', () => { state.seconds = !state.seconds; applySettings(); save(); requestTick(true); });
  /* Save status, share link and shared-setup banner */
  function showSaveStatus() {
    const saveNote = $('#saveNote'), saveStatus = $('#saveStatus');
    saveNote.textContent = storageOk
      ? 'Your cities and settings are saved on this device.'
      : 'This browser is blocking saving (private mode?). Your cities will reset when you close the tab.';
    saveNote.classList.toggle('warn', !storageOk);
    saveStatus.textContent = storageOk ? 'Your clocks are saved on this device.' : 'Not saved: this browser is blocking storage.';
    saveStatus.classList.toggle('warn', !storageOk);
  }

  const shareBtn = $('#shareBtn');
  const shareLabel = $('#shareLabel');
  let shareTimer = 0;
  shareBtn.addEventListener('click', async () => {
    const url = shareUrl();
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'My Meridian clocks', url });
      } else {
        await navigator.clipboard.writeText(url);
        shareLabel.textContent = 'Link copied';
        clearTimeout(shareTimer);
        shareTimer = setTimeout(() => { shareLabel.textContent = 'Copy link to these clocks'; }, 2000);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      window.prompt('Copy this link', url);
    }
  });

  const sharedBar = $('#shared');
  let pendingShared = null;
  function offerShared(setup) {
    pendingShared = setup;
    const n = setup.clocks.length;
    $('#sharedText').textContent = `This link has a setup with ${n} ${n === 1 ? 'city' : 'cities'}. Replace yours?`;
    sharedBar.hidden = false;
  }
  $('#sharedUse').addEventListener('click', () => {
    if (!pendingShared) return;
    Object.assign(state, pendingShared);
    pendingShared = null;
    sharedBar.hidden = true;
    save();
    applySettings();
    render();
  });
  $('#sharedKeep').addEventListener('click', () => { pendingShared = null; sharedBar.hidden = true; });

  $('#resetBtn').addEventListener('click', () => {
    state.clocks = defaultClocks();
    save();
    render();
    toggleSettings(false);
  });

  /* ────────────────────────────────────────────────
     Time travel dock
     ──────────────────────────────────────────────── */
  const scrub = $('#scrub');
  const scrubOut = $('#scrubOut');
  const scrubMain = $('#scrubReset');
  const dock = $('#dock');

  function updateDock() {
    const min = +scrub.min, max = +scrub.max;
    const pct = ((state.shift - min) / (max - min)) * 100;
    scrub.style.setProperty('--l', Math.min(50, pct) + '%');
    scrub.style.setProperty('--r', Math.max(50, pct) + '%');
    scrubOut.textContent = fmtShift(state.shift);
    const shifted = state.shift !== 0;
    dock.classList.toggle('is-shifted', shifted);
    scrubMain.textContent = shifted ? 'Back to now' : 'Time travel';
    scrubMain.setAttribute('aria-disabled', String(!shifted));
  }
  scrub.addEventListener('input', () => {
    state.shift = +scrub.value;
    quietUntil = performance.now() + 250; // no rolling while dragging
    requestTick(true);
    updateDock();
  });
  scrubMain.addEventListener('click', () => {
    if (!state.shift) return;
    state.shift = 0;
    scrub.value = 0;
    requestTick(true);
    updateDock();
  });

  /* ────────────────────────────────────────────────
     Add-city palette
     ──────────────────────────────────────────────── */
  const palette = $('#palette');
  const input = $('#q');
  const resultsEl = $('#results');
  let results = [];
  let active = 0;
  let lastFocus = null;
  let lastAdded = null;

  const isAdded = it => state.clocks.some(e => e.tz === it.tz && e.name === it.name);

  function renderResults() {
    const q = input.value.trim();
    results = q ? search(q) : popularItems();
    active = Math.max(0, results.findIndex(it => !isAdded(it)));
    const now = Date.now() + state.shift * 60000;

    if (!results.length) {
      resultsEl.innerHTML = `<li class="res-empty" role="presentation"><b>No match for “${esc(q)}”</b>Try a nearby city, a country, or an offset like UTC+5.</li>`;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    const rows = results.map((it, i) => {
      const p = zoneParts(now, it.tz);
      const added = isAdded(it);
      return `<li class="res${added ? ' is-added' : ''}${i === active ? ' is-active' : ''}" role="option" id="res-${i}" data-i="${i}" aria-selected="${i === active}" ${added ? 'aria-disabled="true"' : ''}>
        <span class="res-main"><span class="res-name">${esc(it.name)}</span><span class="res-sub">${esc(it.sub || it.tz)}</span></span>
        <span class="res-time"><b>${fmtTime(p, state.hour12)}</b><small>${fmtOffset(offsetMin(p, now))}</small></span>
        <span class="res-mark" aria-hidden="true">${added ? ICON.check : ICON.plus}</span>
      </li>`;
    });
    resultsEl.innerHTML = (q ? '' : '<li class="res-head" role="presentation">Popular cities</li>') + rows.join('');
    input.setAttribute('aria-activedescendant', 'res-' + active);
  }

  function setActive(i, scroll = true) {
    if (!results.length) return;
    active = Math.max(0, Math.min(results.length - 1, i));
    resultsEl.querySelectorAll('.res').forEach(li => {
      const on = +li.dataset.i === active;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', String(on));
      if (on && scroll) li.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', 'res-' + active);
  }

  function pick(i) {
    const it = results[i];
    if (!it || isAdded(it)) return;
    lastAdded = addEntry(it);
    const li = resultsEl.querySelector(`.res[data-i="${i}"]`);
    if (li) {
      li.classList.add('is-added');
      li.setAttribute('aria-disabled', 'true');
      $('.res-mark', li).innerHTML = ICON.check;
    }
    input.select();
  }

  function openPalette() {
    if (!palette.hidden) return;
    toggleSettings(false);
    lastFocus = document.activeElement;
    lastAdded = null;
    input.value = '';
    palette.hidden = false;
    document.body.classList.add('lock');
    renderResults();
    requestAnimationFrame(() => input.focus());
  }

  function closePalette() {
    if (palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (lastAdded) {
      const c = clocks.get(lastAdded.id);
      if (c) c.el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
  });
  resultsEl.addEventListener('click', e => {
    const li = e.target.closest('.res');
    if (li) pick(+li.dataset.i);
  });
  resultsEl.addEventListener('mousemove', e => {
    const li = e.target.closest('.res');
    if (li && +li.dataset.i !== active) setActive(+li.dataset.i, false);
  });
  palette.addEventListener('click', e => { if (e.target.closest('[data-close]')) closePalette(); });

  $('#addBtn').addEventListener('click', openPalette);
  $('#emptyAdd').addEventListener('click', openPalette);

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if (!palette.hidden) closePalette();
      else if (!settingsEl.hidden) { toggleSettings(false); settingsBtn.focus(); }
    } else if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openPalette();
    }
  });

  /* ────────────────────────────────────────────────
     Go
     ──────────────────────────────────────────────── */
  const hadSaved = load();
  const shared = readSharedHash();
  if (location.hash.startsWith('#setup=')) {
    try { history.replaceState(null, '', location.href.split('#')[0]); } catch (_) { /* ignore */ }
  }
  if (shared && shared.clocks.length) {
    if (hadSaved) {
      offerShared(shared);
    } else {
      Object.assign(state, shared); // first visit through a shared link: just use it
      save();
    }
  }
  showSaveStatus();
  applySettings();
  updateDock();
  render(true);
  requestAnimationFrame(frame);
  (window.requestIdleCallback || (fn => setTimeout(fn, 400)))(() => getCatalog());
})();
