/* Collegamento con l'app "Documenti casa": bollette, condominio, multe… da pagare.
   Fonte unica: data.json del repo documenti-casa-data. Qui non si copiano i documenti:
   si leggono, si mostrano come attività e la spunta scrive lo stato direttamente nel loro file,
   così l'app documenti si aggiorna da sola alla sua prossima sincronizzazione.
   Caricato prima di app.js. */
'use strict';

const DOCS_LS = { cfg: 'lp.docscfg', cache: 'lp.docs', pending: 'lp.docsPending' };
const DOC_CATS = { utenze: 'Utenze', condominio: 'Condominio', assicurazioni: 'Assicurazioni', bollo: 'Bollo', mutuo: 'Mutuo', lavori: 'Lavori', elettro: 'Elettrodomestici e mobili', contratti: 'Contratti', altro: 'Altro', multe: 'Multe' };
/* Le due app stanno sullo stesso sito (cartesio89.github.io): la lista può leggere il collegamento
   GitHub già configurato in Documenti casa, così non serve configurare niente due volte. */
const docsAppCfg = () => { const c = lsGet('dc.cfg', null); return c && c.token ? c : null; };
const DOC_OPEN = (d) => d.status === 'da_pagare' || d.status === 'addebitata';

const DocsLink = {
  state: 'off', error: '', last: 0, busy: false, again: false, timer: null,
  cfg() {
    const c = lsGet(DOCS_LS.cfg, null);
    const dc = docsAppCfg();
    const base = { owner: (dc && dc.owner) || 'Cartesio89', repo: (dc && dc.repo) || 'documenti-casa-data', branch: (dc && dc.branch) || 'main', token: '', appUrl: 'https://cartesio89.github.io/documenti-casa/', on: !!dc };
    return c ? Object.assign(base, c) : (dc ? base : null);
  },
  enabled() { const c = this.cfg(); return !!(c && c.on && this.token()); },
  /* ordine: token messo qui a mano → token di Documenti casa su questo telefono → token della lista */
  token() { const c = this.cfg() || {}; const dc = docsAppCfg(); return (c.token || '').trim() || (dc ? dc.token : '') || ((Sync.cfg() || {}).token || ''); },
  async api(path, opts = {}) {
    const c = this.cfg();
    return fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${path}`, Object.assign({}, opts, {
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + this.token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opts.headers || {}),
    }));
  },
  async read() {
    const c = this.cfg();
    const r = await this.api(`contents/data.json?ref=${encodeURIComponent(c.branch || 'main')}`);
    if (r.status === 404) throw new Error('data.json non trovato nel repo ' + c.repo + ' (o il token non ha accesso a quel repo)');
    if (r.status === 401 || r.status === 403) throw new Error('Il token non ha accesso al repo ' + c.repo + ' (' + r.status + ')');
    if (!r.ok) throw new Error('Lettura documenti fallita (' + r.status + ')');
    const j = await r.json();
    let b64 = j.content;
    if (!b64 && j.sha) { const rb = await this.api(`git/blobs/${j.sha}`); if (!rb.ok) throw new Error('Lettura documenti fallita'); b64 = (await rb.json()).content; }
    return { data: JSON.parse(b64decode(b64)), sha: j.sha };
  },
  async write(data, sha) {
    const c = this.cfg();
    const body = { message: 'Pagamento aggiornato dalla Lista personale', content: b64encode(JSON.stringify(data)), branch: c.branch || 'main', sha };
    const r = await this.api('contents/data.json', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (r.status === 401 || r.status === 403) throw new Error('Il token non può scrivere nel repo ' + c.repo + ' (' + r.status + ')');
    if (!r.ok) throw new Error('Salvataggio pagamento fallito (' + r.status + ')');
    return { ok: true };
  },
  async run() {
    if (!this.enabled()) { this.state = 'off'; return; }
    if (!navigator.onLine) { this.state = 'offline'; return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, sha } = await this.read();
        const pending = lsGet(DOCS_LS.pending, {});
        let changed = false;
        for (const [id, p] of Object.entries(pending)) {
          const d = (data.docs || {})[id];
          if (!d || (d.updatedAt || 0) > p.ts) { delete pending[id]; continue; } // cancellato o modificato dopo di là: vince l'altra app
          Object.assign(d, { status: p.status, prevStatus: p.prevStatus, paidAt: p.paidAt, unseen: false, updatedAt: Math.max(now(), (d.updatedAt || 0) + 1) });
          changed = true;
        }
        if (changed) {
          const res = await this.write(data, sha);
          if (res.conflict) continue;
        }
        lsSet(DOCS_LS.pending, changed ? {} : pending);
        this.store(data);
        break;
      }
      this.state = 'ok'; this.error = ''; this.last = now();
    } catch (e) {
      this.state = 'error'; this.error = e.message || String(e);
    } finally {
      this.busy = false;
      render();
      if (this.again) { this.again = false; this.schedule(300); }
    }
  },
  store(data) {
    const slim = {};
    for (const d of Object.values(data.docs || {})) {
      if (d.deleted || d.status === 'none') continue;
      slim[d.id] = { id: d.id, title: d.title, section: d.section, category: d.category, sub: d.sub, status: d.status, prevStatus: d.prevStatus,
        amount: d.amount, dueDate: d.dueDate, docDate: d.docDate, paidAt: d.paidAt, updatedAt: d.updatedAt };
    }
    lsSet(DOCS_LS.cache, { docs: slim, fetchedAt: now() });
  },
  schedule(ms = 600) { clearTimeout(this.timer); if (this.enabled()) this.timer = setTimeout(() => this.run(), ms); },
  start() {
    if (this.enabled()) this.run();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule(200); });
    setInterval(() => { if (document.visibilityState === 'visible' && !this.busy && !isEditing()) this.schedule(0); }, 90 * 1000);
    window.addEventListener('online', () => this.schedule(200));
  },
};

/* documenti come li vede la lista: cache + spunte non ancora scritte */
function payDocs() {
  if (!DocsLink.enabled()) return [];
  const cache = lsGet(DOCS_LS.cache, { docs: {} }).docs || {};
  const pending = lsGet(DOCS_LS.pending, {});
  return Object.values(cache).map((d) => (pending[d.id] ? Object.assign({}, d, pending[d.id], { syncing: true }) : d));
}
const payOpen = () => payDocs().filter(DOC_OPEN).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.docDate || '').localeCompare(b.docDate || ''));
function payPaidRecent(days = 90) {
  const from = addDaysISO(todayISO(), -days);
  return payDocs().filter((d) => d.status === 'pagato' && (d.paidAt || '') >= from).sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

function togglePay(d) {
  const pending = lsGet(DOCS_LS.pending, {});
  const cur = Object.assign({}, d, pending[d.id] || {});
  const patch = DOC_OPEN(cur)
    ? { status: 'pagato', prevStatus: cur.status, paidAt: todayISO(), ts: now() }
    : { status: cur.prevStatus && cur.prevStatus !== 'pagato' ? cur.prevStatus : 'da_pagare', prevStatus: cur.prevStatus || null, paidAt: null, ts: now() };
  pending[d.id] = patch;
  lsSet(DOCS_LS.pending, pending);
  render();
  DocsLink.schedule(400);
  const undo = () => { const p = lsGet(DOCS_LS.pending, {}); p[d.id] = { status: cur.status, prevStatus: cur.prevStatus || null, paidAt: cur.paidAt || null, ts: now() }; lsSet(DOCS_LS.pending, p); render(); DocsLink.schedule(400); };
  toast(patch.status === 'pagato' ? 'Pagato: aggiorno anche Documenti casa' : 'Rimesso da pagare', 'Annulla', undo);
}

function docUrl(d) { const c = DocsLink.cfg() || {}; return (c.appUrl || '').replace(/#.*$/, '') + '#/doc/' + encodeURIComponent(d.id); }

function payRow(d) {
  const t = todayISO();
  const late = DOC_OPEN(d) && d.dueDate && d.dueDate < t;
  const meta = h('div', { class: 'meta' },
    d.status === 'addebitata' ? h('span', { class: 'badge dec' }, 'Addebito') : d.status === 'da_pagare' ? h('span', { class: 'badge urgent' }, 'Da pagare') : null,
    d.amount != null ? h('span', { class: 'm' }, eur(Number(d.amount))) : null,
    h('span', { class: 'm' }, DOC_CATS[d.category] || d.category || 'Documento'),
    d.dueDate && DOC_OPEN(d) ? h('span', { class: late ? 'badge late' : 'm' }, late ? null : icon('clock'), (late ? 'Scaduta ' : 'Scade ') + fmtDate(d.dueDate)) : null,
    d.status === 'pagato' && d.paidAt ? h('span', { class: 'm' }, 'Pagato il ' + fmtDate(d.paidAt)) : null,
    d.syncing ? h('span', { class: 'm', title: 'In attesa di scrittura su Documenti casa' }, '⟳') : null);
  return h('div', { class: 'row pay-row' + (d.status === 'pagato' ? ' is-done' : '') },
    h('span', { style: 'width:8px;flex:none' }),
    checkBtn(d.status === 'pagato', (d.status === 'pagato' ? 'Rimetti da pagare: ' : 'Segna pagato: ') + d.title, (e) => { e.stopPropagation(); togglePay(d); }),
    h('a', { class: 'row-main', href: docUrl(d), target: '_blank', rel: 'noopener', title: 'Apri in Documenti casa' },
      h('span', { class: 'row-title' }, d.title || 'Documento'), meta));
}

/* blocco mostrato in Attività (Da fare / Fatte) */
function payBlock(seg, q, filters) {
  if (!DocsLink.enabled()) return null;
  if (filters.length && !filters.includes('pay')) return null;
  const match = (d) => !q || ((d.title || '') + ' ' + (DOC_CATS[d.category] || '')).toLowerCase().includes(q);
  const list = (seg === 'done' ? payPaidRecent() : payOpen()).filter(match);
  const err = DocsLink.state === 'error' ? h('p', { class: 'help', style: 'margin:0 4px 8px' }, '⚠️ Documenti casa non aggiornati: ', DocsLink.error, ' — ', h('a', { href: '#/impostazioni' }, 'impostazioni')) : null;
  if (!list.length) return err ? [err] : null;
  const tot = list.reduce((s, d) => s + (d.amount != null ? Number(d.amount) : 0), 0);
  return [
    h('div', { class: 'group-title sec-title' }, h('span', null, seg === 'done' ? 'Pagati · Documenti casa' : 'Da pagare · Documenti casa'),
      h('span', { class: 'sec-sum' }, `${list.length}${tot ? ' · ' + eur(tot) : ''}${seg === 'done' ? ' · ultimi 90 giorni' : ''}`)),
    err,
    h('div', { class: 'list' }, list.map(payRow)),
    h('div', { class: 'group-title' }, seg === 'done' ? 'Attività fatte' : 'Attività'),
  ];
}
const payCount = (seg) => (DocsLink.enabled() ? (seg === 'done' ? payPaidRecent() : payOpen()).length : 0);

/* pannello impostazioni */
function payPanel() {
  const c = DocsLink.cfg() || { owner: 'Cartesio89', repo: 'documenti-casa-data', branch: 'main', token: '', appUrl: 'https://cartesio89.github.io/documenti-casa/', on: false };
  const f = {};
  const fld = (k, label, attrs = {}) => h('div', { class: 'field' }, h('label', { for: 'pd-' + k }, label),
    f[k] = h('input', Object.assign({ class: 'input', id: 'pd-' + k, value: c[k] || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }, attrs)));
  const st = !c.on ? 'Collegamento non attivo.'
    : DocsLink.state === 'ok' ? `Collegato. Ultimo aggiornamento alle ${new Date(DocsLink.last).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}: ${payOpen().length} da pagare.`
      : DocsLink.state === 'error' ? 'Problema: ' + DocsLink.error : 'In attesa del primo aggiornamento…';
  return h('div', { class: 'panel' },
    h('h2', null, 'Documenti casa (bollette e pagamenti)'),
    h('p', { class: 'small', style: 'margin-top:0' }, st),
    fld('owner', 'Utente GitHub'), fld('repo', 'Repo dati di Documenti casa'),
    fld('token', docsAppCfg() ? 'Token (vuoto = usa quello di Documenti casa su questo telefono)' : 'Token (lascia vuoto per usare quello della lista)', { type: 'password', placeholder: docsAppCfg() ? 'preso da Documenti casa' : 'stesso token della lista' }),
    fld('appUrl', 'Indirizzo dell\'app Documenti casa', { type: 'url' }),
    h('div', { class: 'inline', style: 'margin-top:12px' },
      h('button', { class: 'btn primary', onclick: async () => {
        lsSet(DOCS_LS.cfg, { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: 'main', token: f.token.value.trim(), appUrl: f.appUrl.value.trim(), on: true });
        await DocsLink.run();
        toast(DocsLink.state === 'ok' ? `Collegato: ${payOpen().length} documenti da pagare` : 'Errore: ' + DocsLink.error);
      } }, c.on ? 'Salva e aggiorna' : 'Collega'),
      c.on ? h('button', { class: 'btn danger', onclick: () => { lsSet(DOCS_LS.cfg, Object.assign({}, c, { on: false })); DocsLink.state = 'off'; render(); } }, 'Scollega') : null),
    h('div', { class: 'help', style: 'margin-top:12px' },
      h('p', { style: 'margin:0 0 6px' }, 'Le bollette, le rate del condominio, le multe e gli altri documenti "Da pagare" o "Addebito" compaiono in Attività. Spuntarli qui li segna pagati anche in Documenti casa, e viceversa.'),
      docsAppCfg() ? h('p', { style: 'margin:0 0 6px' }, 'Su questo telefono Documenti casa è già collegata: la lista usa il suo collegamento in automatico, non serve fare altro.') : null,
      h('p', { style: 'margin:0' }, 'Se Documenti casa non è configurata su questo telefono, il token deve poter leggere e scrivere anche il repo ', h('code', null, 'documenti-casa-data'), ': su GitHub apri il token della lista → Edit → Repository access → aggiungi quel repo. Il token non cambia, non serve reincollarlo.')));
}
