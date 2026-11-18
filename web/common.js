/* Hettich · Полезные материалы — общие функции для страниц */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 310" role="img" aria-label="Hettich"><path fill="#00569d" d="m308.5 104.8 140.7-81V0L308.5 81.1V105z"/><path fill="#00965f" d="m308.5 138 140.7-81.1V33.1l-140.7 81.2V138z"/><path fill="#fab900" d="m308.5 171.1 140.7-81V66.2l-140.7 81.1v23.8z"/><path fill="#e20613" d="m308.5 204.1 140.7-81V99.4l-140.7 81.2v23.7z"/><path fill="currentColor" d="M277.8 165v45h26.4v20.2h-26.4v41c-.5 16.3 5.2 17.5 9.6 17.9h1.6l.1.1c4.1.1 12.2-2.3 12.2-2.3v20.7s-11.5 2-19.3 2h-.3c-6-.3-30.3.8-30-27.2v-52.2h-30.5v44.6l.1 2v.5c.5 6 2.3 11.8 11.2 12 3.1 0 12.2-2.4 12.2-2.4v20.7s-6.2 1-12.8 1.5h-.7l-.7.2h-1.4c-2.1.2-4.2.3-6 .2h-.3c-8.9-.5-27.5.2-27.7-27v-52.3h-17.5V210h17.5v-30l26-15v45h30.7v-30zm-136.6 42.7c40 .6 36.4 41.5 36.4 47.9H125c.3 4 2.2 20.3 16 29.4l.4.3c13.2 9.1 32.8-.2 34-.8V305s-13.3 5-27.1 4.5h-.5c-8.6 0-47.1-1.3-47.4-54.2v-1.6c0-13 2.2-44.1 39.6-46zm-1.6 19.2c-9.3 0-12.3 7-13.3 9.8v.2l-.3.7h26.4a12 12 0 0 0-12.4-10.7zm-71.4 80.7V256h-41v51.6H0V180h27.2v54.6h41V180h27.2v127.6zm270.8-53c.9-40.7 28.3-46.7 43.4-46.7 36.2 0 36.5 28.4 36.5 38.9h-27.4s2.3-19-10.9-18.6c-12.6.4-14.4 16-14.4 22.6a45 45 0 0 0 7.8 26 30.7 30.7 0 0 0 26.3 12.5c6 0 12-1.2 17.6-3.4v18.8s-14.2 5-28.7 5c-13.8 0-49.8-4-50.2-55zm135 53v-55.4c.2-19-2-19-6.6-18.8-14.7.3-18.4 24.7-18.2 31.7h-.1v42.5h-26V180l26-15v55.3c1.1-1.6 10-12.7 24.1-12.3 7.1 0 26.6 3.2 26.8 33v66.6zm-165.5 0V210h26v97.6z"/></svg>`;

const ICON = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-6 0 2 2"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.2c.3-1.3-.5-1.8-1-1.4zM9.9 14.3l-.3 3.6-1.4-4.4 9.7-6.1-8 6.9z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>',
  slides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-5 5m5-5 5 5M4 20h16"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, body, method) {
  const opts = { method: method || (body ? 'POST' : 'GET'), headers: { 'X-Requested-With': 'hettich' }, credentials: 'same-origin' };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  let data = {};
  try { data = await r.json(); } catch (_) { /* пусто */ }
  if (r.status === 401 && !path.endsWith('/login') && !path.endsWith('/password')) { location.href = '/login'; }
  if (!r.ok) throw new Error(data.error || 'Ошибка ' + r.status);
  return data;
}

