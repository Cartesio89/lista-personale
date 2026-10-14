/* Lista personale — app a file singolo, nessuna build.
   Dati: localStorage (cache) + file JSON in un repo GitHub privato (sync). */
'use strict';

/* ================================================================ utilità */
const $ = (s, r = document) => r.querySelector(s);
const now = () => Date.now();
const uid = (p) => p + now().toString(36) + Math.random().toString(36).slice(2, 7);
const LS = { data: 'lp.data', sha: 'lp.sha', dirty: 'lp.dirty', cfg: 'lp.cfg', ui: 'lp.ui' };
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota o privato */ } }

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // solo stringhe statiche (icone)
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  drag: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-2 7 1 4-4.5c.8-.8 2.2-.8 3 0s.8 2.2 0 3L14 13l1 7-2 1.5-2.5-7.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6l1 1 1.5-2M4.5 12l1 1 1.5-2M4.5 18l1 1 1.5-2"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
};
function icon(name, strokeWidth) {
  const paint = name === 'drag' ? 'fill="currentColor" stroke="none"'
    : `fill="none" stroke="currentColor" stroke-width="${strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round"`;
  return h('span', { class: 'ic-wrap', 'aria-hidden': 'true', style: 'display:inline-flex', html:
    `<svg viewBox="0 0 24 24" ${paint}>${ICONS[name]}</svg>` });
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
function safeUrl(u) {
  if (!u) return '';
  u = String(u).trim();
  if (/^www\./i.test(u)) u = 'https://' + u;
  return /^(https?:|mailto:)/i.test(u) ? u : '';
}
function domainOf(u) {
  try {
    if (u.startsWith('mailto:')) return u.slice(7);
    let d = new URL(u).hostname.replace(/^(www\.|m\.)/, '');
    return d;
  } catch (e) { return u; }
}
function linkify(text) {
  const frag = document.createDocumentFragment();
  let last = 0; text = text || '';
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0].replace(/[),.;]+$/, '');
    frag.append(text.slice(last, m.index));
    frag.append(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url));
    last = m.index + url.length;
  }
  frag.append(text.slice(last));
  return frag;
}
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: y !== new Date().getFullYear() ? 'numeric' : undefined });
};
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function addDaysISO(iso, n) { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return dt.toISOString().slice(0, 10); }

let toastTimer;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.replaceChildren(msg, actionLabel ? h('button', { onclick: () => { action(); t.classList.remove('show'); } }, actionLabel) : null);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), actionLabel ? 5000 : 2200);
}

/* ================================================================ dati */
function emptyDB() { return { version: 1, meta: { linkCategories: [], calendarEmail: 'martino.cicerani@gmail.com', updatedAt: 0 }, projects: {}, items: {} }; }
let DB = lsGet(LS.data, null) || emptyDB();
const items = () => Object.values(DB.items).filter((i) => !i.deleted);
const projects = () => Object.values(DB.projects).filter((p) => !p.deleted).sort((a, b) => a.order - b.order);
const proj = (id) => (id && DB.projects[id] && !DB.projects[id].deleted ? DB.projects[id] : null);

function persist(opts = {}) {
  lsSet(LS.data, DB);
  lsSet(LS.dirty, true);
  Sync.schedule();
  if (opts.render !== false) render();
}
function updateItem(id, patch, opts) {
  const it = DB.items[id]; if (!it) return;
  Object.assign(it, patch, { updatedAt: now() });
  persist(opts);
}
function updateMeta(patch) { Object.assign(DB.meta, patch, { updatedAt: now() }); persist(); }
function topOrder(filterFn) {
  const os = items().filter(filterFn).map((i) => i.order || 0);
  return (os.length ? Math.min(...os) : 0) - 1000;
}
function createItem(kind, fields) {
  const id = uid('i');
  const it = Object.assign({
    id, kind, title: '', notes: '', projectId: null, urgent: false, dream: false, done: false, doneAt: null,
    deadline: null, lists: [], createdAt: now(), updatedAt: now(),
  }, fields);
  it.order = topOrder((x) => x.kind === kind);
  DB.items[id] = it;
  persist({ render: false });
  return it;
}
function deleteItem(id) {
  const prev = JSON.parse(JSON.stringify(DB.items[id]));
  updateItem(id, { deleted: true }, { render: false });
  toast('Eliminato', 'Annulla', () => { DB.items[id] = Object.assign(prev, { updatedAt: now() }); persist(); });
}
function toggleDone(id) {
  const it = DB.items[id];
  const done = !it.done;
  updateItem(id, { done, doneAt: done ? now() : null });
  if (it.kind === 'task' || it.kind === 'place') {
    toast(done ? (it.kind === 'place' ? 'Segnato come visitato' : 'Spostata in Fatte') : 'Rimessa da fare', 'Annulla', () => updateItem(id, { done: !done, doneAt: !done ? now() : null }));
  }
}
function createProject(name) {
  const palette = ['#2F4BD8', '#0F7B6C', '#9A3A06', '#7A3FD1', '#B0306A', '#1F6F9E', '#3D7A1F', '#8A6D00', '#A1491F', '#5B3FA0'];
  const ps = projects();
  const p = { id: uid('p'), name, color: palette[ps.length % palette.length], order: (ps.length ? ps[ps.length - 1].order : 0) + 1000, createdAt: now(), updatedAt: now() };
  DB.projects[p.id] = p;
  persist({ render: false });
  return p;
}
function linkCategories() {
  const cats = [...(DB.meta.linkCategories || [])];
  for (const i of items()) if (i.kind === 'link' && i.category && !cats.includes(i.category)) cats.push(i.category);
  return cats;
}
function reorder(idsInNewOrder) {
  const its = idsInNewOrder.map((id) => DB.items[id]);
  const orders = its.map((i) => i.order || 0).sort((a, b) => a - b);
  for (let k = 1; k < orders.length; k++) if (orders[k] <= orders[k - 1]) orders[k] = orders[k - 1] + 1;
  its.forEach((it, k) => { if (it.order !== orders[k]) { it.order = orders[k]; it.updatedAt = now(); } });
  persist();
}

/* ---------------- merge: per elemento vince l'ultima modifica */
function mergeMaps(a, b) {
  const out = Object.assign({}, a);
  for (const [k, v] of Object.entries(b || {})) {
    const cur = out[k];
    if (!cur || (v.updatedAt || 0) > (cur.updatedAt || 0)) out[k] = v;
  }
  return out;
}
function mergeDB(local, remote) {
  return {
    version: 1,
    meta: (remote.meta && (remote.meta.updatedAt || 0) > ((local.meta && local.meta.updatedAt) || 0)) ? remote.meta : (local.meta || remote.meta),
    projects: mergeMaps(local.projects, remote.projects),
    items: mergeMaps(local.items, remote.items),
  };
}
function differs(merged, remote) {
  if ((merged.meta.updatedAt || 0) !== ((remote.meta && remote.meta.updatedAt) || 0)) return true;
  for (const key of ['projects', 'items']) {
    const r = remote[key] || {};
    for (const [id, v] of Object.entries(merged[key])) if (!r[id] || (r[id].updatedAt || 0) !== (v.updatedAt || 0)) return true;
  }
  return false;
}

