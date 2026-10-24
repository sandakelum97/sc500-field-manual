/* Reading settings: theme, text size, focus mode, full screen. Remembered per browser. */
(function () {
  const KEY = 'sc500.reader';
  const root = document.documentElement;
  const SIZES = [15, 16, 17, 18, 19, 20, 22];
  let prefs = { theme: 'auto', size: 17, focus: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } };

  function apply() {
    if (prefs.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prefs.theme);
    root.style.setProperty('--fs', prefs.size + 'px');
    document.body.classList.toggle('focus', !!prefs.focus);
    const f = document.getElementById('focusBtn'); if (f) f.setAttribute('aria-pressed', String(!!prefs.focus));
    const t = document.getElementById('themeSel'); if (t) t.value = prefs.theme;
    const dn = document.getElementById('fontDown'), up = document.getElementById('fontUp');
    if (dn) dn.disabled = prefs.size <= SIZES[0];
    if (up) up.disabled = prefs.size >= SIZES[SIZES.length - 1];
  }
  function step(dir) {
    const i = SIZES.indexOf(prefs.size); const n = i < 0 ? 2 : i + dir;
    prefs.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, n))]; save(); apply();
  }

  // Apply theme before first paint of the app.
  if (prefs.theme !== 'auto') root.setAttribute('data-theme', prefs.theme);
  root.style.setProperty('--fs', prefs.size + 'px');

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('themeSel').onchange = e => { prefs.theme = e.target.value; save(); apply(); };
    document.getElementById('fontDown').onclick = () => step(-1);
    document.getElementById('fontUp').onclick = () => step(1);
    document.getElementById('focusBtn').onclick = () => { prefs.focus = !prefs.focus; save(); apply(); };
    const fs = document.getElementById('fsBtn');
    const canFs = !!(document.documentElement.requestFullscreen);
    if (!canFs) fs.hidden = true;
    const label = () => { fs.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; };
    fs.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (e) { fs.hidden = true; }
    };
    document.addEventListener('fullscreenchange', label);
  });
})();