function fmtSize(b) {
  if (b == null) return '—';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return (i >= 2 ? b.toFixed(b < 10 ? 2 : 1) : Math.round(b)).toString().replace('.', ',') + ' ' + u[i];
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
         d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function toast(msg) {
  $('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = ICON.check + '<span>' + esc(msg) + '</span>';
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Скопировано');
}

/* Модальное окно: возвращает {el, close} */
function modal(html, { dismissable = true, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  if (dismissable) {
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    $('.modal', back).insertAdjacentHTML('afterbegin', `<button class="modal-x" aria-label="Закрыть">${ICON.close}</button>`);
    $('.modal-x', back).onclick = close;
  }
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  setTimeout(() => $('input', back)?.focus(), 30);
  return { el: back, close };
}

/* Подтверждение действия: resolve(true) — если нажали основную кнопку */
function confirmModal(title, text, okLabel, danger) {
  return new Promise((res) => {
    let answered = false;
    const m = modal(`
      <div class="modal-head"><h3>${title}</h3><p>${text}</p></div>
      <div class="modal-body"><div class="confirm-row">
        <button class="btn light" data-no>Отмена</button>
        <button class="btn ${danger ? 'danger-solid' : ''}" data-yes>${okLabel}</button>
      </div></div>`, { onClose: () => { if (!answered) res(false); } });
    $('[data-no]', m.el).onclick = () => m.close();
    $('[data-yes]', m.el).onclick = () => { answered = true; res(true); m.close(); };
    setTimeout(() => $('[data-no]', m.el).focus(), 40);
  });
}

function bindPwToggles(root = document) {
  $$('.pw-toggle', root).forEach((b) => {
    b.innerHTML = ICON.eye;
    b.onclick = () => {
      const i = b.previousElementSibling;
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.innerHTML = show ? ICON.eyeOff : ICON.eye;
      b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    };
  });
}

/* Смена пароля (обязательна при первом входе) */
function passwordModal(forced) {
  const m = modal(`
    <div class="modal-head">
      <h3>${forced ? 'Придумайте свой пароль' : 'Сменить пароль'}</h3>
      <p>${forced ? 'Вы вошли по временному паролю. Придумайте свой — минимум 8 символов.' : 'Минимум 8 символов.'}</p>
    </div>
    <form class="modal-body" autocomplete="on">
      <div class="field"><label for="pw-cur">${forced ? 'Временный пароль' : 'Текущий пароль'}</label>
        <div class="pw-wrap"><input class="input" id="pw-cur" type="password" autocomplete="current-password" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="field"><label for="pw-new">Новый пароль</label>
        <div class="pw-wrap"><input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="field"><label for="pw-new2">Повторите новый пароль</label>
        <div class="pw-wrap"><input class="input" id="pw-new2" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="form-error" aria-live="polite"></div>
      <button class="btn block" type="submit">Сохранить пароль</button>
    </form>`, { dismissable: !forced });
  bindPwToggles(m.el);
  const f = $('form', m.el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', f);
    err.textContent = '';
    if ($('#pw-new', f).value !== $('#pw-new2', f).value) { err.textContent = 'Пароли не совпадают'; return; }
    try {
      await api('/api/password', { current: $('#pw-cur', f).value, new: $('#pw-new', f).value });
      m.close();
      toast('Пароль сохранён');
    } catch (ex) { err.textContent = ex.message; }
  };
}

/* Шапка с меню пользователя. active: 'materials' | 'admin' */
async function mountTopbar(active) {
  const me = await api('/api/me');
  const bar = $('#topbar');
  bar.innerHTML = `
    <div class="wrap">
      <a class="brand" href="/" aria-label="На главную">${LOGO}<span class="brand-sep"></span>
        <span class="brand-title">Полезные материалы<small>для сотрудников и партнёров</small></span></a>
      <form class="hsearch" role="search" action="/all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input id="hq" name="q" type="search" placeholder="Поиск по материалам" autocomplete="off" aria-label="Поиск по материалам">
        <kbd aria-hidden="true">/</kbd>
      </form>
      <nav>
        <a class="nav-link nav-main" href="/all" ${active === 'all' ? 'aria-current="page"' : ''}>${ICON.grid}<span class="label">Все материалы</span></a>
        ${me.role === 'admin' ? `
          <a class="nav-link" href="/admin" ${active === 'admin' ? 'aria-current="page"' : ''}>${ICON.users}<span class="label">Сотрудники</span></a>` : ''}
        ${me.can_upload ? `<button class="btn hup" id="hup" type="button" title="Загрузить файлы на сайт">${ICON.upload}<span class="label">Загрузить</span></button>` : ''}
        <div class="user-menu">
          <button class="nav-link user-btn" aria-haspopup="true" aria-expanded="false">
            <span class="avatar">${esc(initials(me.name))}</span>
            <span class="who"><b>${esc(me.name)}</b><span>${me.role === 'admin' ? 'Администратор' : esc(me.position || 'Сотрудник')}</span></span>
          </button>
          <div class="dropdown" role="menu">
            <button data-act="pw" role="menuitem">${ICON.key}Сменить пароль</button>
            ${me.role === 'admin' ? `<button data-act="rk" role="menuitem">${ICON.shield}Ключ восстановления${me.has_recovery ? '' : '<span class="dot" title="Не создан"></span>'}</button>` : ''}
            <hr>
            <button data-act="out" role="menuitem">${ICON.logout}Выйти</button>
          </div>
        </div>
      </nav>
    </div>`;
  const btn = $('.user-btn', bar), dd = $('.dropdown', bar);
  btn.onclick = (e) => { e.stopPropagation(); const o = dd.classList.toggle('open'); btn.setAttribute('aria-expanded', o); };
  document.addEventListener('click', () => { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
  $('[data-act=pw]', bar).onclick = () => passwordModal(false);
  $('[data-act=out]', bar).onclick = async () => { await api('/api/logout', {}); location.href = '/login'; };

  // Поиск в шапке: на странице «Все материалы» фильтрует сразу, на остальных — ведёт туда
  const hq = $('#hq', bar);
  let ht;
  hq.addEventListener('input', () => {
    if (!window.onHeaderSearch) return;
    clearTimeout(ht);
    ht = setTimeout(() => window.onHeaderSearch(hq.value.trim()), 120);
  });
  hq.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hq.value = ''; window.onHeaderSearch?.(''); hq.blur(); }
  });
  $('.hsearch', bar).onsubmit = (e) => {
    e.preventDefault();
    const q = hq.value.trim();
    if (window.onHeaderSearch) { window.onHeaderSearch(q); hq.blur(); }
    else location.href = '/all' + (q ? '?q=' + encodeURIComponent(q) : '');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.matches('input, textarea, select') && !$('.viewer, .modal-back')) { e.preventDefault(); hq.focus(); }
  });

  // Кнопка «Загрузить»: на страницах с материалами открывает окно, на остальных — ведёт в каталог
  const hup = $('#hup', bar);
  if (hup) hup.onclick = () => (window.openUpload ? window.openUpload() : (location.href = '/all?upload=1'));
  if (me.role === 'admin') {
    $('[data-act=rk]', bar).onclick = () => recoveryModal(me);
    // Напоминание, пока у администратора нет ключа восстановления
    $('.notice-bar')?.remove();
    if (!me.has_recovery && !me.must_change) {
      bar.insertAdjacentHTML('afterend', `<div class="notice-bar"><div class="wrap">${ICON.shield}
        <span><b>Создайте ключ восстановления</b> — на случай, если забудете пароль.</span>
        <button class="btn small" data-rk>Создать ключ</button></div></div>`);
      $('.notice-bar [data-rk]').onclick = () => recoveryModal(me);
    }
  }
  if (me.must_change) passwordModal(true);
  return me;
}