/* ================================================================ sync GitHub */
function b64encode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const Sync = {
  state: 'local', error: '', last: 0, timer: null, busy: false, again: false,
  cfg() { return lsGet(LS.cfg, null); },
  enabled() { const c = this.cfg(); return !!(c && c.token && c.owner && c.repo); },
  async api(path, opts = {}) {
    const c = this.cfg();
    return fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${path}`, Object.assign({}, opts, {
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opts.headers || {}),
    }));
  },
  filePath() { const c = this.cfg(); return (c.path || 'data.json').split('/').map(encodeURIComponent).join('/'); },
  async fetchRemote() {
    const c = this.cfg();
    const r = await this.api(`contents/${this.filePath()}?ref=${encodeURIComponent(c.branch || 'main')}`);
    if (r.status === 404) return { data: null, sha: null };
    if (r.status === 401 || r.status === 403) throw new Error('Token non valido o senza permessi (' + r.status + ')');
    if (!r.ok) throw new Error('Lettura fallita (' + r.status + ')');
    const j = await r.json();
    let b64 = j.content;
    if (!b64 && j.sha) { const rb = await this.api(`git/blobs/${j.sha}`); if (!rb.ok) throw new Error('Lettura blob fallita'); b64 = (await rb.json()).content; }
    return { data: JSON.parse(b64decode(b64)), sha: j.sha };
  },
  async push(data, sha) {
    const c = this.cfg();
    const body = { message: 'Aggiornamento ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: b64encode(JSON.stringify(data)), branch: c.branch || 'main' };
    if (sha) body.sha = sha;
    const r = await this.api(`contents/${this.filePath()}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (r.status === 401 || r.status === 403) throw new Error('Token senza permesso di scrittura (' + r.status + ')');
    if (!r.ok) throw new Error('Salvataggio fallito (' + r.status + ')');
    return { sha: (await r.json()).content.sha };
  },
  async run() {
    if (!this.enabled()) { this.setState('local'); return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.setState('saving');
    try {
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        const remote = await this.fetchRemote();
        const merged = remote.data ? mergeDB(DB, remote.data) : DB;
        DB = merged; lsSet(LS.data, DB);
        if (remote.data && !differs(merged, remote.data)) { lsSet(LS.sha, remote.sha); ok = true; break; }
        const res = await this.push(merged, remote.sha);
        if (res.conflict) continue;
        lsSet(LS.sha, res.sha); ok = true;
      }
      if (!ok) throw new Error('Conflitto non risolto, riprovo più tardi');
      lsSet(LS.dirty, false);
      this.last = now(); this.error = '';
      this.setState('idle');
    } catch (e) {
      this.error = e.message || String(e);
      this.setState(navigator.onLine ? 'error' : 'offline');
    } finally {
      this.busy = false;
      render();
      if (this.again) { this.again = false; this.schedule(300); }
    }
  },
  schedule(ms = 1200) { clearTimeout(this.timer); if (this.enabled()) this.timer = setTimeout(() => this.run(), ms); },
  setState(s) { this.state = s; const pill = $('.sync-pill'); if (pill) pill.replaceWith(syncPill()); },
};

/* ================================================================ routing (tasto indietro = schermata precedente) */
const ROOTS = ['attivita', 'scadenze', 'viaggi', 'altro'];
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').map(decodeURIComponent).filter(Boolean);
  return { name: parts[0] || 'attivita', arg: parts[1] || '', q: new URLSearchParams(qs || ''), raw };
}
const navStack = [];
function go(path) { location.hash = '#/' + path; }
function goBack(fallback) {
  if (navStack.length > 1) history.back();
  else location.replace('#/' + (fallback || 'attivita'));
}
const scrollMem = {};
let currentRaw = null;
window.addEventListener('hashchange', () => {
  const r = parseRoute().raw;
  if (navStack.length > 1 && navStack[navStack.length - 2] === r) navStack.pop();
  else navStack.push(r);
  render(true);
});

/* ================================================================ UI state */
const UI = Object.assign({ taskSeg: 'todo', filters: [], tripSeg: 'fattibile', search: '', linkSearch: '' }, lsGet(LS.ui, {}));
function setUI(patch) { Object.assign(UI, patch); lsSet(LS.ui, UI); render(); }

/* ================================================================ render */
let pendingRender = false, dragging = false;
function isEditing() {
  const a = document.activeElement;
  return a && $('#view').contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && ['text', 'search', 'url', 'email', 'password'].includes(a.type)));
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !isEditing()) render(); }, 50));

function render(routeChanged) {
  const route = parseRoute();
  if (!routeChanged && (isEditing() || dragging)) { pendingRender = true; return; }
  pendingRender = false;
  if (currentRaw !== null && routeChanged) scrollMem[currentRaw] = window.scrollY;
  const sameRoute = currentRaw === route.raw;
  const keepY = window.scrollY;
  currentRaw = route.raw;

  const views = {
    attivita: viewTasks, scadenze: viewDeadlines, viaggi: viewTrips, altro: viewMore,
    link: viewLinks, appunti: viewNotes, progetti: viewProjects, impostazioni: viewSettings,
    item: viewItem, nuovo: viewNew,
  };
  const fn = views[route.name] || viewTasks;
  const out = fn(route);
  const clean = (arr) => arr.flat(Infinity).filter((x) => x != null && x !== false);
  $('#topbar').replaceChildren(...clean(out.top));
  $('#view').replaceChildren(...clean(out.body));
  const fab = document.querySelector('.fab'); if (fab) fab.remove();
  if (out.fab) document.body.append(out.fab);
  renderTabs(route);
  if (out.after) out.after();
  window.scrollTo(0, sameRoute ? keepY : (scrollMem[route.raw] || 0));
}

function renderTabs(route) {
  const tab = ROOTS.includes(route.name) ? route.name
    : (['link', 'appunti', 'progetti', 'impostazioni'].includes(route.name) ? 'altro' : null);
  const defs = [['attivita', 'Attività', 'tasks'], ['scadenze', 'Scadenze', 'cal'], ['viaggi', 'Viaggi', 'plane'], ['altro', 'Altro', 'grid']];
  $('#tabbar').replaceChildren(h('div', { class: 'inner' }, defs.map(([k, label, ic]) =>
    h('button', { 'aria-current': tab === k ? 'page' : null, onclick: () => { if (tab !== k || route.name !== k) go(k); else window.scrollTo({ top: 0, behavior: 'smooth' }); } }, icon(ic), label))));
}

