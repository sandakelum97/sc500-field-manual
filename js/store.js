/* Progress store: browser storage by default, optional Supabase sync (per-user row, RLS-protected). */
(function () {
  const KEY = 'sc500.progress.v1';
  const CFG_KEY = 'sc500.supabase';
  const listeners = new Set();
  let state = blank();
  let sb = null;            // supabase client
  let user = null;
  let pushTimer = null;
  let syncStatus = 'local'; // local | signed-out | syncing | synced | error
  let syncError = '';

  function blank() { return { v: 1, q: {}, cards: {}, obj: {}, exams: [], flags: {} }; }
  function now() { return Date.now(); }

  function readLocal() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
    return blank();
  }
  function writeLocal() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }

  function mergeMap(a, b) {
    const out = Object.assign({}, a || {});
    for (const [k, v] of Object.entries(b || {})) { if (!out[k] || (v && (v.t || 0) > (out[k].t || 0))) out[k] = v; }
    return out;
  }
  function merge(a, b) {
    const ex = new Map(); [...(a.exams || []), ...(b.exams || [])].forEach(e => ex.set(e.id, e));
    return {
      v: 1,
      q: mergeMap(a.q, b.q), cards: mergeMap(a.cards, b.cards), obj: mergeMap(a.obj, b.obj),
      flags: Object.assign({}, a.flags, b.flags),
      exams: [...ex.values()].sort((x, y) => x.t - y.t)
    };
  }

  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  function changed() { writeLocal(); emit(); schedulePush(); }

  // ---------- public mutations ----------
  function recordAnswer(qid, correct) {
    const e = state.q[qid] || { a: 0, c: 0 };
    state.q[qid] = { a: e.a + 1, c: e.c + (correct ? 1 : 0), last: !!correct, t: now() };
    changed();
  }
  function rateCard(cid, knewIt) {
    const e = state.cards[cid] || { box: 1 };
    const box = knewIt ? Math.min(5, e.box + 1) : 1;
    const days = [0, 0, 1, 3, 7, 14][box];
    state.cards[cid] = { box, due: now() + days * 864e5, t: now() };
    changed();
  }
  function setObjective(oid, patch) {
    state.obj[oid] = Object.assign({}, state.obj[oid], patch, { t: now() });
    changed();
  }
  function toggleFlag(qid) { if (state.flags[qid]) delete state.flags[qid]; else state.flags[qid] = now(); changed(); }
  function addExam(rec) { state.exams.push(Object.assign({ id: 'x' + now().toString(36), t: now() }, rec)); changed(); }
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) { const inc = JSON.parse(text); state = merge(state, Object.assign(blank(), inc)); changed(); }
  function reset() { state = blank(); changed(); }

  // ---------- Supabase ----------
  function getConfig() {
    let saved = null; try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { /* ignore */ }
    const shipped = (window.SC500_CONFIG && window.SC500_CONFIG.supabaseUrl) ? { url: window.SC500_CONFIG.supabaseUrl, key: window.SC500_CONFIG.supabaseAnonKey } : null;
    return saved && saved.url ? saved : shipped;
  }
  function saveConfig(url, key) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() })); } catch (e) { /* ignore */ }
    return initSupabase();
  }
  function clearConfig() { try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ } sb = null; user = null; syncStatus = 'local'; emit(); }

  async function initSupabase() {
    const cfg = getConfig();
    if (!cfg || !cfg.url || !cfg.key) { syncStatus = 'local'; emit(); return false; }
    if (!window.supabase || !window.supabase.createClient) { syncStatus = 'error'; syncError = 'The Supabase library did not load.'; emit(); return false; }
    try {
      sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, detectSessionInUrl: true } });
      const { data } = await sb.auth.getSession();
      user = data && data.session ? data.session.user : null;
      sb.auth.onAuthStateChange((_ev, session) => { const was = user && user.id; user = session ? session.user : null; if (user && user.id !== was) pull(); else emit(); });
      syncStatus = user ? 'syncing' : 'signed-out'; emit();
      if (user) await pull();
      return true;
    } catch (e) { syncStatus = 'error'; syncError = e.message || String(e); emit(); return false; }
  }
  async function signIn(email) {
    if (!sb) throw new Error('Add your Supabase project URL and anon key first.');
    const redirect = location.href.split('#')[0];
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) throw error;
  }
  async function signOut() { if (sb) await sb.auth.signOut(); user = null; syncStatus = sb ? 'signed-out' : 'local'; emit(); }

  async function pull() {
    if (!sb || !user) return;
    syncStatus = 'syncing'; emit();
    try {
      const { data, error } = await sb.from('sc500_progress').select('state').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (data && data.state) state = merge(state, Object.assign(blank(), data.state));
      writeLocal();
      await push();
    } catch (e) { syncStatus = 'error'; syncError = e.message || String(e); emit(); }
  }
  function schedulePush() { if (!sb || !user) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
  async function push() {
    if (!sb || !user) return;
    try {
      const { error } = await sb.from('sc500_progress').upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
      if (error) throw error;
      syncStatus = 'synced'; syncError = '';
    } catch (e) { syncStatus = 'error'; syncError = e.message || String(e); }
    emit();
  }

  state = readLocal();

  window.Store = {
    get state() { return state; },
    get user() { return user; },
    get syncStatus() { return syncStatus; },
    get syncError() { return syncError; },
    getConfig, saveConfig, clearConfig, initSupabase, signIn, signOut, pull,
    recordAnswer, rateCard, setObjective, toggleFlag, addExam, exportJSON, importJSON, reset,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