/* ---------- Ключ восстановления администратора ---------- */
function recoveryModal(me) {
  const created = me.recovery_created ? fmtDate(me.recovery_created) : null;
  const m = modal(`
    <div class="modal-head"><h3>Ключ восстановления</h3>
      <p>Одноразовый ключ на случай, если забудете пароль.</p></div>
    <form class="modal-body" autocomplete="off">
      <div class="rk-status ${me.has_recovery ? 'ok' : 'warn'}">${ICON.shield}
        <span>${me.has_recovery ? `<b>Ключ создан</b>${created}. Новый ключ отменит старый.` : '<b>Ключа ещё нет</b>'}</span></div>
      <div class="field"><label for="rk-pw">Ваш текущий пароль — для подтверждения</label>
        <div class="pw-wrap"><input class="input" id="rk-pw" type="password" autocomplete="current-password" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="form-error" aria-live="polite"></div>
      <button class="btn block" type="submit">${ICON.shield}${me.has_recovery ? 'Создать новый ключ' : 'Создать ключ'}</button>
    </form>`);
  bindPwToggles(m.el);
  const f = $('form', m.el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/recovery-key', { password: $('#rk-pw', f).value });
      m.close();
      me.has_recovery = true; me.recovery_created = r.created;
      $('.notice-bar')?.remove();
      $('[data-act=rk] .dot')?.remove();
      showRecoveryKey(r);
    } catch (ex) { $('.form-error', f).textContent = ex.message; }
  };
}

function recoveryFileText(r) {
  return [
    'HETTICH · ПОЛЕЗНЫЕ МАТЕРИАЛЫ',
    'Ключ восстановления доступа администратора',
    '============================================',
    '',
    `Сайт:    ${location.origin}`,
    `Логин:   ${r.login}`,
    `Ключ:    ${r.key}`,
    `Создан:  ${fmtDate(r.created)}`,
    '',
    'Как использовать:',
    '  1. На странице входа нажмите «Вход по ключу восстановления».',
    '  2. Выберите этот файл (или введите ключ вручную) и задайте новый пароль.',
    '',
    'Важно:',
    '  • Ключ одноразовый. После входа по нему создайте новый ключ.',
    '  • Храните файл в надёжном месте: личная флешка, сейф, менеджер паролей.',
    '  • Не пересылайте его по почте и в мессенджерах и не храните рядом с паролем.',
    '  • Кто владеет этим файлом — может войти как администратор.',
    '',
  ].join('\r\n');
}