function syncPill() {
  const labels = { local: 'Solo locale', idle: 'Salvato', saving: 'Salvo…', error: 'Errore sync', offline: 'Offline' };
  return h('button', { class: 'sync-pill ' + Sync.state, onclick: () => go('impostazioni'), title: Sync.error || '' },
    h('span', { class: 'dot' }), labels[Sync.state]);
}
function topBar(title, opts = {}) {
  return [
    opts.back ? h('button', { class: 'icon-btn plain', 'aria-label': 'Indietro', onclick: () => goBack(opts.back) }, icon('back')) : null,
    h('h1', { class: opts.small ? 'small' : null }, title),
    opts.right || null,
    opts.noSync ? null : syncPill(),
  ];
}
const fab = (label, onclick) => h('button', { class: 'fab', 'aria-label': label, onclick }, icon('plus'));
function segmented(options, value, onPick) {
  return h('div', { class: 'segmented', role: 'group' }, options.map(([k, label, count]) =>
    h('button', { 'aria-pressed': String(k === value), onclick: () => onPick(k) }, label, count != null ? h('span', { class: 'count' }, count) : null)));
}
function checkBtn(done, label, onclick) {
  return h('button', { class: 'check', 'aria-pressed': String(!!done), 'aria-label': label, onclick },
    h('span', { class: 'box' }, done ? icon('check', 3) : null));
}

function listProgress(it) {
  let tot = 0, done = 0;
  for (const l of it.lists || []) for (const e of l.entries) { tot++; if (e.done) done++; }
  return { tot, done };
}
function itemRow(it, opts = {}) {
  const p = proj(it.projectId);
  const late = it.deadline && !it.done && it.deadline < todayISO();
  const prog = listProgress(it);
  const meta = h('div', { class: 'meta' },
    it.urgent ? h('span', { class: 'badge urgent' }, 'Urgente') : null,
    it.dream ? h('span', { class: 'badge dream' }, 'Sogno') : null,
    p ? h('span', { class: 'proj' }, h('span', { class: 'sw', style: `background:${p.color}` }), p.name) : null,
    it.deadline ? h('span', { class: late ? 'badge late' : 'm' }, late ? null : icon('clock'), (late ? 'Scaduta ' : '') + fmtDate(it.deadline)) : null,
    prog.tot && (it.kind === 'task' || it.kind === 'place') ? h('span', { class: 'm' }, icon('list'), `${prog.done}/${prog.tot}`) : null,
    prog.tot && (it.kind === 'trip' || it.kind === 'note') ? h('span', { class: 'm' }, icon('list'), `${(it.lists || []).length} ${(it.lists || []).length === 1 ? 'lista' : 'liste'}`) : null,
    it.notes ? h('span', { class: 'm', title: 'Ha note' }, icon('note')) : null,
    opts.extraMeta || null,
  );
  return h('div', { class: 'row' + (it.done && opts.strike !== false ? ' is-done' : ''), 'data-id': it.id },
    opts.draggable ? h('button', { class: 'drag', 'aria-label': 'Trascina per riordinare: ' + it.title }, icon('drag')) : h('span', { style: 'width:8px;flex:none' }),
    opts.noCheck ? null : checkBtn(it.done, (it.done ? 'Segna da fare: ' : 'Segna fatta: ') + it.title, (e) => { e.stopPropagation(); toggleDone(it.id); }),
    h('button', { class: 'row-main', onclick: () => go('item/' + it.id) },
      h('span', { class: 'row-title' }, it.title || '(senza titolo)'),
      meta.childNodes.length ? meta : null),
  );
}
function makeSortable(listEl, getIds) {
  if (!window.Sortable) return;
  window.Sortable.create(listEl, {
    handle: '.drag', animation: 150, delay: 0, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
    onStart: () => { dragging = true; },
    onEnd: () => {
      dragging = false;
      const ids = [...listEl.querySelectorAll('.row')].map((r) => r.dataset.id);
      if (ids.join() !== getIds().join()) reorder(ids); else if (pendingRender) render();
    },
  });
}

/* ---------------- Attività */
function taskMatchesFilters(it) {
  if (!UI.filters.length) return true;
  return UI.filters.some((f) => (f === 'urgent' && it.urgent) || (f === 'dream' && it.dream) || (f === 'none' && !proj(it.projectId)) || f === 'p:' + it.projectId);
}
function viewTasks() {
  const all = items().filter((i) => i.kind === 'task');
  const q = UI.search.trim().toLowerCase();
  const matchQ = (i) => !q || (i.title + ' ' + i.notes).toLowerCase().includes(q);
  const base = all.filter(taskMatchesFilters).filter(matchQ);
  const todo = base.filter((i) => !i.done).sort((a, b) => a.order - b.order);
  const done = base.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const shown = UI.taskSeg === 'done' ? done : todo;
  const canDrag = UI.taskSeg === 'todo' && !q;

  const chipDefs = [['urgent', 'Urgenti', 'var(--urgent)'], ['dream', 'Sogni', 'var(--dream)'],
    ...projects().map((p) => ['p:' + p.id, p.name, p.color]), ['none', 'Senza progetto', 'var(--faint)']];
  const toggleFilter = (k) => setUI({ filters: UI.filters.includes(k) ? UI.filters.filter((x) => x !== k) : [...UI.filters, k] });
  const listEl = h('div', { class: 'list' }, shown.map((it) => itemRow(it, { draggable: canDrag })));

  const body = [
    !Sync.enabled() ? h('div', { class: 'banner' }, h('span', null, 'I dati sono salvati solo su questo dispositivo. ', h('a', { href: '#/impostazioni' }, 'Attiva la sincronizzazione'))) : null,
    h('input', { class: 'search', type: 'search', placeholder: 'Cerca attività…', value: UI.search, 'aria-label': 'Cerca attività',
      oninput: (e) => { UI.search = e.target.value; lsSet(LS.ui, UI); clearTimeout(viewTasks.t); viewTasks.t = setTimeout(() => { const el = document.activeElement; render(true); const s = $('.search'); if (s && el && el.classList.contains('search')) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); } }),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra per etichetta' },
      h('button', { class: 'chip', 'aria-pressed': String(!UI.filters.length), onclick: () => setUI({ filters: [] }) }, 'Tutto'),
      chipDefs.map(([k, label, color]) => h('button', { class: 'chip', 'aria-pressed': String(UI.filters.includes(k)), onclick: () => toggleFilter(k) },
        h('span', { class: 'sw', style: `background:${color}` }), label))),
    segmented([['todo', 'Da fare', todo.length], ['done', 'Fatte', done.length]], UI.taskSeg, (k) => setUI({ taskSeg: k })),
    shown.length ? listEl : h('div', { class: 'empty' }, UI.taskSeg === 'done' ? 'Nessuna attività completata con questi filtri.' : 'Niente da fare con questi filtri.'),
  ];
  const qs = new URLSearchParams();
  const pf = UI.filters.find((f) => f.startsWith('p:')); if (pf) qs.set('p', pf.slice(2));
  if (UI.filters.includes('urgent')) qs.set('urgent', '1');
  if (UI.filters.includes('dream')) qs.set('dream', '1');
  return {
    top: topBar('Attività'), body,
    fab: fab('Nuova attività', () => go('nuovo/task?' + qs.toString())),
    after: () => { if (canDrag && shown.length > 1) makeSortable(listEl, () => shown.map((i) => i.id)); },
  };
}

