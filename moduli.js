/* Collezioni: Magic (mazzo Jarad) e Lego.
   Caricato prima di app.js: usa le sue funzioni (h, icon, DB, persist, render…) solo quando viene chiamato.
   Dati:
     DB.sheets  fogli (tab) con sezioni e colonne
     DB.srows   righe dei fogli: carte, voci di tabella, blocchi di testo, set Lego
     DB.mcards  possesso delle carte Magic, condiviso fra tutti i tab (chiave = nome normalizzato)
     DB.mbuys   acquisti Magic (carta singola o lotto) con prezzo */
'use strict';

/* ================================================================ utilità */
function ckey(name) {
  return 'c:' + String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
}
function num(x) {
  const m = String(x == null ? '' : x).trim().match(/^~?\s*€?\s*(-?\d+(?:[.,]\d+)?)\s*€?$/);
  return m ? parseFloat(m[1].replace(',', '.')) : NaN;
}
function eur(n) { return (Math.round(n * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
function cellPrice(x) { const n = num(x); return isNaN(n) ? (x ? String(x) + ' €' : '') : eur(n); }

const sheetsOf = (mod) => Object.values(DB.sheets || {}).filter((s) => !s.deleted && s.module === mod).sort((a, b) => a.order - b.order);
const rowsOf = (sid, secId) => Object.values(DB.srows || {}).filter((r) => !r.deleted && r.sheet === sid && (!secId || r.section === secId)).sort((a, b) => a.order - b.order);
const secOf = (r) => { const s = DB.sheets[r.sheet]; return s ? (s.sections || []).find((x) => x.id === r.section) || {} : {}; };
const isCardSec = (sec) => sec.type === 'cards' || sec.type === 'owned';
const rowName = (r, sec) => (r.type === 'text' ? r.title : (r.cells || {})[sec.nameCol || firstCol(sec)]) || '';
const firstCol = (sec) => ((sec.columns || [])[0] || {}).k;

function touch(map, id, patch, opts) {
  Object.assign(DB[map][id], patch, { updatedAt: now() });
  persist(opts);
}
const updRow = (id, patch, opts) => touch('srows', id, patch, opts);

/* ================================================================ possesso carte e acquisti */
const owned = (key) => !!(DB.mcards[key] && DB.mcards[key].owned);
function setOwned(key, name, val) {
  if (!DB.mcards[key]) DB.mcards[key] = { id: key, name: name || key.slice(2), owned: false, createdAt: now() };
  Object.assign(DB.mcards[key], { owned: !!val, updatedAt: now() });
}
const buys = () => Object.values(DB.mbuys || {}).filter((b) => !b.deleted);
const buysOf = (key) => buys().filter((b) => (b.cards || []).some((c) => c.key === key));
const buysTotal = () => buys().reduce((t, b) => t + (isNaN(num(b.price)) ? 0 : num(b.price)), 0);

function rowStatus(r, sec) {
  const o = owned(ckey(rowName(r, sec)));
  if (sec.type === 'owned') return o ? 'own' : 'need';
  const needed = r.needed !== false;
  return o ? (needed ? 'own' : 'ownx') : (needed ? 'need' : 'no');
}
const STATUS_INFO = {
  need: { sym: '', label: 'Da prendere', cls: 'st-need' },
  own: { sym: '✓', label: 'Posseduta', cls: 'st-own' },
  ownx: { sym: '✓*', label: 'Posseduta, non più necessaria', cls: 'st-ownx' },
  no: { sym: '○', label: 'Non più necessaria', cls: 'st-no' },
};

/* Segna posseduta: se non è già in un acquisto, chiede il prezzo e crea un acquisto singolo nel recap. */
function markOwned(key, name) {
  if (!buysOf(key).length) {
    const p = prompt(`Hai acquistato «${name}»?\nPrezzo pagato in € (lascia vuoto se non lo ricordi).\nPer più carte insieme usa «Registra acquisto» nel Recap acquisti.`, '');
    if (p === null) return false;
    const id = uid('b');
    DB.mbuys[id] = { id, title: name, date: todayISO(), price: p.trim().replace(',', '.'), note: '', cards: [{ key, name }], order: nextBuyOrder(), createdAt: now(), updatedAt: now() };
  }
  setOwned(key, name, true);
  return true;
}
function unOwn(key, name) {
  const bs = buysOf(key);
  if (bs.length) {
    if (!confirm(`«${name}» è nel recap acquisti (${bs.map((b) => b.title).join(', ')}).\nSegnarla come non posseduta e toglierla da quell'acquisto?`)) return false;
    for (const b of bs) {
      const cards = b.cards.filter((c) => c.key !== key);
      Object.assign(b, cards.length ? { cards } : { cards, deleted: true }, { updatedAt: now() });
    }
  }
  setOwned(key, name, false);
  return true;
}
const nextBuyOrder = () => Math.max(0, ...buys().map((b) => b.order || 0)) + 10;

/* Ciclo al tocco: vuoto → ✓ → ✓* → ○ → vuoto (nelle liste solo-possesso: vuoto ↔ ✓) */
function cycleRow(r) {
  const sec = secOf(r), name = rowName(r, sec), key = ckey(name);
  if (!name) { go('riga/' + r.id); return; }
  const st = rowStatus(r, sec);
  let ok = true;
  if (sec.type === 'owned') ok = st === 'own' ? unOwn(key, name) : markOwned(key, name);
  else if (st === 'need') ok = markOwned(key, name);
  else if (st === 'own') { r.needed = false; }
  else if (st === 'ownx') ok = unOwn(key, name);
  else { r.needed = true; }
  if (!ok) return;
  r.updatedAt = now();
  persist();
  const after = rowStatus(r, sec);
  toast(`${name}: ${STATUS_INFO[after].label.toLowerCase()}${sec.type === 'cards' && (st === 'need' || st === 'ownx') ? ' (vale in tutti i tab)' : ''}`);
}

function statusBtn(r, sec) {
  const st = rowStatus(r, sec), info = STATUS_INFO[st];
  const next = sec.type === 'owned' ? (st === 'own' ? 'need' : 'own') : { need: 'own', own: 'ownx', ownx: 'no', no: 'need' }[st];
  return h('button', { class: 'status-btn ' + info.cls, 'aria-label': `${info.label}. Tocca per: ${STATUS_INFO[next].label.toLowerCase()} — ${rowName(r, sec)}`, onclick: (e) => { e.stopPropagation(); cycleRow(r); } },
    h('span', { 'aria-hidden': 'true' }, info.sym));
}

/* ================================================================ Altro: sottotitoli */
function magicSubtitle() {
  const o = Object.values(DB.mcards || {}).filter((c) => c.owned).length;
  return sheetsOf('magic').length ? `${o} carte possedute · spesa ${eur(buysTotal())}` : 'Nessun dato';
}
function legoSubtitle() {
  const s = sheetsOf('lego')[0]; if (!s) return 'Nessun dato';
  const rs = rowsOf(s.id); const b = rs.filter((r) => r.bought);
  return `${b.length} acquistati · ${rs.length - b.length} da comprare`;
}

/* ================================================================ Magic: home */
function viewMagic() {
  const shs = sheetsOf('magic');
  const ownedN = Object.values(DB.mcards || {}).filter((c) => c.owned).length;
  const recap = shs.find((s) => s.kind === 'purchases');
  const sub = (s) => {
    if (s.kind === 'purchases') return `${buys().length} acquisti · totale ${eur(buysTotal())}`;
    const rs = rowsOf(s.id);
    const cards = rs.filter((r) => isCardSec(secOf(r)) && r.type !== 'text');
    if (cards.length) return `${cards.length} carte · ${cards.filter((r) => rowStatus(r, secOf(r)).startsWith('own')).length} possedute`;
    const t = rs.filter((r) => r.type === 'text').length, v = rs.length - t;
    return [v ? `${v} voci` : '', t ? `${t} testi` : ''].filter(Boolean).join(' · ') || 'vuoto';
  };
  return {
    top: topBar('Magic', { back: 'altro', small: true }),
    body: [
      h('div', { class: 'panel summary' },
        h('div', { class: 'sum-grid' },
          h('div', null, h('b', null, String(ownedN)), h('span', null, 'carte possedute')),
          h('div', null, h('b', null, eur(buysTotal())), h('span', null, 'spesa totale'))),
        h('button', { class: 'btn primary block', style: 'margin-top:12px', onclick: () => go('acquisto/nuovo') }, icon('plus'), 'Registra acquisto (carta o lotto)')),
      h('div', { class: 'list' }, shs.map((s) => h('a', { class: 'card-link', href: '#/foglio/' + s.id },
        h('span', { class: 't' }, h('b', null, s.title), h('span', null, sub(s))), h('span', { class: 'chev' }, icon('chev'))))),
      recap ? null : h('p', { class: 'help' }, 'Recap acquisti non trovato.'),
    ],
  };
}

/* ================================================================ foglio generico */
const sheetUI = { q: {}, f: {} };
function viewSheet(route) {
  const s = DB.sheets[route.arg];
  const back = s ? s.module : 'altro';
  if (!s || s.deleted) return { top: topBar('Non trovato', { back, small: true }), body: [h('div', { class: 'empty' }, 'Questo tab non esiste più.')] };
  if (s.kind === 'purchases') return viewPurchases(s);
  if (s.kind === 'lego') return viewLego(s);
  const hasCards = (s.sections || []).some(isCardSec);
  const q = (sheetUI.q[s.id] || '').trim().toLowerCase();
  const f = sheetUI.f[s.id] || 'all';
  const match = (r, sec) => {
    if (q) {
      const hay = (r.type === 'text' ? r.title + ' ' + r.text : Object.values(r.cells || {}).join(' ') + ' ' + (r.notes || '') + ' ' + (r.decision || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f !== 'all' && isCardSec(sec) && r.type !== 'text') {
      const st = rowStatus(r, sec);
      if (f === 'need' && st !== 'need') return false;
      if (f === 'own' && !st.startsWith('own')) return false;
    }
    if (f !== 'all' && r.type === 'text') return false;
    return true;
  };
  const body = [];
  if (s.subtitle) body.push(h('p', { class: 'help', style: 'margin-top:0' }, s.subtitle));
  if (hasCards || rowsOf(s.id).length > 12) {
    body.push(h('input', { class: 'search', type: 'search', placeholder: 'Cerca in questo tab…', value: sheetUI.q[s.id] || '', 'aria-label': 'Cerca',
      oninput: (e) => { sheetUI.q[s.id] = e.target.value; clearTimeout(viewSheet.t); viewSheet.t = setTimeout(() => { render(true); const el = $('.search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); } }));
  }
  if (hasCards) body.push(segmented([['all', 'Tutte'], ['need', 'Da prendere'], ['own', 'Possedute']], f, (k) => { sheetUI.f[s.id] = k; render(); }));
  if (hasCards) body.push(h('p', { class: 'legend' }, 'Tocca il simbolo: vuoto = da prendere · ✓ posseduta · ✓* posseduta, non più necessaria · ○ non più necessaria'));

  for (const sec of s.sections || []) {
    const all = rowsOf(s.id, sec.id);
    const rows = all.filter((r) => match(r, sec));
    if (!rows.length && (q || f !== 'all')) continue;
    body.push(sectionHeader(s, sec, all));
    if (sec.type === 'text') body.push(h('div', { class: 'list' }, rows.map(textBlock)));
    else if (isCardSec(sec) && sec.catCol) {
      const groups = new Map();
      for (const r of rows) {
        const c = r.type === 'text' ? '' : ((r.cells || {})[sec.catCol] || 'Senza categoria');
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(r);
      }
      for (const [cat, rs] of groups) {
        if (cat) body.push(h('div', { class: 'cat-title' }, `${cat} · ${rs.length}`));
        body.push(h('div', { class: 'list' }, rs.map((r) => (r.type === 'text' ? textBlock(r) : sheetRow(r, sec)))));
      }
    } else body.push(h('div', { class: 'list' }, rows.map((r) => (r.type === 'text' ? textBlock(r) : sheetRow(r, sec)))));
    if (!q && f === 'all') body.push(h('div', { class: 'sec-actions' },
      sec.type !== 'text' ? h('button', { class: 'btn ghost', onclick: () => addRow(s, sec, 'row') }, icon('plus'), isCardSec(sec) ? 'Aggiungi carta' : 'Aggiungi voce') : null,
      h('button', { class: 'btn ghost', onclick: () => addRow(s, sec, 'text') }, icon('plus'), sec.type === 'text' ? 'Aggiungi testo' : 'Aggiungi commento')));
  }
  if (!(s.sections || []).length) body.push(h('div', { class: 'empty' }, 'Tab vuoto.'));
  body.push(h('div', { class: 'sec-actions', style: 'margin-top:24px' },
    h('button', { class: 'btn', onclick: () => { const t = prompt('Nome della nuova sezione'); if (!t || !t.trim()) return; const tipo = confirm('Sarà una lista di carte?\nOK = carte · Annulla = solo testo/commenti') ? 'cards' : 'text';
      const sec = { id: uid('x'), title: t.trim(), type: tipo, columns: tipo === 'cards' ? [{ k: 'en', l: 'Carta' }, { k: 'price', l: 'Prezzo €' }, { k: 'note', l: 'Note' }] : [], nameCol: 'en', priceCol: 'price' };
      touch('sheets', s.id, { sections: [...(s.sections || []), sec] }); } }, icon('plus'), 'Nuova sezione'),
    h('button', { class: 'btn', onclick: () => { const t = prompt('Nome del tab', s.title); if (t && t.trim()) touch('sheets', s.id, { title: t.trim() }); } }, icon('edit'), 'Rinomina tab')));
  return { top: topBar(s.title, { back, small: true }), body };
}

function sectionHeader(s, sec, rows) {
  const bits = [];
  const items = rows.filter((r) => r.type !== 'text');
  if (isCardSec(sec) && items.length) {
    const o = items.filter((r) => rowStatus(r, sec).startsWith('own')).length;
    bits.push(`✓ ${o}/${items.length}`);
  }
  if (sec.sumCol) {
    const tot = items.reduce((t, r) => t + (isNaN(num(r.cells[sec.sumCol])) ? 0 : num(r.cells[sec.sumCol])), 0);
    if (tot) bits.push(`totale ${eur(tot)}`);
    if (sec.type === 'cards') {
      const da = items.filter((r) => rowStatus(r, sec) === 'need').reduce((t, r) => t + (isNaN(num(r.cells[sec.sumCol])) ? 0 : num(r.cells[sec.sumCol])), 0);
      if (da) bits.push(`da comprare ${eur(da)}`);
    }
  }
  return h('div', { class: 'group-title sec-title' }, h('span', null, sec.title), bits.length ? h('span', { class: 'sec-sum' }, bits.join(' · ')) : null);
}

function sheetRow(r, sec) {
  const c = r.cells || {};
  const name = rowName(r, sec) || '(senza nome)';
  const meta = [];
  if (isCardSec(sec)) {
    if (c.it && c.it !== name) meta.push(h('span', { class: 'm it' }, c.it));
    if (c.cost && c.cost !== '-') meta.push(h('span', { class: 'm' }, c.cost));
    const pc = sec.priceCol && c[sec.priceCol];
    if (pc) meta.push(h('span', { class: 'm' }, cellPrice(pc)));
    if (r.decision) meta.push(h('span', { class: 'badge dec' }, r.decision));
    const bs = buysOf(ckey(name));
    if (bs.length && owned(ckey(name))) {
      const b = bs[0];
      meta.push(h('span', { class: 'm buy' }, b.cards.length > 1 ? `lotto «${b.title}» · ${cellPrice(b.price) || 'prezzo ?'} (${b.cards.length} carte)` : `acquistata ${b.price ? '· ' + cellPrice(b.price) : ''}`));
    }
  } else {
    const shown = (sec.columns || []).filter((col) => col.k !== (sec.nameCol || firstCol(sec)) && c[col.k]).slice(0, 3);
    for (const col of shown) meta.push(h('span', { class: 'm kv' }, h('i', null, col.l + ': '), String(c[col.k]).slice(0, 90) + (String(c[col.k]).length > 90 ? '…' : '')));
  }
  const noteTxt = r.notes || c.note || c.pnote;
  if (noteTxt) meta.push(h('span', { class: 'm', title: 'Note presenti' }, icon('note')));
  if (r.link) meta.push(h('span', { class: 'm', title: 'Link presente' }, icon('link')));
  const st = isCardSec(sec) ? rowStatus(r, sec) : '';
  return h('div', { class: 'row srow ' + (st ? 'row-' + st : ''), 'data-id': r.id },
    isCardSec(sec) ? statusBtn(r, sec) : h('span', { style: 'width:10px;flex:none' }),
    h('button', { class: 'row-main', onclick: () => go('riga/' + r.id) },
      h('span', { class: 'row-title' }, name),
      meta.length ? h('div', { class: 'meta' }, meta) : null));
}

function textBlock(r) {
  const long = (r.text || '').length > 420;
  return h('div', { class: 'panel txt-block' },
    h('div', { class: 'txt-head' }, h('b', null, r.title || ''), h('button', { class: 'icon-btn plain', 'aria-label': 'Modifica ' + (r.title || 'testo'), onclick: () => go('riga/' + r.id) }, icon('edit'))),
    r.text ? h('div', { class: 'notes-view' + (long && !editState.showDone[r.id] ? ' clamp' : '') }, linkify(r.text)) : null,
    long ? h('button', { class: 'btn ghost', onclick: () => { editState.showDone[r.id] = !editState.showDone[r.id]; render(); } }, editState.showDone[r.id] ? 'Mostra meno' : 'Mostra tutto') : null);
}

function addRow(s, sec, type) {
  const rs = rowsOf(s.id, sec.id);
  const order = rs.length ? rs[rs.length - 1].order + 1 : Math.max(0, ...rowsOf(s.id).map((r) => r.order)) + 10;
  const id = uid('r');
  DB.srows[id] = Object.assign({ id, sheet: s.id, section: sec.id, order, type, cells: {}, link: '', notes: '', decision: '', createdAt: now(), updatedAt: now() },
    type === 'text' ? { title: sec.type === 'text' ? '' : 'Commento', text: '' } : {},
    sec.type === 'lego' ? { bought: false, status: '', tags: [] } : {}, sec.type === 'cards' ? { needed: true } : {});
  persist({ render: false });
  go('riga/' + id);
}

/* ================================================================ dettaglio riga */
function fieldInput(label, value, onSave, opts = {}) {
  let t;
  const ta = h('textarea', { class: 'input auto', rows: 1, value: value || '', 'aria-label': label, placeholder: opts.ph || '',
    oninput: (e) => { autoGrow(e.target); clearTimeout(t); const v = e.target.value; t = setTimeout(() => onSave(v), 500); },
    onblur: (e) => { clearTimeout(t); if (e.target.value !== (value || '')) onSave(e.target.value); } });
  requestAnimationFrame(() => autoGrow(ta));
  return h('div', { class: 'field' }, h('label', null, label), ta);
}

function viewRow(route) {
  const r = DB.srows[route.arg];
  if (!r || r.deleted) return { top: topBar('Non trovato', { back: 'altro', small: true }), body: [h('div', { class: 'empty' }, 'Questa voce non esiste più.')] };
  const s = DB.sheets[r.sheet], sec = secOf(r);
  const id = r.id, back = 'foglio/' + r.sheet;
  const save = (patch) => updRow(id, patch, { render: false });
  const setCell = (k) => (v) => { const cells = Object.assign({}, DB.srows[id].cells, { [k]: v.trim() }); save({ cells }); };
  const body = [];

  if (r.type === 'text') {
    body.push(h('div', { class: 'detail' }, h('div', { class: 'panel' },
      fieldInput('Titolo', r.title, (v) => save({ title: v.trim() })),
      fieldInput('Testo', r.text, (v) => save({ text: v }), { ph: 'Scrivi qui…' }))));
  } else {
    const name = rowName(r, sec);
    const panels = [];
    if (isCardSec(sec)) {
      const key = ckey(name), st = rowStatus(r, sec);
      const opts = sec.type === 'owned' ? ['need', 'own'] : ['need', 'own', 'ownx', 'no'];
      const setStatus = (target) => {
        const o = owned(key), wantOwn = target.startsWith('own');
        if (wantOwn && !o && !markOwned(key, name)) return;
        if (!wantOwn && o && !unOwn(key, name)) return;
        if (sec.type === 'cards') DB.srows[id].needed = target === 'need' || target === 'own';
        DB.srows[id].updatedAt = now(); persist();
      };
      panels.push(h('div', { class: 'panel' },
        h('h2', null, 'Stato'),
        h('div', { class: 'toggles' }, opts.map((k) => h('button', { class: 'toggle t-st ' + STATUS_INFO[k].cls, 'aria-pressed': String(st === k), onclick: () => setStatus(k) },
          h('span', { class: 'sym', 'aria-hidden': 'true' }, STATUS_INFO[k].sym || '·'), STATUS_INFO[k].label))),
        h('p', { class: 'help', style: 'margin:8px 0 0' }, 'Il possesso vale per la stessa carta in tutti i tab; "non più necessaria" vale solo per questo tab.'),
        buyInfo(key, name)));
      if (sec.type === 'cards') panels.push(h('div', { class: 'panel' }, fieldInput('Decisione', r.decision, (v) => save({ decision: v.trim() }), { ph: 'es. da acquistare, per ora no…' })));
    }
    if (sec.type === 'lego') panels.push(legoPanel(r));
    panels.push(h('div', { class: 'panel props' }, (sec.columns || []).map((col) => fieldInput(col.l, (r.cells || {})[col.k], setCell(col.k)))));
    const url = safeUrl(r.link);
    panels.push(h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', null, isCardSec(sec) ? 'Link (fonte, es. pagina Cardmarket)' : 'Link'),
      h('div', { class: 'inline' },
        h('input', { class: 'input', type: 'url', value: r.link || '', placeholder: 'https://…', autocapitalize: 'off', onchange: (e) => updRow(id, { link: e.target.value.trim() }) }),
        url ? h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), 'Apri') : null))));
    panels.push(h('div', { class: 'panel' }, fieldInput('Note', r.notes, (v) => save({ notes: v }), { ph: 'Commenti, motivazioni, dettagli…' })));
    body.push(h('div', { class: 'detail' }, h('h1', { class: 'row-h1' }, name || 'Nuova voce'), panels));
  }
  body.push(h('div', { class: 'detail', style: 'margin-top:14px' },
    h('button', { class: 'btn danger block', onclick: () => {
      if (!confirm('Eliminare questa voce?')) return;
      const prev = JSON.parse(JSON.stringify(DB.srows[id]));
      updRow(id, { deleted: true }, { render: false });
      toast('Eliminata', 'Annulla', () => { DB.srows[id] = Object.assign(prev, { updatedAt: now() }); persist(); });
      goBack(back);
    } }, icon('trash'), 'Elimina'),
    h('div', { class: 'footer-meta' }, `${s ? s.title : ''} · ${sec.title || ''}`)));
  return { top: topBar(r.type === 'text' ? 'Testo' : (sec.type === 'lego' ? 'Set Lego' : isCardSec(sec) ? 'Carta' : 'Voce'), { back, small: true }), body };
}

function buyInfo(key, name) {
  const bs = buysOf(key);
  return h('div', { class: 'buyinfo' },
    bs.map((b) => h('a', { class: 'card-link small', href: '#/acquisto/' + b.id },
      h('span', { class: 't' }, h('b', null, b.title), h('span', null, [b.date ? fmtDate(b.date) : '', b.price ? cellPrice(b.price) : 'prezzo non indicato', b.cards.length > 1 ? `lotto di ${b.cards.length} carte` : 'carta singola'].filter(Boolean).join(' · '))),
      h('span', { class: 'chev' }, icon('chev')))),
    h('div', { class: 'inline', style: 'margin-top:8px' },
      h('button', { class: 'btn', onclick: () => go('acquisto/nuovo?c=' + encodeURIComponent(name)) }, icon('plus'), bs.length ? 'Nuovo acquisto con questa carta' : 'Registra acquisto')));
}

/* ================================================================ recap acquisti */
function viewPurchases(s) {
  const list = buys().sort((a, b) => (b.order || 0) - (a.order || 0));
  const inBuys = new Set(list.flatMap((b) => b.cards.map((c) => c.key)));
  const orphan = Object.values(DB.mcards || {}).filter((c) => c.owned && !inBuys.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const nCards = list.reduce((t, b) => t + b.cards.length, 0);
  return {
    top: topBar(s.title, { back: 'magic', small: true }),
    body: [
      h('div', { class: 'panel summary' },
        h('div', { class: 'sum-grid' },
          h('div', null, h('b', null, eur(buysTotal())), h('span', null, 'spesa complessiva')),
          h('div', null, h('b', null, String(list.length)), h('span', null, `acquisti · ${nCards} carte`))),
        h('button', { class: 'btn primary block', style: 'margin-top:12px', onclick: () => go('acquisto/nuovo') }, icon('plus'), 'Registra acquisto (carta o lotto)')),
      h('p', { class: 'help' }, 'Ogni acquisto può essere una carta singola o un lotto: le carte inserite risultano possedute in tutti i tab (B3, B4, Decklist…). Segnare una carta ✓ dal suo tab crea qui un acquisto singolo.'),
      h('div', { class: 'list' }, list.map((b) => h('a', { class: 'card-link buy-card', href: '#/acquisto/' + b.id },
        h('span', { class: 't' },
          h('b', null, b.title, h('span', { class: 'price' }, b.price ? cellPrice(b.price) : 'prezzo ?')),
          h('span', null, [b.date ? fmtDate(b.date) : '', `${b.cards.length} ${b.cards.length === 1 ? 'carta' : 'carte'}`].filter(Boolean).join(' · ')),
          h('span', { class: 'cards-line' }, b.cards.map((c) => c.name).join(', '))),
        h('span', { class: 'chev' }, icon('chev'))))),
      orphan.length ? [
        h('div', { class: 'group-title' }, `Possedute senza acquisto registrato · ${orphan.length}`),
        h('p', { class: 'help', style: 'margin-top:0' }, 'Carte già tue (dai colori o da "Già hai" nell\'Excel) senza un prezzo di acquisto. Tocca per registrarne uno.'),
        h('div', { class: 'chipwrap' }, orphan.map((c) => h('button', { class: 'chip small', onclick: () => go('acquisto/nuovo?c=' + encodeURIComponent(c.name)) }, c.name))),
      ] : null,
    ],
  };
}

function catalog() {
  const map = new Map();
  for (const c of Object.values(DB.mcards || {})) map.set(c.id, c.name);
  for (const r of Object.values(DB.srows || {})) {
    if (r.deleted || r.type === 'text') continue;
    const sec = secOf(r); if (!isCardSec(sec)) continue;
    const n = rowName(r, sec); if (!n) continue;
    const k = ckey(n); if (!map.has(k) || /^[a-z]/.test(map.get(k))) map.set(k, n);
  }
  return [...map.entries()].map(([key, name]) => ({ key, name })).filter((c) => c.key !== 'c:');
}

function viewPurchase(route) {
  const isNew = route.arg === 'nuovo';
  const src = isNew ? null : DB.mbuys[route.arg];
  if (!isNew && (!src || src.deleted)) return { top: topBar('Non trovato', { back: 'magic', small: true }), body: [h('div', { class: 'empty' }, 'Acquisto non trovato.')] };
  const recapId = (sheetsOf('magic').find((s) => s.kind === 'purchases') || {}).id;
  const back = recapId ? 'foglio/' + recapId : 'magic';
  const st = isNew ? { title: '', date: todayISO(), price: '', note: '', cards: [] } : JSON.parse(JSON.stringify(src));
  const pre = route.q.get('c');
  if (isNew && pre) { st.cards.push({ key: ckey(pre), name: pre }); st.title = pre; }
  const cat = catalog();
  const titleIn = h('input', { class: 'input', value: st.title, placeholder: 'es. Lotto Cardmarket ottobre', oninput: (e) => { st.title = e.target.value; } });
  const chips = h('div', { class: 'chipwrap' });
  const results = h('div', { class: 'results' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Cerca una carta da aggiungere…', 'aria-label': 'Cerca carta', oninput: () => drawResults(),
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = results.querySelector('button'); if (first) first.click(); } } });
  const total = h('span', { class: 'prog' });
  function drawChips() {
    chips.replaceChildren(...(st.cards.length ? st.cards.map((c) => h('span', { class: 'chip small sel' }, c.name,
      h('button', { class: 'x', 'aria-label': 'Togli ' + c.name, onclick: () => { st.cards = st.cards.filter((x) => x !== c); drawChips(); drawResults(); } }, '×'))) : [h('span', { class: 'help' }, 'Nessuna carta ancora.')]));
    total.textContent = `${st.cards.length} ${st.cards.length === 1 ? 'carta' : 'carte'}`;
  }
  function drawResults() {
    const q = search.value.trim().toLowerCase();
    if (!q) { results.replaceChildren(); return; }
    const chosen = new Set(st.cards.map((c) => c.key));
    const found = cat.filter((c) => c.name.toLowerCase().includes(q) && !chosen.has(c.key)).sort((a, b) => owned(a.key) - owned(b.key)).slice(0, 12);
    const add = (c) => { st.cards.push(c); if (!st.title && st.cards.length === 1) { st.title = c.name; titleIn.value = c.name; } search.value = ''; drawChips(); drawResults(); search.focus(); };
    const exact = cat.some((c) => c.name.toLowerCase() === q);
    results.replaceChildren(
      ...found.map((c) => h('button', { class: 'res', onclick: () => add(c) }, h('span', null, c.name), owned(c.key) ? h('span', { class: 'm' }, '✓ già posseduta') : null)),
      exact ? null : h('button', { class: 'res new', onclick: () => add({ key: ckey(search.value.trim()), name: search.value.trim() }) }, `+ Aggiungi «${search.value.trim()}» (carta non in elenco)`));
  }
  drawChips();
  const save = () => {
    if (!st.cards.length) { alert('Aggiungi almeno una carta.'); search.focus(); return; }
    const id = isNew ? uid('b') : src.id;
    const title = st.title.trim() || (st.cards.length === 1 ? st.cards[0].name : `Lotto di ${st.cards.length} carte`);
    DB.mbuys[id] = Object.assign(isNew ? { id, order: nextBuyOrder(), createdAt: now() } : DB.mbuys[id],
      { title, date: st.date, price: String(st.price).trim().replace(',', '.'), note: st.note, cards: st.cards, updatedAt: now() });
    for (const c of st.cards) setOwned(c.key, c.name, true);
    persist({ render: false });
    toast(isNew ? 'Acquisto registrato' : 'Acquisto aggiornato');
    goBack(back);
  };
  return {
    top: topBar(isNew ? 'Registra acquisto' : 'Acquisto', { back, small: true, noSync: true }),
    body: [h('div', { class: 'detail' },
      h('div', { class: 'panel props' },
        h('div', { class: 'field' }, h('label', null, 'Titolo'), titleIn),
        h('div', { class: 'inline' },
          h('div', { class: 'field', style: 'flex:1;min-width:140px' }, h('label', null, 'Data'), h('input', { class: 'input', type: 'date', value: st.date || '', onchange: (e) => { st.date = e.target.value; } })),
          h('div', { class: 'field', style: 'flex:1;min-width:140px' }, h('label', null, 'Prezzo totale €'), h('input', { class: 'input', inputmode: 'decimal', value: st.price || '', placeholder: 'es. 23,50', oninput: (e) => { st.price = e.target.value; } })))),
      h('div', { class: 'panel' },
        h('h2', null, h('span', { class: 'grow' }, 'Carte'), total),
        chips, h('div', { style: 'margin-top:10px' }, search), results,
        h('p', { class: 'help', style: 'margin:8px 0 0' }, 'Le carte aggiunte risultano possedute in tutti i tab. Togliere una carta da qui non cambia il suo possesso.')),
      h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', null, 'Note'),
        h('textarea', { class: 'input', value: st.note || '', placeholder: 'Venditore, condizioni, spedizione…', oninput: (e) => { st.note = e.target.value; autoGrow(e.target); } }))),
      h('div', { class: 'inline' }, h('button', { class: 'btn primary', onclick: save }, isNew ? 'Registra' : 'Salva'), h('button', { class: 'btn', onclick: () => goBack(back) }, 'Annulla')),
      isNew ? null : h('button', { class: 'btn danger block', onclick: () => {
        if (!confirm(`Eliminare l'acquisto «${src.title}»?`)) return;
        const alsoUnown = confirm('Segnare anche come NON possedute le sue carte (solo quelle che non sono in altri acquisti)?');
        DB.mbuys[src.id].deleted = true; DB.mbuys[src.id].updatedAt = now();
        if (alsoUnown) for (const c of src.cards) if (!buysOf(c.key).length) setOwned(c.key, c.name, false);
        persist({ render: false }); toast('Acquisto eliminato'); goBack(back);
      } }, icon('trash'), 'Elimina acquisto'))],
  };
}

/* ================================================================ Lego */
const LEGO_STATUS = ['', 'deve spedire', 'in attesa ricezione', 'attesa risposta offerta', 'ricevuto'];
const legoUI = { seg: 'all', tags: [], q: '' };
function viewLegoHome() {
  const s = sheetsOf('lego')[0];
  if (!s) return { top: topBar('Lego', { back: 'altro', small: true }), body: [h('div', { class: 'empty' }, 'Nessun dato Lego.')] };
  return viewLego(s);
}
function legoTags() {
  const s = sheetsOf('lego')[0]; const m = new Map();
  if (s) for (const r of rowsOf(s.id)) for (const t of r.tags || []) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}
function viewLego(s) {
  const sec = (s.sections || [])[0];
  const all = rowsOf(s.id).filter((r) => r.type !== 'text');
  const q = legoUI.q.trim().toLowerCase();
  const rows = all.filter((r) => (legoUI.seg === 'all' || (legoUI.seg === 'own') === !!r.bought)
    && (!legoUI.tags.length || legoUI.tags.some((t) => (r.tags || []).includes(t)))
    && (!q || (Object.values(r.cells || {}).join(' ') + ' ' + (r.tags || []).join(' ') + ' ' + (r.notes || '')).toLowerCase().includes(q)));
  const bought = all.filter((r) => r.bought);
  const spent = bought.reduce((t, r) => t + (isNaN(num(r.cells.total)) ? (isNaN(num(r.cells.price)) ? 0 : num(r.cells.price)) : num(r.cells.total)), 0);
  const toggleTag = (t) => { legoUI.tags = legoUI.tags.includes(t) ? legoUI.tags.filter((x) => x !== t) : [...legoUI.tags, t]; render(); };
  return {
    top: topBar('Lego', { back: 'altro', small: true }),
    body: [
      h('div', { class: 'panel summary' }, h('div', { class: 'sum-grid' },
        h('div', null, h('b', null, eur(spent)), h('span', null, `spesa · ${bought.length} set acquistati`)),
        h('div', null, h('b', null, String(all.length - bought.length)), h('span', null, 'set da comprare')))),
      h('input', { class: 'search', type: 'search', placeholder: 'Cerca set, codice, hashtag…', value: legoUI.q, 'aria-label': 'Cerca set',
        oninput: (e) => { legoUI.q = e.target.value; clearTimeout(viewLego.t); viewLego.t = setTimeout(() => { render(true); const el = $('.search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); } }),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra per hashtag' },
        h('button', { class: 'chip', 'aria-pressed': String(!legoUI.tags.length), onclick: () => { legoUI.tags = []; render(); } }, 'Tutti'),
        legoTags().map((t) => h('button', { class: 'chip', 'aria-pressed': String(legoUI.tags.includes(t)), onclick: () => toggleTag(t) }, '#' + t))),
      segmented([['all', 'Tutti'], ['own', 'Acquistati'], ['todo', 'Da comprare']], legoUI.seg, (k) => { legoUI.seg = k; render(); }),
      rows.length ? h('div', { class: 'list' }, rows.map((r) => legoRow(r, sec))) : h('div', { class: 'empty' }, 'Nessun set con questi filtri.'),
    ],
    fab: fab('Nuovo set Lego', () => addRow(s, sec, 'row')),
  };
}
function legoRow(r, sec) {
  const c = r.cells || {};
  const meta = [];
  if (c.code) meta.push(h('span', { class: 'm' }, c.code));
  if (r.bought) { const p = c.total || c.price; if (p) meta.push(h('span', { class: 'm' }, cellPrice(p))); }
  else {
    if (c.bl) meta.push(h('span', { class: 'm kv' }, h('i', null, 'BrickLink '), cellPrice(c.bl)));
    if (c.vinted) meta.push(h('span', { class: 'm kv' }, h('i', null, 'Vinted '), cellPrice(c.vinted)));
  }
  if (r.status) meta.push(h('span', { class: 'badge ' + (r.status === 'ricevuto' ? 'ok' : 'dec') }, r.status));
  for (const t of (r.tags || []).slice(0, 4)) meta.push(h('span', { class: 'tag' }, '#' + t));
  if (r.notes) meta.push(h('span', { class: 'm', title: 'Note presenti' }, icon('note')));
  return h('div', { class: 'row srow' + (r.bought ? ' row-own' : ''), 'data-id': r.id },
    h('button', { class: 'status-btn ' + (r.bought ? 'st-own' : 'st-need'), 'aria-label': (r.bought ? 'Acquistato. Tocca per togliere: ' : 'Da comprare. Tocca per segnare acquistato: ') + (c.set || ''),
      onclick: (e) => { e.stopPropagation(); toggleLego(r); } }, h('span', { 'aria-hidden': 'true' }, r.bought ? '✓' : '')),
    h('button', { class: 'row-main', onclick: () => go('riga/' + r.id) },
      h('span', { class: 'row-title' }, c.set || '(senza nome)'),
      meta.length ? h('div', { class: 'meta' }, meta) : null));
}
function toggleLego(r) {
  const c = Object.assign({}, r.cells);
  if (!r.bought && !c.total && !c.price) {
    const p = prompt(`Hai acquistato «${c.set}»?\nTotale pagato in € (vuoto se non lo ricordi).`, '');
    if (p === null) return;
    c.total = p.trim().replace(',', '.');
  }
  updRow(r.id, { bought: !r.bought, cells: c, status: !r.bought ? (r.status || 'deve spedire') : r.status });
  toast(r.bought ? 'Segnato come acquistato' : 'Tolto dagli acquistati');
}
function legoPanel(r) {
  const id = r.id;
  const tagsBox = h('div', { class: 'chipwrap' });
  const tagIn = h('input', { class: 'input', placeholder: 'Aggiungi hashtag (es. castle)', list: 'lego-tags', autocapitalize: 'off',
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } } });
  const addTag = () => {
    const t = tagIn.value.trim().replace(/^#/, ''); if (!t) return;
    const cur = DB.srows[id].tags || [];
    const existing = legoTags().find((x) => x.toLowerCase() === t.toLowerCase()) || t;
    if (!cur.includes(existing)) updRow(id, { tags: [...cur, existing] }, { render: false });
    tagIn.value = ''; draw();
  };
  const draw = () => tagsBox.replaceChildren(...(DB.srows[id].tags || []).map((t) => h('span', { class: 'chip small sel' }, '#' + t,
    h('button', { class: 'x', 'aria-label': 'Togli #' + t, onclick: () => { updRow(id, { tags: DB.srows[id].tags.filter((x) => x !== t) }, { render: false }); draw(); } }, '×'))));
  draw();
  return h('div', { class: 'panel props' },
    h('div', { class: 'toggles' }, h('button', { class: 'toggle t-done', 'aria-pressed': String(!!r.bought), onclick: () => toggleLego(DB.srows[id]) }, icon('check'), r.bought ? 'Acquistato' : 'Da comprare')),
    h('div', { class: 'field' }, h('label', null, 'Stato spedizione'),
      h('select', { class: 'input', onchange: (e) => updRow(id, { status: e.target.value }) }, LEGO_STATUS.map((x) => h('option', { value: x, selected: (r.status || '') === x }, x || '—')))),
    h('div', { class: 'field' }, h('label', null, 'Hashtag'), tagsBox, h('div', { class: 'add-entry' }, tagIn, h('button', { class: 'btn', onclick: addTag, 'aria-label': 'Aggiungi hashtag' }, icon('plus'))),
      h('datalist', { id: 'lego-tags' }, legoTags().map((t) => h('option', { value: t })))));
}
