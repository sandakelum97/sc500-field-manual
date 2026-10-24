/* SC-500 Field Manual — single-page study app. Data: data/objectives.json + data/bank.json. */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');
  const DATA = { obj: null, bank: null, objectives: [], byObj: new Map(), questions: [], qById: new Map(), cards: [], domains: [] };
  const UI = { view: 'dashboard', learnObj: null, practice: null, exam: null, cards: null };
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* blocked */ } } };

  // ---------- utils ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https:\/\//.test(u || '') ? esc(u) : '#';
  const link = (u, t) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener">${esc(t || 'Microsoft Learn')}</a>`;
  const hostLabel = u => { try { const p = new URL(u).pathname.split('/').filter(Boolean); return p.slice(-1)[0].replace(/[-_]/g, ' ') || 'Microsoft Learn'; } catch (e) { return 'Microsoft Learn'; } };
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const stripLetter = s => String(s).replace(/^\s*[A-H][.):]\s+/, '');
  const LETTERS = 'ABCDEFGH';
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }
  const domainOf = oid => DATA.byObj.get(oid)?.domain;
  const typeLabel = { single: 'Single answer', multi: 'Multiple answers', yesno: 'Yes / No', hotspot: 'Hotspot', order: 'Ordering' };

  // ---------- load ----------
  async function load() {
    const [o, b] = await Promise.all([fetch('data/objectives.json').then(r => r.json()), fetch('data/bank.json').then(r => r.json())]);
    DATA.obj = o; DATA.bank = b; DATA.domains = o.domains;
    o.domains.forEach((d, di) => d.sections.forEach((s, si) => s.objectives.forEach((ob, oi) => {
      const rec = Object.assign({}, ob, { domain: d.id, domainName: d.name, section: s.id, sectionName: s.name, code: `${di + 1}.${si + 1}.${oi + 1}`, content: null });
      DATA.objectives.push(rec); DATA.byObj.set(ob.id, rec);
    })));
    (b.sections || []).forEach(sec => (sec.objectives || []).forEach(c => {
      const rec = DATA.byObj.get(c.objectiveId); if (!rec) return;
      rec.content = c;
      (c.questions || []).forEach(q => { const qq = Object.assign({}, q, { objectiveId: c.objectiveId, domain: rec.domain }); DATA.questions.push(qq); DATA.qById.set(q.id, qq); });
      (c.flashcards || []).forEach((f, i) => DATA.cards.push(Object.assign({ id: `${c.objectiveId}-f${i + 1}`, objectiveId: c.objectiveId, domain: rec.domain }, f)));
    }));
    UI.learnObj = LS.get('sc500.learnObj', DATA.objectives[0].id);
  }

  // ---------- stats ----------
  function objStats(oid) {
    const qs = DATA.questions.filter(q => q.objectiveId === oid); let a = 0, c = 0, seen = 0;
    qs.forEach(q => { const r = Store.state.q[q.id]; if (r) { seen++; a++; if (r.last) c++; } });
    return { total: qs.length, seen, correct: c, acc: a ? c / a : null };
  }
  function domainStats(did) {
    const objs = DATA.objectives.filter(o => o.domain === did);
    const qs = DATA.questions.filter(q => q.domain === did); let seen = 0, c = 0;
    qs.forEach(q => { const r = Store.state.q[q.id]; if (r) { seen++; if (r.last) c++; } });
    const done = objs.filter(o => Store.state.obj[o.id]?.done).length;
    return { objs: objs.length, done, qs: qs.length, seen, correct: c };
  }
  const dueCards = (filter) => DATA.cards.filter(c => (!filter || c.domain === filter) && (!Store.state.cards[c.id] || Store.state.cards[c.id].due <= Date.now()));

  // ---------- router ----------
  const VIEWS = { dashboard: viewDashboard, learn: viewLearn, practice: viewPractice, exam: viewExam, cards: viewCards, review: viewReview, sync: viewSync };
  function route() {
    const h = (location.hash || '').replace('#', '');
    UI.view = VIEWS[h] ? h : 'dashboard';
    document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.view === UI.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    render();
  }
  function go(view) { if (location.hash === '#' + view) route(); else location.hash = view; }
  function render() { VIEWS[UI.view](); }

  // ---------- dashboard ----------
  function viewDashboard() {
    const s = Store.state; const answered = Object.keys(s.q).filter(k => DATA.qById.has(k));
    const correct = answered.filter(k => s.q[k].last).length;
    const done = DATA.objectives.filter(o => s.obj[o.id]?.done).length;
    const lastExam = s.exams[s.exams.length - 1];
    const weak = DATA.objectives.map(o => ({ o, st: objStats(o.id), conf: s.obj[o.id]?.conf || 0 }))
      .filter(x => x.st.total && ((x.st.acc != null && x.st.acc < 0.7) || (x.st.seen === 0 && x.conf < 2)))
      .sort((a, b) => (a.st.acc ?? 0.5) - (b.st.acc ?? 0.5) || a.conf - b.conf).slice(0, 6);
    app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">${esc(DATA.obj.certification)}</span>
        <h1>Exam SC-500: ${esc(DATA.obj.title)}</h1>
        <p class="lede">${DATA.objectives.length} objectives from the official study guide, ${DATA.questions.length} practice items in the real exam formats (single, multiple, yes/no, hotspot, ordering) and ${DATA.cards.length} flashcards. Each answer links to the Microsoft Learn page that proves it. Passing score is ${DATA.obj.passScore} on Microsoft's scaled score, which is not a percentage.</p>
        <div class="row">
          <button class="primary" data-go="learn">Continue learning</button>
          <button data-go="practice">Practice questions</button>
          <button data-go="exam">Take a mock exam</button>
          <a class="btn" href="${safeUrl(DATA.obj.studyGuide)}" target="_blank" rel="noopener">Official study guide</a>
        </div>
      </section>
      <section class="panel raised">
        <div class="kpis">
          <div class="kpi"><div class="v num">${done}/${DATA.objectives.length}</div><div class="k">Objectives marked done</div></div>
          <div class="kpi"><div class="v num">${answered.length}/${DATA.questions.length}</div><div class="k">Practice items attempted</div></div>
          <div class="kpi"><div class="v num">${answered.length ? pct(correct, answered.length) + '%' : '–'}</div><div class="k">Correct on last attempt</div></div>
          <div class="kpi"><div class="v num">${dueCards().length}</div><div class="k">Flashcards due</div></div>
          <div class="kpi"><div class="v num">${lastExam ? pct(lastExam.correct, lastExam.total) + '%' : '–'}</div><div class="k">Last mock exam</div></div>
        </div>
      </section>
      <section class="stack">
        <h2>Domains</h2>
        <div class="grid4">${DATA.domains.map((d, i) => { const st = domainStats(d.id); return `
          <article class="panel domain-card ${d.id}">
            <span class="chip ${d.id}"><span class="dot"></span>Domain ${i + 1} · ${esc(d.weight)}</span>
            <h3>${esc(d.name)}</h3>
            <div class="meter ${d.id}" title="Objectives done"><span style="width:${pct(st.done, st.objs)}%"></span></div>
            <div class="stats"><span>Objectives done</span><b>${st.done}/${st.objs}</b><span>Items attempted</span><b>${st.seen}/${st.qs}</b><span>Correct</span><b>${st.seen ? pct(st.correct, st.seen) + '%' : '–'}</b></div>
            <div class="row"><button data-learn-domain="${d.id}">Study</button><button data-practice-domain="${d.id}">Practice</button></div>
          </article>`; }).join('')}</div>
      </section>
      <section class="grid2">
        <div class="panel stack">
          <h3>Focus next</h3>
          ${weak.length ? `<ul class="weak-list">${weak.map(x => `<li><span><span class="chip ${x.o.domain}">${x.o.code}</span> ${esc(x.o.text)}<br><span class="note">${x.st.acc != null ? pct(x.st.acc * x.st.seen, x.st.seen) + '% correct' : 'Not practised yet'}</span></span><button data-open-obj="${x.o.id}">Open</button></li>`).join('')}</ul>` : '<p class="note">Answer a few questions and rate your confidence on objectives; the weakest ones will show here.</p>'}
        </div>
        <div class="panel stack">
          <h3>Before you book</h3>
          <ul class="links">
            <li>${link(DATA.obj.certPage, 'Certification page and learning paths')}</li>
            <li>${link(DATA.obj.sandbox, 'Exam sandbox (try the item types)')}</li>
            <li>${link('https://learn.microsoft.com/en-us/credentials/certifications/exam-scoring-reports', 'How exam scoring works')}</li>
            <li>${link('https://learn.microsoft.com/en-us/credentials/support/exam-and-assessment-lab-security-policies', 'Exam security policy (brain dumps are banned)')}</li>
          </ul>
          <p class="note">Objectives retrieved ${esc(DATA.obj.retrieved)}. Content bank built ${esc((DATA.bank.generated || '').slice(0, 10))}.</p>
        </div>
      </section>`;
    bindCommon();
  }

  function bindCommon() {
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    app.querySelectorAll('[data-open-obj]').forEach(b => b.onclick = () => { UI.learnObj = b.dataset.openObj; LS.set('sc500.learnObj', UI.learnObj); go('learn'); });
    app.querySelectorAll('[data-learn-domain]').forEach(b => b.onclick = () => { const o = DATA.objectives.find(x => x.domain === b.dataset.learnDomain); UI.learnObj = o.id; LS.set('sc500.learnObj', o.id); go('learn'); });
    app.querySelectorAll('[data-practice-domain]').forEach(b => b.onclick = () => { UI.practice = null; UI.practiceFilter = { domain: b.dataset.practiceDomain, objective: '', mode: 'all', count: 15 }; go('practice'); });
    app.querySelectorAll('[data-practice-obj]').forEach(b => b.onclick = () => { const o = DATA.byObj.get(b.dataset.practiceObj); UI.practice = null; UI.practiceFilter = { domain: o.domain, objective: o.id, mode: 'all', count: 50 }; startPractice(); go('practice'); });
  }

  // ---------- learn ----------
  function viewLearn() {
    const cur = DATA.byObj.get(UI.learnObj) || DATA.objectives[0];
    const s = Store.state;
    const tree = DATA.domains.map((d, di) => `
      <div><h4><span class="chip ${d.id}">D${di + 1}</span> ${esc(d.name)}</h4>
      ${d.sections.map(sec => `<div class="sec">${esc(sec.name)}</div>${sec.objectives.map(o => { const r = DATA.byObj.get(o.id); const st = s.obj[o.id]; const cls = st?.done ? 'done' : (st?.conf ? 'part' : ''); return `<button data-obj="${o.id}" aria-current="${o.id === cur.id}"><span class="tick ${cls}"></span><span><span class="mono note">${r.code}</span> ${esc(o.text)}</span></button>`; }).join('')}`).join('')}</div>`).join('');
    const c = cur.content; const st = s.obj[cur.id] || {}; const os = objStats(cur.id);
    const idx = DATA.objectives.indexOf(cur);
    const body = c ? `
      <p>${esc(c.summary)}</p>
      ${c.keyFacts?.length ? `<div class="stack"><h3>Key facts</h3><ul class="facts">${c.keyFacts.map(k => `<li>${esc(k.fact)}${k.source ? link(k.source, 'source') : ''}</li>`).join('')}</ul></div>` : ''}
      ${c.portalPath ? `<div class="stack"><h3>Where it lives</h3><div class="path">${esc(c.portalPath)}</div></div>` : ''}
      ${c.lab ? `<div class="stack lab panel"><span class="eyebrow">Hands-on lab</span><h3>${esc(c.lab.title)}</h3><ol>${(c.lab.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>${c.lab.verify ? `<p><b>Check:</b> ${esc(c.lab.verify)}</p>` : ''}${c.lab.source ? `<p class="note">Based on ${link(c.lab.source, hostLabel(c.lab.source))}</p>` : ''}<p class="note">Use a trial or sandbox subscription, never production.</p></div>` : ''}
      ${c.learnModules?.length ? `<div class="stack"><h3>Microsoft Learn</h3><ul class="links">${c.learnModules.map(m => `<li>${link(m.url, m.title)}</li>`).join('')}</ul></div>` : ''}`
      : '<div class="empty">Content for this objective is not in the bank yet. Use the official study guide link for now.</div>';
    app.innerHTML = `
      <div class="learn">
        <nav class="tree panel" aria-label="Objectives">${tree}</nav>
        <article class="stack">
          <div class="obj-head">
            <div class="row"><span class="chip ${cur.domain}"><span class="dot"></span>${cur.code}</span><span class="note">${esc(cur.sectionName)}</span></div>
            <h2>${esc(cur.text)}</h2>
          </div>
          ${body}
          <div class="panel stack">
            <div class="row between"><h3>Your status</h3><span class="note num">${os.seen}/${os.total} items tried${os.acc != null ? ` · ${pct(os.correct, os.seen)}% correct` : ''}</span></div>
            <div class="conf" role="group" aria-label="Confidence">
              ${['Not yet', 'Shaky', 'Confident'].map((l, i) => `<button data-conf="${i + 1}" aria-pressed="${st.conf === i + 1}">${l}</button>`).join('')}
            </div>
            <label class="row"><input type="checkbox" id="objDone" ${st.done ? 'checked' : ''}> Mark objective as done</label>
            <div class="row">${os.total ? `<button class="primary" data-practice-obj="${cur.id}">Practice ${os.total} item${os.total > 1 ? 's' : ''}</button>` : ''}
              <button id="prevObj" ${idx === 0 ? 'disabled' : ''}>Previous</button><button id="nextObj" ${idx === DATA.objectives.length - 1 ? 'disabled' : ''}>Next objective</button></div>
          </div>
        </article>
      </div>`;
    app.querySelectorAll('[data-obj]').forEach(b => b.onclick = () => { UI.learnObj = b.dataset.obj; LS.set('sc500.learnObj', UI.learnObj); viewLearn(); window.scrollTo({ top: 0 }); });
    app.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => Store.setObjective(cur.id, { conf: +b.dataset.conf }));
    $('#objDone').onchange = e => Store.setObjective(cur.id, { done: e.target.checked });
    $('#prevObj').onclick = () => { UI.learnObj = DATA.objectives[idx - 1].id; LS.set('sc500.learnObj', UI.learnObj); viewLearn(); window.scrollTo({ top: 0 }); };
    $('#nextObj').onclick = () => { UI.learnObj = DATA.objectives[idx + 1].id; LS.set('sc500.learnObj', UI.learnObj); viewLearn(); window.scrollTo({ top: 0 }); };
    const t = app.querySelector('.tree button[aria-current="true"]'); if (t) t.scrollIntoView({ block: 'nearest' });
    bindCommon();
  }

  // ---------- question item ----------
  function initialResponse(q) {
    if (q.type === 'single' || q.type === 'multi') return [];
    if (q.type === 'yesno') return q.statements.map(() => null);
    if (q.type === 'hotspot') return q.dropdowns.map(() => null);
    if (q.type === 'order') { let p = shuffle(q.items.map((_, i) => i)); if (p.every((v, i) => v === i)) p = p.reverse(); return p; }
    return [];
  }
  function isAnswered(q, r) {
    if (q.type === 'single' || q.type === 'multi') return r.length > 0;
    if (q.type === 'yesno' || q.type === 'hotspot') return r.every(v => v !== null);
    return true;
  }
  function grade(q, r) {
    if (q.type === 'single' || q.type === 'multi') { const a = new Set(q.answer); return r.length === a.size && r.every(i => a.has(i)); }
    if (q.type === 'yesno') return q.statements.every((s, i) => r[i] === s.answer);
    if (q.type === 'hotspot') return q.dropdowns.every((d, i) => r[i] === d.answer);
    if (q.type === 'order') return r.every((v, i) => v === i);
    return false;
  }
  // Renders an item into el. opts: { response, revealed, onChange }
  function renderItem(el, q, opts) {
    const r = opts.response; const rev = !!opts.revealed; const o = DATA.byObj.get(q.objectiveId);
    let inner = '';
    if (q.type === 'single' || q.type === 'multi') {
      const multi = q.type === 'multi'; const ans = new Set(q.answer);
      inner = `<div class="opts" role="${multi ? 'group' : 'radiogroup'}">${q.options.map((op, i) => {
        const chosen = r.includes(i); let cls = ''; if (rev) { if (ans.has(i)) cls = 'right'; else if (chosen) cls = 'wrong'; }
        return `<label class="opt ${cls}"><input type="${multi ? 'checkbox' : 'radio'}" name="opt-${esc(q.id)}" value="${i}" ${chosen ? 'checked' : ''} ${rev ? 'disabled' : ''}><span><span class="letter">${LETTERS[i]}</span>${esc(stripLetter(op))}</span></label>`; }).join('')}</div>`;
    } else if (q.type === 'yesno') {
      inner = `<div class="tbl"><table class="yn"><thead><tr><th>Statement</th><th class="c">Yes</th><th class="c">No</th></tr></thead><tbody>${q.statements.map((s, i) => {
        const cls = rev ? (r[i] === s.answer ? 'right' : 'wrong') : '';
        return `<tr class="${cls}"><td>${esc(s.text)}${rev ? `<br><span class="note">Correct: ${s.answer ? 'Yes' : 'No'}</span>` : ''}</td>${[true, false].map(v => `<td class="c"><input type="radio" aria-label="${v ? 'Yes' : 'No'}" name="yn-${esc(q.id)}-${i}" data-i="${i}" value="${v}" ${r[i] === v ? 'checked' : ''} ${rev ? 'disabled' : ''}></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    } else if (q.type === 'hotspot') {
      inner = `<div class="hot"><span class="eyebrow">Answer area</span>${q.dropdowns.map((d, i) => {
        const cls = rev ? (r[i] === d.answer ? 'right' : 'wrong') : '';
        return `<div class="hrow"><label for="hs-${esc(q.id)}-${i}">${esc(d.label)}</label><div><select id="hs-${esc(q.id)}-${i}" data-i="${i}" class="${cls}" ${rev ? 'disabled' : ''}><option value="">Select…</option>${d.options.map((op, j) => `<option value="${j}" ${r[i] === j ? 'selected' : ''}>${esc(op)}</option>`).join('')}</select>${rev && r[i] !== d.answer ? `<div class="note">Correct: ${esc(d.options[d.answer])}</div>` : ''}</div></div>`; }).join('')}</div>`;
    } else if (q.type === 'order') {
      inner = `<p class="note">Arrange the steps in the order you would perform them.</p><ol class="order">${r.map((orig, pos) => {
        const cls = rev ? (orig === pos ? 'right' : 'wrong') : '';
        return `<li class="${cls}"><span>${esc(q.items[orig])}${rev && orig !== pos ? `<br><span class="note">Belongs at step ${orig + 1}</span>` : ''}</span>${rev ? '<span></span>' : `<span class="mv"><button type="button" data-up="${pos}" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>↑</button><button type="button" data-down="${pos}" aria-label="Move down" ${pos === r.length - 1 ? 'disabled' : ''}>↓</button></span>`}</li>`; }).join('')}</ol>`;
    }
    const ok = rev ? grade(q, r) : null;
    const verdict = rev ? `<div class="verdict ${ok ? 'ok' : 'no'}"><b>${ok ? 'Correct' : 'Not quite'}</b>${(q.type === 'single' || q.type === 'multi') && !ok ? `<span class="correct-key">Answer: ${q.answer.map(i => LETTERS[i]).join(', ')}</span>` : ''}<p>${esc(q.explanation)}</p><div class="src">Source: ${(q.sources || []).map(s => link(s.url, s.title)).join(' · ')}</div></div>` : '';
    el.innerHTML = `<div class="item">
      <div class="meta"><span class="chip ${o.domain}"><span class="dot"></span>${o.code}</span><span class="chip">${typeLabel[q.type] || q.type}</span><span class="note">${esc(o.text)}</span></div>
      ${q.scenario ? `<div class="scenario">${esc(q.scenario)}</div>` : ''}
      <p class="q-text">${esc(q.question)}</p>
      ${inner}${verdict}</div>`;
    if (rev) return;
    const change = () => opts.onChange && opts.onChange(r);
    el.querySelectorAll('.opts input').forEach(inp => inp.onchange = () => {
      const i = +inp.value;
      if (q.type === 'single') { r.length = 0; r.push(i); } else { const k = r.indexOf(i); if (inp.checked && k < 0) r.push(i); if (!inp.checked && k >= 0) r.splice(k, 1); }
      change();
    });
    el.querySelectorAll('.yn input').forEach(inp => inp.onchange = () => { r[+inp.dataset.i] = inp.value === 'true'; change(); });
    el.querySelectorAll('.hot select').forEach(s => s.onchange = () => { r[+s.dataset.i] = s.value === '' ? null : +s.value; change(); });
    el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const p = +b.dataset.up; [r[p - 1], r[p]] = [r[p], r[p - 1]]; renderItem(el, q, opts); change(); el.querySelector(`[data-up="${p - 1}"]`)?.focus(); });
    el.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { const p = +b.dataset.down; [r[p + 1], r[p]] = [r[p], r[p + 1]]; renderItem(el, q, opts); change(); el.querySelector(`[data-down="${p + 1}"]`)?.focus(); });
  }

  // ---------- practice ----------
  function practicePool(f) {
    const s = Store.state;
    return DATA.questions.filter(q => (!f.domain || q.domain === f.domain) && (!f.objective || q.objectiveId === f.objective) && (
      f.mode === 'all' ? true : f.mode === 'new' ? !s.q[q.id] : f.mode === 'missed' ? (s.q[q.id] && !s.q[q.id].last) : f.mode === 'flagged' ? !!s.flags[q.id] : true));
  }
  function startPractice(ids) {
    const f = UI.practiceFilter || { domain: '', objective: '', mode: 'all', count: 15 };
    const list = ids ? ids.map(id => DATA.qById.get(id)).filter(Boolean) : shuffle(practicePool(f)).slice(0, f.count || 15);
    UI.practice = { list, i: 0, resp: list.map(initialResponse), revealed: list.map(() => false), results: list.map(() => null) };
  }
  function viewPractice() {
    const f = UI.practiceFilter || (UI.practiceFilter = { domain: '', objective: '', mode: 'all', count: 15 });
    const P = UI.practice;
    const objOpts = DATA.objectives.filter(o => !f.domain || o.domain === f.domain);
    const setup = `
      <section class="stack">
        <div><span class="eyebrow">Practice</span><h2>Instant-feedback practice</h2></div>
        <p class="lede">Answer, check, read why. Every explanation says why the wrong options are wrong and links the Learn page.</p>
        <div class="panel toolbar">
          <label class="field">Domain<select id="pfDomain"><option value="">All domains</option>${DATA.domains.map((d, i) => `<option value="${d.id}" ${f.domain === d.id ? 'selected' : ''}>D${i + 1} · ${esc(d.name)}</option>`).join('')}</select></label>
          <label class="field">Objective<select id="pfObj" style="max-width:320px"><option value="">All objectives</option>${objOpts.map(o => `<option value="${o.id}" ${f.objective === o.id ? 'selected' : ''}>${o.code} ${esc(o.text)}</option>`).join('')}</select></label>
          <label class="field">Show<select id="pfMode">${[['all', 'All items'], ['new', 'Not attempted'], ['missed', 'Last answer wrong'], ['flagged', 'Flagged']].map(([v, l]) => `<option value="${v}" ${f.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">How many<input type="number" id="pfCount" min="1" max="300" value="${f.count}" style="width:90px"></label>
          <button class="primary" id="pfStart">Start <span class="note" id="pfAvail"></span></button>
        </div>
      </section>`;
    if (!P || !P.list.length) {
      app.innerHTML = setup + (P && !P.list.length ? '<div class="empty">No items match these filters.</div>' : '');
      bindPracticeSetup(); return;
    }
    if (P.i >= P.list.length) { // summary
      const ok = P.results.filter(Boolean).length;
      app.innerHTML = setup + `<section class="panel stack"><h2>Session done: ${ok}/${P.list.length} correct (${pct(ok, P.list.length)}%)</h2>
        <ul class="weak-list">${P.list.map((q, i) => `<li><span><span class="chip ${P.results[i] ? 'good' : 'bad'}">${P.results[i] ? 'Right' : 'Wrong'}</span> ${esc(q.question.slice(0, 120))}${q.question.length > 120 ? '…' : ''}</span><button data-open-obj="${q.objectiveId}">Study</button></li>`).join('')}</ul>
        <div class="row"><button class="primary" id="retryWrong" ${ok === P.list.length ? 'disabled' : ''}>Retry the ones I missed</button><button id="newSet">New set</button></div></section>`;
      bindPracticeSetup(); bindCommon();
      $('#retryWrong').onclick = () => { startPractice(P.list.filter((_, i) => !P.results[i]).map(q => q.id)); viewPractice(); };
      $('#newSet').onclick = () => { startPractice(); viewPractice(); };
      return;
    }
    const q = P.list[P.i];
    app.innerHTML = setup + `
      <section class="panel raised stack">
        <div class="progressline"><span class="num">Item ${P.i + 1} of ${P.list.length}</span><div class="meter"><span style="width:${pct(P.i, P.list.length)}%"></span></div><span class="num">${P.results.filter(Boolean).length} right</span></div>
        <div id="itemHost"></div>
        <div class="row between">
          <button class="ghost" id="flagBtn">${Store.state.flags[q.id] ? 'Unflag' : 'Flag for review'}</button>
          <div class="row"><button id="skipBtn">${P.revealed[P.i] ? '' : 'Skip'}</button><button class="primary" id="checkBtn"></button></div>
        </div>
      </section>`;
    bindPracticeSetup();
    const host = $('#itemHost'); const btn = $('#checkBtn'); const skip = $('#skipBtn');
    const paint = () => { renderItem(host, q, { response: P.resp[P.i], revealed: P.revealed[P.i], onChange: upd }); upd(); };
    const upd = () => { if (P.revealed[P.i]) { btn.textContent = P.i === P.list.length - 1 ? 'Finish' : 'Next item'; btn.disabled = false; skip.hidden = true; } else { btn.textContent = 'Check answer'; btn.disabled = !isAnswered(q, P.resp[P.i]); } };
    btn.onclick = () => {
      if (!P.revealed[P.i]) { P.revealed[P.i] = true; const ok = grade(q, P.resp[P.i]); P.results[P.i] = ok; Store.recordAnswer(q.id, ok); paint(); btn.focus(); }
      else { P.i++; viewPractice(); window.scrollTo({ top: 0 }); }
    };
    skip.onclick = () => { P.list.push(P.list.splice(P.i, 1)[0]); P.resp.push(P.resp.splice(P.i, 1)[0]); P.revealed.push(P.revealed.splice(P.i, 1)[0]); P.results.push(P.results.splice(P.i, 1)[0]); viewPractice(); };
    $('#flagBtn').onclick = e => { Store.toggleFlag(q.id); e.target.textContent = Store.state.flags[q.id] ? 'Unflag' : 'Flag for review'; };
    paint();
  }
  function bindPracticeSetup() {
    const f = UI.practiceFilter;
    const avail = () => { const n = practicePool(f).length; const el = $('#pfAvail'); if (el) el.textContent = `(${Math.min(n, f.count)} of ${n})`; };
    $('#pfDomain').onchange = e => { f.domain = e.target.value; f.objective = ''; UI.practice = null; viewPractice(); };
    $('#pfObj').onchange = e => { f.objective = e.target.value; avail(); };
    $('#pfMode').onchange = e => { f.mode = e.target.value; avail(); };
    $('#pfCount').oninput = e => { f.count = Math.max(1, Math.min(300, +e.target.value || 1)); avail(); };
    $('#pfStart').onclick = () => { startPractice(); viewPractice(); };
    avail();
  }

  // ---------- mock exam ----------
  const EXAM_KEY = 'sc500.exam.active';
  function buildExam(n, mins) {
    const w = { d1: 22.5, d2: 27.5, d3: 22.5, d4: 22.5 }; const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let picked = [];
    DATA.domains.forEach(d => { const pool = shuffle(DATA.questions.filter(q => q.domain === d.id)); picked.push(...pool.slice(0, Math.round(n * w[d.id] / tot))); });
    if (picked.length < n) { const rest = shuffle(DATA.questions.filter(q => !picked.includes(q))); picked.push(...rest.slice(0, n - picked.length)); }
    picked = shuffle(picked.slice(0, n));
    return { ids: picked.map(q => q.id), resp: picked.map(initialResponse), flags: picked.map(() => false), i: 0, ends: Date.now() + mins * 60000, mins, done: false };
  }
  function viewExam() {
    if (!UI.exam) UI.exam = LS.get(EXAM_KEY, null);
    const E = UI.exam;
    if (!E) {
      const hist = Store.state.exams.slice(-5).reverse();
      app.innerHTML = `<section class="stack">
        <div><span class="eyebrow">Mock exam</span><h2>Timed, weighted by domain</h2></div>
        <p class="lede">Questions are drawn in proportion to the published domain weights. No feedback until you submit. Microsoft doesn't publish a fixed SC-500 question count or time here; the defaults below are practice settings, not official numbers.</p>
        <div class="panel toolbar">
          <label class="field">Questions<input type="number" id="exN" min="10" max="${DATA.questions.length}" value="${Math.min(50, DATA.questions.length)}" style="width:100px"></label>
          <label class="field">Minutes<input type="number" id="exM" min="10" max="240" value="100" style="width:100px"></label>
          <button class="primary" id="exStart">Start exam</button>
        </div>
        ${hist.length ? `<div class="panel stack"><h3>Recent attempts</h3><div class="tbl"><table class="result-table"><thead><tr><th>Date</th>${DATA.domains.map((d, i) => `<th>D${i + 1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${hist.map(h => `<tr><td>${new Date(h.t).toLocaleString()}</td>${DATA.domains.map(d => { const v = h.byDomain?.[d.id] || [0, 0]; return `<td class="n">${v[1] ? pct(v[0], v[1]) + '%' : '–'}</td>`; }).join('')}<td class="n"><b>${pct(h.correct, h.total)}%</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      </section>`;
      $('#exStart').onclick = () => { UI.exam = buildExam(+$('#exN').value || 50, +$('#exM').value || 100); LS.set(EXAM_KEY, UI.exam); viewExam(); };
      return;
    }
    if (E.done) return examResults();
    const q = DATA.qById.get(E.ids[E.i]);
    if (!q) { LS.del(EXAM_KEY); UI.exam = null; return viewExam(); }
    app.innerHTML = `<section class="stack">
      <div class="panel row between"><span class="num">Question ${E.i + 1} of ${E.ids.length}</span><span class="timer" id="timer"></span></div>
      <div class="panel navgrid" aria-label="Question navigator">${E.ids.map((id, i) => `<button data-nav="${i}" class="${isAnswered(DATA.qById.get(id), E.resp[i]) ? 'ans' : ''} ${E.flags[i] ? 'flag' : ''} ${i === E.i ? 'cur' : ''}" aria-label="Question ${i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="panel raised" id="itemHost"></div>
      <div class="row between">
        <label class="row"><input type="checkbox" id="exFlag" ${E.flags[E.i] ? 'checked' : ''}> Mark for review</label>
        <div class="row"><button id="exPrev" ${E.i === 0 ? 'disabled' : ''}>Previous</button><button id="exNext" ${E.i === E.ids.length - 1 ? 'disabled' : ''}>Next</button><button class="primary" id="exEnd">Submit exam</button></div>
      </div>
      <div class="panel stack" id="exConfirm" hidden><p id="exConfirmText"></p><div class="row"><button class="primary" id="exYes">Submit and score</button><button id="exNo">Keep working</button></div></div>
      <button class="ghost" id="exAbandon">Abandon this attempt</button>
    </section>`;
    renderItem($('#itemHost'), q, { response: E.resp[E.i], revealed: false, onChange: () => { LS.set(EXAM_KEY, E); const b = app.querySelector(`[data-nav="${E.i}"]`); if (b) b.classList.toggle('ans', isAnswered(q, E.resp[E.i])); } });
    const nav = i => { E.i = i; LS.set(EXAM_KEY, E); viewExam(); window.scrollTo({ top: 0 }); };
    app.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => nav(+b.dataset.nav));
    $('#exPrev').onclick = () => nav(E.i - 1); $('#exNext').onclick = () => nav(E.i + 1);
    $('#exFlag').onchange = e => { E.flags[E.i] = e.target.checked; LS.set(EXAM_KEY, E); app.querySelector(`[data-nav="${E.i}"]`).classList.toggle('flag', e.target.checked); };
    $('#exEnd').onclick = () => { const un = E.ids.filter((id, i) => !isAnswered(DATA.qById.get(id), E.resp[i])).length; const fl = E.flags.filter(Boolean).length; $('#exConfirmText').textContent = `${un} unanswered, ${fl} marked for review. Submit now?`; $('#exConfirm').hidden = false; $('#exYes').focus(); };
    $('#exNo').onclick = () => { $('#exConfirm').hidden = true; };
    $('#exYes').onclick = submitExam;
    $('#exAbandon').onclick = () => { LS.del(EXAM_KEY); UI.exam = null; clearInterval(UI.timer); viewExam(); toast('Attempt discarded'); };
    tickTimer();
  }
  function tickTimer() {
    clearInterval(UI.timer);
    const step = () => { const el = $('#timer'); const E = UI.exam; if (!el || !E || E.done) { clearInterval(UI.timer); return; } const ms = E.ends - Date.now(); if (ms <= 0) { clearInterval(UI.timer); toast('Time is up'); submitExam(); return; } const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); el.textContent = `${m}:${String(s).padStart(2, '0')} left`; el.classList.toggle('low', ms < 5 * 60000); };
    step(); UI.timer = setInterval(step, 1000);
  }
  function submitExam() {
    const E = UI.exam; if (!E || E.done) return; clearInterval(UI.timer);
    E.done = true; E.results = E.ids.map((id, i) => grade(DATA.qById.get(id), E.resp[i]));
    const byDomain = {}; E.ids.forEach((id, i) => { const d = DATA.qById.get(id).domain; byDomain[d] = byDomain[d] || [0, 0]; byDomain[d][1]++; if (E.results[i]) byDomain[d][0]++; Store.recordAnswer(id, E.results[i]); });
    Store.addExam({ total: E.ids.length, correct: E.results.filter(Boolean).length, byDomain, mins: Math.round((Date.now() - (E.ends - E.mins * 60000)) / 60000) });
    LS.set(EXAM_KEY, E); E.review = null; viewExam(); window.scrollTo({ top: 0 });
  }
  function examResults() {
    const E = UI.exam; const ok = E.results.filter(Boolean).length; const p = pct(ok, E.ids.length);
    const byD = DATA.domains.map((d, i) => { const idx = E.ids.map((id, k) => k).filter(k => DATA.qById.get(E.ids[k])?.domain === d.id); const c = idx.filter(k => E.results[k]).length; return { d, i, n: idx.length, c }; });
    app.innerHTML = `<section class="stack">
      <div><span class="eyebrow">Mock exam result</span><h2>${ok} of ${E.ids.length} correct (${p}%)</h2></div>
      <p class="lede">${p >= 80 ? 'Strong result. Keep the weakest domain warm with practice.' : p >= 65 ? 'Close. Study the domains below 70%, then retake.' : 'Work through the Learn pages for the missed items before another attempt.'} The real exam uses a scaled score, so this percentage is only a guide.</p>
      <div class="panel tbl"><table class="result-table"><thead><tr><th>Domain</th><th>Weight</th><th class="n">Correct</th><th class="n">Score</th></tr></thead><tbody>${byD.map(x => `<tr><td><span class="chip ${x.d.id}">D${x.i + 1}</span> ${esc(x.d.name)}</td><td>${esc(x.d.weight)}</td><td class="n">${x.c}/${x.n}</td><td class="n">${x.n ? pct(x.c, x.n) + '%' : '–'}</td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="primary" id="exNew">New attempt</button><button id="exMissed" ${ok === E.ids.length ? 'disabled' : ''}>Practice the missed items</button></div>
      <h3>Review every item</h3>
      <div class="stack" id="exReview"></div>
    </section>`;
    const host = $('#exReview');
    E.ids.forEach((id, i) => { const q = DATA.qById.get(id); if (!q) return; const wrap = document.createElement('details'); wrap.className = 'panel'; if (!E.results[i]) wrap.open = false; wrap.innerHTML = `<summary><span class="chip ${E.results[i] ? 'good' : 'bad'}">${E.results[i] ? 'Right' : 'Wrong'}</span> Q${i + 1}. ${esc(q.question.slice(0, 110))}${q.question.length > 110 ? '…' : ''}</summary><div style="margin-top:12px"></div>`; host.appendChild(wrap); wrap.addEventListener('toggle', () => { if (wrap.open && !wrap._r) { wrap._r = 1; renderItem(wrap.lastElementChild, q, { response: E.resp[i], revealed: true }); } }); });
    $('#exNew').onclick = () => { LS.del(EXAM_KEY); UI.exam = null; viewExam(); };
    $('#exMissed').onclick = () => { const ids = E.ids.filter((_, i) => !E.results[i]); startPractice(ids); LS.del(EXAM_KEY); UI.exam = null; go('practice'); };
  }

  // ---------- flashcards ----------
  function viewCards() {
    const st = UI.cards || (UI.cards = { domain: '', queue: null, i: 0, flipped: false });
    if (!st.queue) st.queue = shuffle(dueCards(st.domain)).slice(0, 40);
    const boxes = [1, 2, 3, 4, 5].map(b => DATA.cards.filter(c => (Store.state.cards[c.id]?.box || 0) === b).length);
    const fresh = DATA.cards.filter(c => !Store.state.cards[c.id]).length;
    const c = st.queue[st.i];
    app.innerHTML = `<section class="stack">
      <div><span class="eyebrow">Flashcards</span><h2>Spaced review</h2></div>
      <p class="lede">Tap the card to flip it. "Got it" moves a card up a box and pushes it further out (1, 3, 7, 14 days). "Again" sends it back to box 1.</p>
      <div class="row between">
        <label class="field">Domain<select id="fcDomain"><option value="">All domains</option>${DATA.domains.map((d, i) => `<option value="${d.id}" ${st.domain === d.id ? 'selected' : ''}>D${i + 1} · ${esc(d.name)}</option>`).join('')}</select></label>
        <div class="boxes"><span>New ${fresh}</span>${boxes.map((n, i) => `<span>Box ${i + 1}: ${n}</span>`).join('')}</div>
      </div>
      ${c ? `<div class="progressline"><span class="num">Card ${st.i + 1} of ${st.queue.length}</span><div class="meter"><span style="width:${pct(st.i, st.queue.length)}%"></span></div></div>
      <div class="card-stage"><div class="flash ${st.flipped ? 'flipped' : ''}" id="flash" tabindex="0" role="button" aria-label="Flip card">
        <div class="face front"><span class="chip ${c.domain}">${DATA.byObj.get(c.objectiveId).code}</span><p class="big">${esc(c.front)}</p><span class="note">Tap or press Space to flip</span></div>
        <div class="face back"><p class="big">${esc(c.back)}</p>${c.source ? `<span class="note">${link(c.source, 'Source on Microsoft Learn')}</span>` : ''}</div>
      </div></div>
      <div class="row"><button id="fcAgain" ${st.flipped ? '' : 'disabled'}>Again (1)</button><button class="primary" id="fcGot" ${st.flipped ? '' : 'disabled'}>Got it (2)</button></div>`
      : `<div class="empty">Nothing due right now. ${fresh ? '' : 'Every card is scheduled.'} <button id="fcMore">Review 20 cards anyway</button></div>`}
    </section>`;
    $('#fcDomain').onchange = e => { st.domain = e.target.value; st.queue = null; st.i = 0; st.flipped = false; viewCards(); };
    if (!c) { $('#fcMore').onclick = () => { st.queue = shuffle(DATA.cards.filter(x => !st.domain || x.domain === st.domain)).slice(0, 20); st.i = 0; st.flipped = false; viewCards(); }; return; }
    const flip = () => { st.flipped = !st.flipped; $('#flash').classList.toggle('flipped', st.flipped); $('#fcAgain').disabled = $('#fcGot').disabled = !st.flipped; };
    $('#flash').onclick = flip;
    const rate = ok => { Store.rateCard(c.id, ok); st.i++; st.flipped = false; if (st.i >= st.queue.length) { st.queue = null; st.i = 0; toast('Batch finished'); } viewCards(); };
    $('#fcAgain').onclick = () => rate(false); $('#fcGot').onclick = () => rate(true);
  }

  // ---------- review ----------
  function viewReview() {
    const s = Store.state;
    const missed = DATA.questions.filter(q => s.q[q.id] && !s.q[q.id].last);
    const flagged = DATA.questions.filter(q => s.flags[q.id]);
    const list = (arr) => arr.length ? `<ul class="weak-list">${arr.map(q => `<li><span><span class="chip ${q.domain}">${DATA.byObj.get(q.objectiveId).code}</span> ${esc(q.question.slice(0, 140))}${q.question.length > 140 ? '…' : ''}</span><button data-open-obj="${q.objectiveId}">Study</button></li>`).join('')}</ul>` : '<p class="note">None yet.</p>';
    app.innerHTML = `<section class="stack">
      <div><span class="eyebrow">Review</span><h2>Missed and flagged items</h2></div>
      <div class="grid2">
        <div class="panel stack"><div class="row between"><h3>Last answer wrong (${missed.length})</h3><button class="primary" id="rvMissed" ${missed.length ? '' : 'disabled'}>Practice these</button></div>${list(missed)}</div>
        <div class="panel stack"><div class="row between"><h3>Flagged (${flagged.length})</h3><button class="primary" id="rvFlag" ${flagged.length ? '' : 'disabled'}>Practice these</button></div>${list(flagged)}</div>
      </div>
    </section>`;
    $('#rvMissed').onclick = () => { startPractice(shuffle(missed).map(q => q.id)); go('practice'); };
    $('#rvFlag').onclick = () => { startPractice(flagged.map(q => q.id)); go('practice'); };
    bindCommon();
  }

  // ---------- sync ----------
  function viewSync() {
    const cfg = Store.getConfig() || {}; const u = Store.user; const status = Store.syncStatus;
    app.innerHTML = `<section class="stack">
      <div><span class="eyebrow">Sync</span><h2>Keep progress across devices</h2></div>
      <p class="lede">Progress always saves in this browser. Connect a free Supabase project to sync it between your laptop and phone. Each person's row is protected by row-level security, so only the signed-in user can read or write their own progress.</p>
      <div class="panel stack">
        <h3>Status: ${status === 'synced' ? 'Synced' : status === 'syncing' ? 'Syncing…' : status === 'signed-out' ? 'Supabase connected, not signed in' : status === 'error' ? 'Sync error' : 'Saved in this browser only'}</h3>
        ${status === 'error' ? `<p class="note warn">${esc(Store.syncError)}</p>` : ''}
        ${u ? `<p>Signed in as <b>${esc(u.email)}</b>.</p><div class="row"><button id="sbPull">Sync now</button><button id="sbOut">Sign out</button></div>` : ''}
      </div>
      <div class="grid2">
        <form class="panel stack" id="sbCfg">
          <h3>1. Supabase project</h3>
          <label class="field">Project URL<input type="url" id="sbUrl" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}" required></label>
          <label class="field">Anon (public) key<input type="text" id="sbKey" placeholder="eyJhbGciOi…" value="${esc(cfg.key || '')}" required></label>
          <div class="row"><button class="primary" type="submit">Save and connect</button>${cfg.url ? '<button type="button" id="sbClear">Disconnect</button>' : ''}</div>
          <p class="note">Use only the anon key. Never paste the service_role key into a website.</p>
        </form>
        <form class="panel stack" id="sbLogin">
          <h3>2. Sign in</h3>
          <label class="field">Email<input type="email" id="sbEmail" placeholder="you@example.com" required ${cfg.url ? '' : 'disabled'}></label>
          <button class="primary" type="submit" ${cfg.url ? '' : 'disabled'}>Email me a sign-in link</button>
          <p class="note">Open the link on the same device. Add this site's URL under Authentication → URL Configuration in Supabase.</p>
        </form>
      </div>
      <details class="panel"><summary>Database setup (run once in Supabase SQL editor)</summary><pre class="sql" id="sqlBlock">Loading…</pre></details>
      <div class="panel stack">
        <h3>Backup</h3>
        <p class="note">Copy your progress as JSON, or paste a backup to merge it in (newer entries win).</p>
        <textarea id="bk" rows="5" style="width:100%" spellcheck="false" aria-label="Progress JSON"></textarea>
        <div class="row"><button id="bkCopy">Copy my progress</button><button id="bkLoad">Merge pasted backup</button><button class="ghost" id="bkReset">Reset all progress</button></div>
        <div class="row" id="resetConfirm" hidden><span class="note warn">This clears progress in this browser (and the synced copy on next save).</span><button id="resetYes">Clear everything</button><button id="resetNo">Cancel</button></div>
      </div>
    </section>`;
    fetch('supabase/schema.sql').then(r => r.ok ? r.text() : Promise.reject()).then(t => { $('#sqlBlock').textContent = t; }).catch(() => { $('#sqlBlock').textContent = 'See supabase/schema.sql in the repository.'; });
    $('#sbCfg').onsubmit = async e => { e.preventDefault(); const ok = await Store.saveConfig($('#sbUrl').value, $('#sbKey').value); toast(ok ? 'Supabase connected' : 'Could not connect'); viewSync(); };
    $('#sbLogin').onsubmit = async e => { e.preventDefault(); try { await Store.signIn($('#sbEmail').value); toast('Check your email for the sign-in link'); } catch (er) { toast(er.message || 'Sign-in failed'); } };
    if ($('#sbClear')) $('#sbClear').onclick = () => { Store.clearConfig(); viewSync(); };
    if ($('#sbPull')) $('#sbPull').onclick = async () => { await Store.pull(); viewSync(); toast(Store.syncStatus === 'synced' ? 'Synced' : 'Sync failed'); };
    if ($('#sbOut')) $('#sbOut').onclick = async () => { await Store.signOut(); viewSync(); };
    $('#bkCopy').onclick = async () => { const t = Store.exportJSON(); $('#bk').value = t; try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (er) { $('#bk').select(); toast('Selected. Copy with Ctrl+C'); } };
    $('#bkLoad').onclick = () => { try { Store.importJSON($('#bk').value); toast('Backup merged'); } catch (er) { toast('That isn\'t valid progress JSON'); } };
    $('#bkReset').onclick = () => { $('#resetConfirm').hidden = false; };
    $('#resetNo').onclick = () => { $('#resetConfirm').hidden = true; };
    $('#resetYes').onclick = () => { Store.reset(); toast('Progress cleared'); viewSync(); };
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    if (e.target.matches('input[type="text"], input[type="url"], input[type="email"], input[type="number"], textarea, select')) return;
    if (UI.view === 'cards') { const f = $('#flash'); if (!f) return; if (e.key === ' ') { e.preventDefault(); f.click(); } if (e.key === '1' && !$('#fcAgain').disabled) $('#fcAgain').click(); if (e.key === '2' && !$('#fcGot').disabled) $('#fcGot').click(); }
    if (UI.view === 'practice' && UI.practice) { if (e.key === 'Enter' && $('#checkBtn') && !$('#checkBtn').disabled && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('#checkBtn').click(); } const n = +e.key; if (n >= 1 && n <= 8) { const inp = app.querySelectorAll('.opts input')[n - 1]; if (inp && !inp.disabled) inp.click(); } }
  });

  // ---------- sync pill ----------
  function paintPill() {
    const p = $('#syncPill'); const s = Store.syncStatus;
    p.textContent = s === 'synced' ? 'Synced' : s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync error' : s === 'signed-out' ? 'Sync: signed out' : 'Saved in this browser';
    p.classList.toggle('on', s === 'synced');
  }
  let rerenderPending = false;
  Store.subscribe(() => { paintPill(); if (UI.view === 'dashboard' || UI.view === 'learn') { if (!rerenderPending) { rerenderPending = true; requestAnimationFrame(() => { rerenderPending = false; const y = window.scrollY; render(); window.scrollTo({ top: y }); }); } } });

  // ---------- boot ----------
  load().then(() => { window.addEventListener('hashchange', route); route(); paintPill(); Store.initSupabase(); })
    .catch(err => { app.innerHTML = `<div class="empty">Couldn't load the study data (${esc(err.message)}). If you opened index.html straight from disk, serve the folder instead: <code>npx serve .</code> or GitHub Pages.</div>`; });
})();