/* ---------------- Scadenze (calendario interno) */
function viewDeadlines() {
  const t = todayISO(), week = addDaysISO(t, 7);
  const its = items().filter((i) => i.kind === 'task' && i.deadline && !i.done).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.order - b.order);
  const groups = [
    ['Scadute', its.filter((i) => i.deadline < t)],
    ['Oggi', its.filter((i) => i.deadline === t)],
    ['Prossimi 7 giorni', its.filter((i) => i.deadline > t && i.deadline <= week)],
    ['Più avanti', its.filter((i) => i.deadline > week)],
  ];
  const body = its.length ? groups.filter((g) => g[1].length).map(([title, list]) => [
    h('div', { class: 'group-title' }, title),
    h('div', { class: 'list' }, list.map((i) => itemRow(i))),
  ]) : [h('div', { class: 'empty' }, 'Nessuna scadenza. Aprendo un\'attività puoi impostare una data entro cui farla e aggiungerla a Google Calendar.')];
  return { top: topBar('Scadenze'), body };
}

/* ---------------- Viaggi */
function viewTrips() {
  const all = items();
  const places = all.filter((i) => i.kind === 'place');
  const fatt = places.filter((p) => p.scope !== 'vita' && !p.done).sort((a, b) => a.order - b.order);
  const vita = places.filter((p) => p.scope === 'vita' && !p.done).sort((a, b) => a.order - b.order);
  const trips = all.filter((i) => i.kind === 'trip' && !i.template).sort((a, b) => a.order - b.order);
  const visited = places.filter((p) => p.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const utili = all.filter((i) => i.kind === 'trip' && i.template);
  const tlinks = all.filter((i) => i.kind === 'link' && i.category === 'Viaggi');
  const seg = UI.tripSeg;
  let body = [], after = null, fabEl;
  if (seg === 'fattibile' || seg === 'vita') {
    const shown = seg === 'vita' ? vita : fatt;
    const listEl = h('div', { class: 'list' }, shown.map((p) => itemRow(p, { draggable: true })));
    body = [shown.length ? listEl : h('div', { class: 'empty' }, 'Nessun posto in elenco.')];
    after = () => { if (shown.length > 1) makeSortable(listEl, () => shown.map((i) => i.id)); };
    fabEl = fab('Nuovo posto', () => go('nuovo/place?scope=' + seg));
  } else if (seg === 'fatti') {
    body = [
      h('div', { class: 'group-title' }, 'Viaggi fatti'),
      trips.length ? h('div', { class: 'list' }, trips.map((t) => itemRow(t, { noCheck: true, strike: false }))) : h('div', { class: 'empty' }, 'Nessun viaggio.'),
      h('div', { class: 'group-title' }, 'Posti visitati'),
      visited.length ? h('div', { class: 'list' }, visited.map((p) => itemRow(p, { extraMeta: h('span', { class: 'm' }, p.scope === 'vita' ? 'Nella vita' : 'Da vedere') }))) : h('div', { class: 'empty small' }, 'Spunta un posto in "Da vedere" o "Nella vita" e finirà qui.'),
    ];
    fabEl = fab('Nuovo viaggio', () => go('nuovo/trip'));
  } else {
    body = [
      h('div', { class: 'group-title' }, 'Checklist'),
      h('div', { class: 'list' }, utili.map((t) => itemRow(t, { noCheck: true, strike: false }))),
      h('div', { class: 'group-title' }, 'Link utili per viaggiare'),
      h('div', { class: 'list' }, tlinks.map(linkRow)),
    ];
    fabEl = fab('Nuovo link viaggi', () => go('nuovo/link?cat=Viaggi'));
  }
  return {
    top: topBar('Viaggi'),
    body: [segmented([['fattibile', 'Da vedere'], ['vita', 'Nella vita'], ['fatti', 'Fatti'], ['utili', 'Utili']], seg, (k) => setUI({ tripSeg: k })), ...body],
    fab: fabEl, after,
  };
}

/* ---------------- Altro */
function viewMore() {
  const all = items();
  const card = (href, ic, title, sub) => h('a', { class: 'card-link', href }, h('span', { class: 'ic' }, icon(ic)), h('span', { class: 't' }, h('b', null, title), h('span', null, sub)), h('span', { class: 'chev' }, icon('chev')));
  const nLinks = all.filter((i) => i.kind === 'link').length;
  return {
    top: topBar('Altro'),
    body: [h('div', { class: 'list' },
      card('#/link', 'link', 'Link utili', `${nLinks} link in ${linkCategories().length} categorie`),
      card('#/appunti', 'note', 'Appunti', `${all.filter((i) => i.kind === 'note').length} note (teatro, drone, Sorare…)`),
      card('#/progetti', 'folder', 'Progetti', `${projects().length} progetti per raggruppare le attività`),
      card('#/impostazioni', 'gear', 'Sincronizzazione e backup', Sync.enabled() ? 'Collegato a GitHub' : 'Non configurata: dati solo su questo dispositivo'),
    )],
  };
}

function linkRow(it) {
  const url = safeUrl(it.url);
  return h('div', { class: 'linkrow', 'data-id': it.id },
    url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, it.title), h('span', null, it.notes ? it.notes : domainOf(url)))
      : h('a', { href: '#/item/' + it.id }, h('b', null, it.title), h('span', null, 'senza URL')),
    h('button', { class: 'icon-btn plain', 'aria-label': 'Modifica ' + it.title, onclick: () => go('item/' + it.id) }, icon('edit')));
}
function viewLinks(route) {
  const all = items().filter((i) => i.kind === 'link');
  const cat = route.arg;
  if (cat) {
    const list = all.filter((i) => i.category === cat).sort((a, b) => a.order - b.order);
    const listEl = h('div', { class: 'list' }, list.map(linkRow));
    return {
      top: topBar(cat, { back: 'link', small: true }),
      body: [list.length ? listEl : h('div', { class: 'empty' }, 'Categoria vuota.')],
      fab: fab('Nuovo link', () => go('nuovo/link?cat=' + encodeURIComponent(cat))),
    };
  }
  const q = UI.linkSearch.trim().toLowerCase();
  const results = q ? all.filter((i) => (i.title + ' ' + i.url + ' ' + i.category + ' ' + (i.notes || '')).toLowerCase().includes(q)) : [];
  return {
    top: topBar('Link utili', { back: 'altro', small: true }),
    body: [
      h('input', { class: 'search', type: 'search', placeholder: 'Cerca tra tutti i link…', value: UI.linkSearch, 'aria-label': 'Cerca link',
        oninput: (e) => { UI.linkSearch = e.target.value; lsSet(LS.ui, UI); clearTimeout(viewLinks.t); viewLinks.t = setTimeout(() => { render(true); const s = $('.search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); } }),
      q ? h('div', { class: 'list' }, results.length ? results.map(linkRow) : h('div', { class: 'empty' }, 'Nessun link trovato.'))
        : h('div', { class: 'list' }, linkCategories().map((c) => {
          const n = all.filter((i) => i.category === c).length;
          return h('a', { class: 'card-link', href: '#/link/' + encodeURIComponent(c) }, h('span', { class: 't' }, h('b', null, c), h('span', null, n + ' link')), h('span', { class: 'chev' }, icon('chev')));
        })),
    ],
    fab: fab('Nuovo link', () => go('nuovo/link')),
  };
}

function viewNotes() {
  const list = items().filter((i) => i.kind === 'note').sort((a, b) => a.order - b.order);
  const listEl = h('div', { class: 'list' }, list.map((n) => itemRow(n, { noCheck: true, strike: false, draggable: true })));
  return {
    top: topBar('Appunti', { back: 'altro', small: true }),
    body: [list.length ? listEl : h('div', { class: 'empty' }, 'Nessun appunto.')],
    fab: fab('Nuovo appunto', () => go('nuovo/note')),
    after: () => { if (list.length > 1) makeSortable(listEl, () => list.map((i) => i.id)); },
  };
}

function viewProjects() {
  const ps = projects();
  const palette = ['#2F4BD8', '#0F7B6C', '#9A3A06', '#7A3FD1', '#B0306A', '#1F6F9E', '#3D7A1F', '#8A6D00', '#A1491F', '#5B3FA0'];
  const count = (id) => items().filter((i) => i.kind === 'task' && i.projectId === id && !i.done).length;
  const setP = (id, patch) => { Object.assign(DB.projects[id], patch, { updatedAt: now() }); persist(); };
  return {
    top: topBar('Progetti', { back: 'altro', small: true }),
    body: [
      h('p', { class: 'help' }, 'Tocca il pallino per cambiare colore. Un\'attività si assegna a un progetto quando la crei o in qualsiasi momento aprendola.'),
      h('div', { class: 'list' }, ps.map((p) => h('div', { class: 'proj-row' },
        h('button', { class: 'swatch-btn', style: `background:${p.color}`, 'aria-label': 'Cambia colore di ' + p.name,
          onclick: () => setP(p.id, { color: palette[(palette.indexOf(p.color) + 1) % palette.length] }) }),
        h('input', { class: 'input', value: p.name, 'aria-label': 'Nome progetto', onchange: (e) => { if (e.target.value.trim()) setP(p.id, { name: e.target.value.trim() }); } }),
        h('button', { class: 'btn ghost', onclick: () => { setUI({ filters: ['p:' + p.id], taskSeg: 'todo' }); go('attivita'); } }, count(p.id) + ' da fare'),
        h('button', { class: 'icon-btn plain', 'aria-label': 'Elimina progetto ' + p.name, onclick: () => {
          if (!confirm(`Eliminare il progetto "${p.name}"? Le attività restano, senza progetto.`)) return;
          for (const it of items()) if (it.projectId === p.id) { it.projectId = null; it.updatedAt = now(); }
          setP(p.id, { deleted: true });
        } }, icon('trash'))))),
      h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn block', onclick: () => { const n = prompt('Nome del nuovo progetto'); if (n && n.trim()) { createProject(n.trim()); render(); } } }, icon('plus'), 'Nuovo progetto')),
    ],
  };
}

/* ---------------- Impostazioni */
function viewSettings() {
  const c = Object.assign({ owner: '', repo: '', branch: 'main', path: 'data.json', token: '' }, Sync.cfg() || {});
  const f = {};
  const fld = (key, label, attrs = {}) => h('div', { class: 'field' }, h('label', { for: 'f-' + key }, label),
    f[key] = h('input', Object.assign({ class: 'input', id: 'f-' + key, value: c[key], autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }, attrs)));
  const statusTxt = Sync.enabled()
    ? (Sync.state === 'idle' ? `Sincronizzato${Sync.last ? ' alle ' + new Date(Sync.last).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}.` : Sync.state === 'saving' ? 'Sincronizzazione in corso…' : `Problema: ${Sync.error || Sync.state}`)
    : 'Non configurata. I dati restano solo in questo browser e si perdono se cancelli i dati del sito.';
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'imp', onchange: async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.items || !data.projects) throw new Error('Formato non riconosciuto');
      DB = mergeDB(DB, data); persist(); toast('Importato e unito ai dati esistenti');
    } catch (err) { alert('Importazione fallita: ' + err.message); }
  } });
  return {
    top: topBar('Sincronizzazione', { back: 'altro', small: true }),
    body: [h('div', { class: 'detail' },
      h('div', { class: 'panel' },
        h('h2', null, 'Stato'),
        h('p', { class: 'small', style: 'margin:0' }, statusTxt)),
      h('div', { class: 'panel' },
        h('h2', null, 'GitHub'),
        fld('owner', 'Utente GitHub (proprietario del repo dati)'),
        fld('repo', 'Repo dati (privato)'),
        fld('branch', 'Branch'),
        fld('path', 'File'),
        fld('token', 'Token di accesso (fine-grained)', { type: 'password', placeholder: 'github_pat_…' }),
        h('div', { class: 'inline', style: 'margin-top:14px' },
          h('button', { class: 'btn primary', onclick: async () => {
            const cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || 'main', path: f.path.value.trim() || 'data.json', token: f.token.value.trim() };
            if (!cfg.owner || !cfg.repo || !cfg.token) { alert('Compila utente, repo e token.'); return; }
            lsSet(LS.cfg, cfg); await Sync.run();
            toast(Sync.state === 'idle' ? 'Collegato: dati sincronizzati' : 'Errore: ' + Sync.error);
          } }, 'Salva e sincronizza'),
          Sync.enabled() ? h('button', { class: 'btn', onclick: () => Sync.run() }, 'Sincronizza ora') : null,
          Sync.enabled() ? h('button', { class: 'btn danger', onclick: () => { if (confirm('Scollegare questo dispositivo? I dati restano su GitHub e in cache.')) { localStorage.removeItem(LS.cfg); Sync.setState('local'); render(); } } }, 'Scollega') : null),
        h('div', { class: 'help', style: 'margin-top:14px' },
          h('b', null, 'Come creare il token (una volta, gratis):'),
          h('ol', null,
            h('li', null, 'GitHub → Settings → Developer settings → Personal access tokens → ', h('b', null, 'Fine-grained tokens'), ' → Generate new token.'),
            h('li', null, 'Repository access: ', h('b', null, 'Only select repositories'), ' → scegli solo il repo dati.'),
            h('li', null, 'Permissions → Repository → ', h('b', null, 'Contents: Read and write'), '. Nient\'altro.'),
            h('li', null, 'Copia il token e salvalo nel tuo password manager: serve su ogni dispositivo e dopo aver cancellato i dati del browser.')),
          h('p', null, 'Il token resta solo su questo dispositivo. Ogni modifica diventa un commit nel repo privato: hai anche lo storico.'))),
      h('div', { class: 'panel' },
        h('h2', null, 'Google Calendar'),
        h('div', { class: 'field' }, h('label', { for: 'f-cal' }, 'Account su cui aggiungere le scadenze'),
          h('input', { class: 'input', id: 'f-cal', type: 'email', value: DB.meta.calendarEmail || '', onchange: (e) => updateMeta({ calendarEmail: e.target.value.trim() }) })),
        h('p', { class: 'help' }, 'Il pulsante "Aggiungi a Google Calendar" apre l\'evento già compilato: lo salvi tu. Se poi cambi la data nell\'app, l\'evento su Calendar non si aggiorna da solo.')),
      h('div', { class: 'panel' },
        h('h2', null, 'Backup'),
        h('div', { class: 'inline' },
          h('button', { class: 'btn', onclick: () => {
            const blob = new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `lista-backup-${todayISO()}.json` }); document.body.append(a); a.click(); a.remove();
          } }, icon('download'), 'Esporta JSON'),
          h('label', { class: 'btn', for: 'imp' }, icon('upload'), 'Importa JSON'), fileIn),
        h('p', { class: 'help' }, 'Importare unisce il file ai dati attuali (per ogni elemento vince la modifica più recente).')),
    )],
  };
}