function showRecoveryKey(r) {
  const fname = `Hettich_klyuch_vosstanovleniya_${r.login}.txt`;
  const m = modal(`
    <div class="modal-head"><h3>Сохраните ключ</h3><p>Ключ виден только сейчас.</p></div>
    <div class="modal-body">
      <div class="rk-key"><span>${esc(r.login)}</span><code>${esc(r.key)}</code></div>
      <div class="confirm-row">
        <button class="btn light" data-copy>${ICON.copy}Скопировать</button>
        <button class="btn" data-dl>${ICON.download}Скачать файл</button>
      </div>
      <div class="warn">⚠ Храните файл отдельно от пароля. Кто владеет файлом — может войти как администратор.</div>
      <label class="check"><input type="checkbox" id="rk-saved"> Я сохранил ключ в надёжном месте</label>
      <button class="btn ghost block" data-done disabled>Готово</button>
    </div>`, { dismissable: false });
  const dl = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + recoveryFileText(r)], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fname });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $('#rk-saved', m.el).checked = true; $('[data-done]', m.el).disabled = false;
  };
  $('[data-dl]', m.el).onclick = dl;
  $('[data-copy]', m.el).onclick = () => copyText(r.key);
  $('#rk-saved', m.el).onchange = (e) => { $('[data-done]', m.el).disabled = !e.target.checked; };
  $('[data-done]', m.el).onclick = () => { m.close(); toast('Ключ восстановления сохранён'); };
}

/* Окно «Забыли пароль администратора?» на странице входа */
function recoverModal(prefillLogin) {
  const m = modal(`
    <div class="modal-head"><h3>Вход по ключу</h3><p>Для администратора, у которого есть файл ключа.</p></div>
    <form class="modal-body" autocomplete="off">
      <div class="field"><label for="rc-login">Логин администратора</label><input class="input" id="rc-login" required autocapitalize="off" spellcheck="false" value="${esc(prefillLogin || '')}"></div>
      <div class="field"><label for="rc-key">Ключ восстановления</label>
        <label class="keyfile" id="rc-drop">${ICON.shield}<span><b>Выберите файл ключа</b><small>или перетащите его сюда · .txt</small></span><input type="file" accept=".txt,text/plain" id="rc-file" hidden></label>
        <input class="input mono-in" id="rc-key" required placeholder="HETTICH-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false" autocapitalize="characters"></div>
      <div class="field"><label for="rc-new">Новый пароль</label>
        <div class="pw-wrap"><input class="input" id="rc-new" type="password" minlength="8" autocomplete="new-password" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="field"><label for="rc-new2">Повторите новый пароль</label>
        <div class="pw-wrap"><input class="input" id="rc-new2" type="password" minlength="8" autocomplete="new-password" required><button type="button" class="pw-toggle" aria-label="Показать пароль"></button></div></div>
      <div class="form-error" aria-live="polite"></div>
      <button class="btn block" type="submit">Войти и сменить пароль</button>
      
    </form>`);
  bindPwToggles(m.el);
  const f = $('form', m.el), err = $('.form-error', f);
  const readFile = async (file) => {
    const text = await file.text();
    const key = (text.match(/HETTICH(?:-[A-Z0-9]{5}){5}/i) || [])[0];
    const login = (text.match(/Логин:\s*(\S+)/) || [])[1];
    if (!key) { err.textContent = 'В файле не найден ключ восстановления'; return; }
    $('#rc-key', f).value = key.toUpperCase();
    if (login && !$('#rc-login', f).value) $('#rc-login', f).value = login;
    $('#rc-drop b', f).textContent = file.name;
    $('#rc-drop', f).classList.add('loaded');
    err.textContent = '';
    $('#rc-new', f).focus();
  };
  $('#rc-file', f).onchange = (e) => e.target.files[0] && readFile(e.target.files[0]);
  const drop = $('#rc-drop', f);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]); });
  f.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    if ($('#rc-new', f).value !== $('#rc-new2', f).value) { err.textContent = 'Пароли не совпадают'; return; }
    try {
      await api('/api/recover', { login: $('#rc-login', f).value.trim(), key: $('#rc-key', f).value, new: $('#rc-new', f).value });
      m.close();
      location.href = '/';
    } catch (ex) { err.textContent = ex.message; }
  };
}