/* ---------------- Nuovo elemento */
function viewNew(route) {
  const kind = route.arg || 'task';
  const q = route.q;
  const titles = { task: 'Nuova attività', place: 'Nuovo posto', trip: 'Nuovo viaggio', link: 'Nuovo link', note: 'Nuovo appunto' };
  const st = { projectId: q.get('p') || '', urgent: q.get('urgent') === '1', dream: q.get('dream') === '1', deadline: '', scope: q.get('scope') === 'vita' ? 'vita' : 'fattibile', category: q.get('cat') || '' };
  const titleIn = h('input', { class: 'input', placeholder: kind === 'link' ? 'Nome del link' : 'Titolo', 'aria-label': 'Titolo', enterkeyhint: 'done' });
  const urlIn = h('input', { class: 'input', type: 'url', placeholder: 'https://…', 'aria-label': 'URL', inputmode: 'url', autocapitalize: 'off' });
  const save = () => {
    const title = titleIn.value.trim();
    const url = safeUrl(urlIn.value);
    if (!title && !(kind === 'link' && url)) { titleIn.focus(); return; }
    const f = { title: title || domainOf(url) };
    if (kind === 'task') Object.assign(f, { projectId: st.projectId || null, urgent: st.urgent, dream: st.dream, deadline: st.deadline || null });
    if (kind === 'place') f.scope = st.scope;
    if (kind === 'trip') f.done = true;
    if (kind === 'link') { f.url = url; f.category = st.category || 'Da smistare'; }
    createItem(kind, f);
    toast('Aggiunto');
    goBack(kind === 'link' ? 'link' : kind === 'note' ? 'appunti' : kind === 'task' ? 'attivita' : 'viaggi');
  };
  titleIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const tog = (key, label, cls, ic) => {
    const b = h('button', { class: 'toggle ' + cls, 'aria-pressed': String(st[key]), onclick: () => { st[key] = !st[key]; b.setAttribute('aria-pressed', String(st[key])); } }, icon(ic), label);
    return b;
  };
  const body = [h('div', { class: 'detail' }, h('div', { class: 'panel' },
    h('div', { class: 'field' }, titleIn),
    kind === 'link' ? h('div', { class: 'field' }, h('label', null, 'URL'), urlIn) : null,
    kind === 'link' ? h('div', { class: 'field' }, h('label', null, 'Categoria'), categorySelect(st.category, (v) => { st.category = v; })) : null,
    kind === 'task' ? [
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Etichette'), h('div', { class: 'toggles' }, tog('urgent', 'Urgente', 't-urgent', 'flag'), tog('dream', 'Sogno', 't-dream', 'moon'))),
      h('div', { class: 'field' }, h('label', null, 'Progetto'), projectSelect(st.projectId, (v) => { st.projectId = v; })),
      h('div', { class: 'field' }, h('label', { for: 'nd' }, 'Scadenza (facoltativa)'), h('input', { class: 'input', id: 'nd', type: 'date', onchange: (e) => { st.deadline = e.target.value; } })),
    ] : null,
    kind === 'place' ? h('div', { class: 'field' }, h('label', null, 'Elenco'),
      h('select', { class: 'input', onchange: (e) => { st.scope = e.target.value; } },
        h('option', { value: 'fattibile', selected: st.scope === 'fattibile' }, 'Da vedere (fattibile)'),
        h('option', { value: 'vita', selected: st.scope === 'vita' }, 'Da vedere nella vita'))) : null,
    h('div', { class: 'inline', style: 'margin-top:16px' }, h('button', { class: 'btn primary', onclick: save }, 'Aggiungi'), h('button', { class: 'btn', onclick: () => goBack() }, 'Annulla')),
    h('p', { class: 'help', style: 'margin-bottom:0' }, 'Note, liste di controllo e link si aggiungono aprendo l\'elemento dopo averlo creato.'),
  ))];
  return { top: topBar(titles[kind] || 'Nuovo', { back: 'attivita', small: true, noSync: true }), body, after: () => titleIn.focus() };
}

function projectSelect(value, onChange) {
  const sel = h('select', { class: 'input', 'aria-label': 'Progetto' },
    h('option', { value: '' }, 'Nessun progetto'),
    projects().map((p) => h('option', { value: p.id, selected: p.id === value }, p.name)),
    h('option', { value: '__new' }, '+ Nuovo progetto…'));
  sel.addEventListener('change', () => {
    if (sel.value === '__new') {
      const n = prompt('Nome del nuovo progetto');
      if (n && n.trim()) {
        const p = createProject(n.trim());
        sel.insertBefore(h('option', { value: p.id }, p.name), sel.lastChild);
        sel.value = p.id; onChange(p.id);
      } else sel.value = value || '';
      return;
    }
    onChange(sel.value);
  });
  return sel;
}
function categorySelect(value, onChange) {
  const cats = linkCategories();
  if (value && !cats.includes(value)) cats.push(value);
  const sel = h('select', { class: 'input', 'aria-label': 'Categoria' },
    h('option', { value: '' }, 'Da smistare'),
    cats.filter((c) => c !== 'Da smistare').map((c) => h('option', { value: c, selected: c === value }, c)),
    h('option', { value: '__new' }, '+ Nuova categoria…'));
  sel.addEventListener('change', () => {
    if (sel.value === '__new') {
      const n = prompt('Nome della nuova categoria');
      if (n && n.trim()) {
        const name = n.trim();
        if (!DB.meta.linkCategories.includes(name)) { DB.meta.linkCategories.push(name); DB.meta.updatedAt = now(); persist({ render: false }); }
        sel.insertBefore(h('option', { value: name }, name), sel.lastChild); sel.value = name; onChange(name);
      } else sel.value = value || '';
      return;
    }
    onChange(sel.value);
  });
  return sel;
}

/* ---------------- Dettaglio elemento */
const editState = { notes: null, entry: null, showDone: {} };
function gcalUrl(it) {
  const d = it.deadline.replace(/-/g, '');
  const next = addDaysISO(it.deadline, 1).replace(/-/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: it.title, dates: `${d}/${next}`, details: ((it.notes || '') + '\n\n(da Lista personale)').trim() });
  const acct = DB.meta.calendarEmail;
  return `https://calendar.google.com/calendar/render?${p.toString()}${acct ? '&authuser=' + encodeURIComponent(acct) : ''}`;
}
function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function viewItem(route) {
  const it = DB.items[route.arg];
  const kindLabel = { task: 'Attività', place: 'Posto', trip: 'Viaggio', link: 'Link', note: 'Appunto' };
  const fallback = !it ? 'attivita' : it.kind === 'task' ? 'attivita' : it.kind === 'link' ? 'link' : it.kind === 'note' ? 'appunti' : 'viaggi';
  if (!it || it.deleted) return { top: topBar('Non trovato', { back: fallback, small: true }), body: [h('div', { class: 'empty' }, 'Questo elemento non esiste più.')] };
  const id = it.id;

  let tTimer;
  const titleEl = h('textarea', { class: 'title-input', rows: 1, 'aria-label': 'Titolo', value: it.title,
    oninput: (e) => { autoGrow(e.target); clearTimeout(tTimer); const v = e.target.value; tTimer = setTimeout(() => updateItem(id, { title: v.replace(/\n/g, ' ') }, { render: false }), 400); },
    onblur: (e) => { clearTimeout(tTimer); if (e.target.value !== DB.items[id].title) updateItem(id, { title: e.target.value.replace(/\n/g, ' ').trim() }, { render: false }); } });

  const tog = (key, label, cls, ic, onTrue) => h('button', { class: 'toggle ' + cls, 'aria-pressed': String(!!it[key]),
    onclick: () => { const v = !it[key]; const patch = { [key]: v }; if (key === 'done') patch.doneAt = v ? now() : null; updateItem(id, patch); } }, icon(ic), label);

  const props = [];
  if (it.kind === 'task') {
    props.push(h('div', { class: 'toggles' }, tog('done', it.done ? 'Fatta' : 'Da fare', 't-done', 'check'), tog('urgent', 'Urgente', 't-urgent', 'flag'), tog('dream', 'Sogno', 't-dream', 'moon')));
    props.push(h('div', { class: 'field' }, h('label', null, 'Progetto'), projectSelect(it.projectId || '', (v) => updateItem(id, { projectId: v || null }))));
    props.push(h('div', { class: 'field' }, h('label', { for: 'dl' }, 'Scadenza'),
      h('div', { class: 'inline' },
        h('input', { class: 'input', id: 'dl', type: 'date', value: it.deadline || '', onchange: (e) => updateItem(id, { deadline: e.target.value || null }) }),
        it.deadline ? h('button', { class: 'btn', onclick: () => updateItem(id, { deadline: null }) }, 'Togli') : null),
      it.deadline ? h('a', { class: 'btn', href: gcalUrl(it), target: '_blank', rel: 'noopener noreferrer', style: 'margin-top:8px' }, icon('cal'), 'Aggiungi a Google Calendar') : null));
  } else if (it.kind === 'place') {
    props.push(h('div', { class: 'toggles' }, tog('done', it.done ? 'Visitato' : 'Da visitare', 't-done', 'check')));
    props.push(h('div', { class: 'field' }, h('label', null, 'Elenco'),
      h('select', { class: 'input', onchange: (e) => updateItem(id, { scope: e.target.value }) },
        h('option', { value: 'fattibile', selected: it.scope !== 'vita' }, 'Da vedere (fattibile)'),
        h('option', { value: 'vita', selected: it.scope === 'vita' }, 'Da vedere nella vita'))));
  } else if (it.kind === 'link') {
    const url = safeUrl(it.url);
    props.push(h('div', { class: 'field' }, h('label', { for: 'lu' }, 'URL'),
      h('div', { class: 'inline' },
        h('input', { class: 'input', id: 'lu', type: 'url', value: it.url || '', autocapitalize: 'off', onchange: (e) => updateItem(id, { url: e.target.value.trim() }) }),
        url ? h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), 'Apri') : null)));
    props.push(h('div', { class: 'field' }, h('label', null, 'Categoria'), categorySelect(it.category || '', (v) => updateItem(id, { category: v || 'Da smistare' }))));
  }

  // note
  const notesPanel = h('div', { class: 'panel' });
  const drawNotes = () => {
    const editing = editState.notes === id || !it.notes;
    let nTimer;
    const ta = h('textarea', { class: 'input', placeholder: 'Note, avanzamento, idee, link…', 'aria-label': 'Note', value: it.notes || '',
      oninput: (e) => { autoGrow(e.target); clearTimeout(nTimer); const v = e.target.value; nTimer = setTimeout(() => updateItem(id, { notes: v }, { render: false }), 500); },
      onblur: (e) => { clearTimeout(nTimer); if (e.target.value !== (DB.items[id].notes || '')) updateItem(id, { notes: e.target.value }, { render: false }); } });
    notesPanel.replaceChildren(
      h('h2', null, h('span', { class: 'grow' }, 'Note'),
        it.notes ? h('button', { class: 'btn ghost', onclick: () => { if (editState.notes === id) { editState.notes = null; } else editState.notes = id; drawNotes(); const t = notesPanel.querySelector('textarea'); if (t) { autoGrow(t); t.focus(); } } }, editing ? 'Fine' : 'Modifica') : null),
      editing ? ta : h('div', { class: 'notes-view' }, linkify(it.notes)));
    if (editing) requestAnimationFrame(() => autoGrow(ta));
  };
  drawNotes();

  const listsEls = (it.lists || []).map((l) => listPanel(it, l));
  const body = [h('div', { class: 'detail' },
    titleEl,
    props.length ? h('div', { class: 'panel props' }, props) : null,
    notesPanel,
    listsEls,
    h('button', { class: 'btn block', onclick: () => {
      const n = prompt('Nome della lista (es. Link, Passi, Da comprare)', (it.lists || []).length ? 'Nuova lista' : 'Lista');
      if (!n || !n.trim()) return;
      updateItem(id, { lists: [...(it.lists || []), { id: uid('l'), title: n.trim(), entries: [] }] });
    } }, icon('plus'), 'Aggiungi lista di controllo'),
    h('button', { class: 'btn danger block', onclick: () => { if (confirm('Eliminare "' + (it.title || 'elemento') + '"?')) { deleteItem(id); goBack(fallback); } } }, icon('trash'), 'Elimina'),
    h('div', { class: 'footer-meta' }, 'Creato ' + new Date(it.createdAt).toLocaleDateString('it-IT') + (it.done && it.doneAt ? ' · completato ' + new Date(it.doneAt).toLocaleDateString('it-IT') : '')),
  )];
  return { top: topBar(kindLabel[it.kind] || 'Dettaglio', { back: fallback, small: true }), body, after: () => autoGrow(titleEl) };
}

function listPanel(it, l) {
  const id = it.id;
  const save = (newEntries, newTitle) => {
    const lists = it.lists.map((x) => x.id === l.id ? Object.assign({}, x, { entries: newEntries || x.entries, title: newTitle || x.title }) : x);
    updateItem(id, { lists });
  };
  const undone = l.entries.filter((e) => !e.done), done = l.entries.filter((e) => e.done);
  const showDone = editState.showDone[l.id] || !undone.length;
  const entryEl = (e) => {
    if (editState.entry === e.id) {
      const t = h('input', { class: 'input', value: e.text, 'aria-label': 'Testo' });
      const u = h('input', { class: 'input', value: e.url || '', type: 'url', placeholder: 'Link (facoltativo)', 'aria-label': 'Link', autocapitalize: 'off' });
      return h('div', { class: 'entry-edit' }, t, u, h('div', { class: 'inline' },
        h('button', { class: 'btn primary', onclick: () => { editState.entry = null; save(l.entries.map((x) => x.id === e.id ? Object.assign({}, x, { text: t.value.trim() || domainOf(u.value), url: u.value.trim() }) : x)); } }, 'Salva'),
        h('button', { class: 'btn', onclick: () => { editState.entry = null; render(); } }, 'Annulla'),
        h('button', { class: 'btn danger', onclick: () => { editState.entry = null; save(l.entries.filter((x) => x.id !== e.id)); } }, 'Elimina')));
    }
    const url = safeUrl(e.url);
    return h('div', { class: 'entry' + (e.done ? ' is-done' : '') },
      checkBtn(e.done, (e.done ? 'Togli spunta: ' : 'Spunta: ') + e.text, () => save(l.entries.map((x) => x.id === e.id ? Object.assign({}, x, { done: !x.done }) : x))),
      h('div', { class: 'body' }, url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, e.text, h('span', { class: 'dom' }, domainOf(url))) : linkify(e.text)),
      h('button', { class: 'icon-btn plain', 'aria-label': 'Modifica voce: ' + e.text, onclick: () => { editState.entry = e.id; render(); } }, icon('edit')));
  };
  const addIn = h('input', { class: 'input', placeholder: 'Aggiungi voce o incolla un link…', 'aria-label': 'Nuova voce in ' + l.title, enterkeyhint: 'enter' });
  const add = () => {
    const v = addIn.value.trim(); if (!v) return;
    const m = v.match(URL_RE);
    let text = v, url = '';
    if (m) { url = m[0]; text = v.replace(m[0], '').replace(/^[\s:–-]+|[\s:–-]+$/g, '') || domainOf(url); }
    const entries = [...l.entries, { id: uid('e'), text, url, done: false }];
    const lists = it.lists.map((x) => x.id === l.id ? Object.assign({}, x, { entries }) : x);
    updateItem(id, { lists }, { render: false });
    addIn.value = '';
    // aggiorna solo questo pannello, mantenendo il focus per inserimenti in serie
    const panel = addIn.closest('.panel');
    const fresh = listPanel(DB.items[id], DB.items[id].lists.find((x) => x.id === l.id));
    panel.replaceWith(fresh);
    fresh.querySelector('.add-entry input').focus();
  };
  addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return h('div', { class: 'panel' },
    h('h2', null,
      h('span', { class: 'grow' }, l.title),
      h('span', { class: 'prog' }, `${done.length}/${l.entries.length}`),
      h('button', { class: 'icon-btn plain', 'aria-label': 'Rinomina lista ' + l.title, onclick: () => { const n = prompt('Nome della lista', l.title); if (n && n.trim()) save(null, n.trim()); } }, icon('edit')),
      h('button', { class: 'icon-btn plain', 'aria-label': 'Elimina lista ' + l.title, onclick: () => { if (confirm(`Eliminare la lista "${l.title}" e le sue ${l.entries.length} voci?`)) updateItem(id, { lists: it.lists.filter((x) => x.id !== l.id) }); } }, icon('trash'))),
    h('div', { class: 'entries' }, undone.map(entryEl), showDone ? done.map(entryEl) : null),
    done.length && undone.length ? h('button', { class: 'btn ghost showdone', onclick: () => { editState.showDone[l.id] = !showDone; render(); } }, showDone ? 'Nascondi spuntate' : `Mostra spuntate (${done.length})`) : null,
    h('div', { class: 'add-entry' }, addIn, h('button', { class: 'btn', onclick: add, 'aria-label': 'Aggiungi voce' }, icon('plus'))),
  );
}

/* ================================================================ avvio */
if (!location.hash) history.replaceState(null, '', '#/attivita');
navStack.push(parseRoute().raw);
render(true);
if (Sync.enabled()) Sync.run(); else Sync.setState('local');
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Sync.enabled()) Sync.run(); });
window.addEventListener('online', () => { if (Sync.enabled()) Sync.run(); });
window.addEventListener('pagehide', () => { if (lsGet(LS.dirty, false) && Sync.enabled()) Sync.run(); });
