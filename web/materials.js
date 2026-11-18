/* Hettich · Полезные материалы — каталог, поиск, выбор, просмотр и загрузка */

Object.assign(ICON, {
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  cad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-5 5m5-5 5 5M4 20h16"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12"/></svg>',
});

const KIND = {
  video: { name: 'Видео', one: 'Видео', icon: ICON.video, color: 'var(--s-blue)' },
  pres: { name: 'Презентации', one: 'Презентация', icon: ICON.slides, color: 'var(--s-red)' },
  image: { name: 'Изображения', one: 'Изображение', icon: ICON.image, color: 'var(--s-green)' },
  doc: { name: 'Документы', one: 'Документ', icon: ICON.doc, color: '#5b6170' },
  cad: { name: '3D и чертежи', one: '3D / чертёж', icon: ICON.cad, color: 'var(--s-yellow)' },
  other: { name: 'Другое', one: 'Файл', icon: ICON.file, color: '#8b8e99' },
};
const KIND_BY_EXT = {
  video: 'mp4 m4v mov webm avi mkv wmv', pres: 'pptx ppt pps ppsx potx key odp',
  image: 'jpg jpeg png gif webp svg bmp tif tiff heic avif psd ai eps', doc: 'pdf doc docx xls xlsx csv txt rtf odt ods md',
  cad: 'dwg dxf skp 3ds max obj fbx step stp igs iges stl 3dm blend glb gltf',
};
const PLAYABLE = new Set(['mp4', 'm4v', 'webm', 'mov']);
const VIEWABLE_IMG = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp']);
const INLINE_DOC = new Set(['pdf', 'txt', 'csv', 'md']);
const ARCHIVE_FORMATS = [
  { ext: 'zip', label: 'ZIP', color: 'var(--s-blue)', hint: 'Открывается без программ' },
  { ext: 'rar', label: 'RAR', color: 'var(--s-red)', hint: 'Для WinRAR' },
  { ext: '7z', label: '7-Zip', color: 'var(--s-green)', hint: 'Для 7-Zip' },
];
const WEEK = 7 * 86400;

const store = {
  get(k, d) { try { return localStorage.getItem('hm.' + k) || d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('hm.' + k, v); } catch (_) { /* приватный режим */ } },
};

const S = {
  items: [], isAdmin: false, canUpload: false, maxUpload: 0, me: null,
  kind: 'all', q: '', sort: store.get('sort', 'new'), view: store.get('view', 'grid'),
  selected: new Set(),
};

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const fmtDur = (s) => { if (!s) return ''; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const fmtDay = (ts) => new Date(ts * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const kindOf = (name) => { const e = name.split('.').pop().toLowerCase(); return Object.keys(KIND_BY_EXT).find((k) => KIND_BY_EXT[k].split(' ').includes(e)) || 'other'; };
const byId = (id) => S.items.find((m) => m.id === +id);
const dlUrl = (m) => m.url + '?dl=1';
const itemLink = (id) => location.origin + '/all#m-' + id;  // ссылка на файл: откроется в каталоге
const isNew = (m) => Date.now() / 1000 - m.created_at < WEEK;
const slideUrl = (m, n) => `/assets/${m.meta.slides_dir}/slide${String(n).padStart(2, '0')}.jpg`;
const canPreview = (m) => (m.kind === 'video' && PLAYABLE.has(m.ext)) || m.meta.slides || VIEWABLE_IMG.has(m.ext) || INLINE_DOC.has(m.ext);
const hl = (text) => {
  const t = esc(text);
  if (!S.q) return t;
  const q = S.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return t.replace(new RegExp('(' + esc(q) + ')', 'ig'), '<mark>$1</mark>');
};

/* =============================== Данные =============================== */
async function loadMaterials() {
  const r = await api('/api/materials');
  S.items = r.materials;
  // картинка без отдельной обложки (например, положена прямо в папку) — показываем её саму
  S.items.forEach((m) => { if (!m.cover && VIEWABLE_IMG.has(m.ext) && m.size <= 15 * 1024 * 1024) m.cover = m.url; });
  S.isAdmin = r.is_admin;
  S.canUpload = r.can_upload;
  S.maxUpload = r.max_upload;
  const ids = new Set(S.items.map((m) => m.id));
  S.selected.forEach((id) => { if (!ids.has(id)) S.selected.delete(id); });
  renderAll();
}

function filtered() {
  const q = S.q.toLowerCase();
  let list = S.items.filter((m) => (S.kind === 'all' || m.kind === S.kind) &&
    (!q || (m.title + ' ' + m.description + ' ' + m.file).toLowerCase().includes(q)));
  const cmp = {
    new: (a, b) => b.created_at - a.created_at,
    old: (a, b) => a.created_at - b.created_at,
    name: (a, b) => a.title.localeCompare(b.title, 'ru'),
    size: (a, b) => b.size - a.size,
  }[S.sort];
  return list.sort(cmp);
}

/* =============================== Отрисовка =============================== */
const PAGE = document.body.dataset.page || 'home';  // 'home' — главная, 'all' — каталог
const LATEST_ON_HOME = 8;
ICON.arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

function renderAll() {
  if (PAGE === 'home') {
    renderFacts();
    renderHome();
  } else {
    renderTabs();
    renderItems();
    renderPageTop();
  }
  renderSelbar();
}

/* Какие карточки сейчас на экране — для «Выбрать все» */
function visibleItems() {
  if (PAGE === 'all') return filtered();
  return $$('[data-id]').map((el) => byId(el.dataset.id)).filter((m, i, a) => m && a.indexOf(m) === i);
}

/* ---------- Главная ---------- */
function renderHome() {
  const counts = {}, sizes = {};
  S.items.forEach((m) => { counts[m.kind] = (counts[m.kind] || 0) + 1; sizes[m.kind] = (sizes[m.kind] || 0) + m.size; });
  const kinds = Object.entries(KIND).filter(([k]) => counts[k]);
  $('#kinds-block').hidden = kinds.length < 2;
  $('#kinds').innerHTML = kinds.map(([k, v]) => `
    <a class="kind-tile" href="/all?kind=${k}" style="--kc:${v.color}">
      <span class="ki">${v.icon}</span><b>${v.name}</b>
      <span>${counts[k]} ${plural(counts[k], 'файл', 'файла', 'файлов')} · ${fmtSize(sizes[k])}</span>
      <span class="arr">${ICON.arrow}</span>
    </a>`).join('');

  const pinned = S.items.filter((m) => m.pinned);
  $('#featured-block').hidden = !pinned.length;
  $('#featured').innerHTML = pinned.map((m) => cardHtml(m, true)).join('');

  const latest = S.items.filter((m) => !m.pinned).sort((a, b) => b.created_at - a.created_at).slice(0, LATEST_ON_HOME);
  $('#latest-head').innerHTML = `<h2 id="h-latest">Новые поступления</h2>
    <a class="more" href="/all">Все материалы · ${S.items.length} ${ICON.arrow}</a>
    ${S.canUpload ? `<button class="btn small" data-upload>${ICON.upload}Загрузить</button>` : ''}`;
  $('#items').innerHTML = !S.items.length
    ? `<div class="empty-state"><b>Здесь пока пусто</b>${S.canUpload ? 'Нажмите «Загрузить» вверху.' : 'Администратор скоро добавит материалы.'}
       ${S.canUpload ? `<br><button class="btn" data-upload>${ICON.upload}Загрузить файлы</button>` : ''}</div>`
    : latest.length ? `<div class="grid">${latest.map((m) => cardHtml(m, false)).join('')}</div>` : '';
  $('#all-cta').innerHTML = S.items.length ? `<a href="/all"><span><b>Все материалы</b></span><span class="go">${ICON.arrow}</span></a>` : '';
  const cta = $('#hero-cta');
  if (cta) cta.innerHTML = `Все материалы · ${S.items.length} ${ICON.arrow}`;
  bindMedia();
}

/* ---------- Каталог ---------- */
function renderPageTop() {
  const total = S.items.reduce((s, m) => s + m.size, 0);
  $('#total-count').textContent = S.items.length;
  $('#page-side').innerHTML = `<span><b>${S.items.length}</b> ${plural(S.items.length, 'файл', 'файла', 'файлов')} · <b>${fmtSize(total)}</b></span>
    <a href="/#pack">${ICON.archive}Скачать всё архивом</a>`;
}

function syncUrl() {
  if (PAGE !== 'all') return;
  const p = new URLSearchParams();
  if (S.kind !== 'all') p.set('kind', S.kind);
  if (S.q) p.set('q', S.q);
  const qs = p.toString();
  history.replaceState(null, '', '/all' + (qs ? '?' + qs : '') + location.hash);
}

function renderFacts() {
  const total = S.items.reduce((s, m) => s + m.size, 0);
  const fresh = S.items.filter(isNew).length;
  const [num, unit] = fmtSize(total).split(' ');
  $('#facts').innerHTML = `
    <div class="fact"><b>${S.items.length}</b><span>${plural(S.items.length, 'материал', 'материала', 'материалов')}</span></div>
    <div class="fact"><b>${num}</b><span>${unit} всего</span></div>
    <div class="fact"><b>${fresh}</b><span>${plural(fresh, 'новый', 'новых', 'новых')} за неделю</span></div>`;
}

function renderTabs() {
  const counts = { all: S.items.length };
  S.items.forEach((m) => { counts[m.kind] = (counts[m.kind] || 0) + 1; });
  if (S.kind !== 'all' && !counts[S.kind]) S.kind = 'all';
  const tabs = [['all', 'Все', ICON.grid], ...Object.entries(KIND).filter(([k]) => counts[k]).map(([k, t]) => [k, t.name, t.icon])];
  $('#tabs').innerHTML = tabs.map(([k, name, icon]) =>
    `<button class="tab" role="tab" data-k="${k}" aria-selected="${S.kind === k}">${icon}${name}<span class="n">${counts[k]}</span></button>`).join('');
}

function thumbHtml(m, { big = false } = {}) {
  const k = KIND[m.kind] || KIND.other;
  const isVideo = m.kind === 'video' && PLAYABLE.has(m.ext);
  const isScrub = !!m.meta.slides;
  const cls = ['thumb', 'kind-' + m.kind, m.cover ? 'has-img' : '', isScrub ? 'scrub' : ''].join(' ');
  const badges = [];
  if (m.meta.duration) badges.push(fmtDur(m.meta.duration));
  if (m.meta.quality) badges.push(m.meta.quality);
  if (m.meta.slides) badges.push(`${m.meta.slides} ${plural(m.meta.slides, 'слайд', 'слайда', 'слайдов')}`);
  if (!m.cover || !['video', 'pres'].includes(m.kind)) badges.push(m.ext.toUpperCase());
  const flags = [m.pinned && big ? '' : '', isNew(m) ? '<span class="flag">Новое</span>' : ''].join('');
  return `<button class="${cls}" data-open="${m.id}" style="--kc:${k.color}" aria-label="${canPreview(m) ? 'Открыть' : 'Подробнее'}: ${esc(m.title)}">
    ${m.cover ? `<img src="${m.cover}" alt="" loading="lazy">` : `<span class="ph"><span class="ico">${k.icon}</span><span class="ext">${esc(m.ext || '?')}</span></span>`}
    ${isVideo ? '<video muted playsinline preload="none"></video><span class="play">' + ICON.play + '</span><span class="preview-bar"></span>' : ''}
    ${isScrub ? `<span class="scrub-ticks">${'<i></i>'.repeat(Math.min(m.meta.slides, 40))}</span>` : ''}
    <span class="badges">${badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</span>
    <span class="flags">${flags}</span>
  </button>`;
}

const selBox = (m) => `<label class="sel" title="Выбрать"><input type="checkbox" data-sel="${m.id}" ${S.selected.has(m.id) ? 'checked' : ''} aria-label="Выбрать: ${esc(m.title)}">${ICON.check}</label>`;
const actions = (m) => `
  <button class="ib" data-link="${m.id}" title="Скопировать ссылку" aria-label="Скопировать ссылку">${ICON.link}</button>
  ${m.can_edit ? `<button class="ib" data-edit="${m.id}" title="Изменить" aria-label="Изменить">${ICON.edit}</button>` : ''}
  <a class="ib dl" href="${dlUrl(m)}" download title="Скачать · ${fmtSize(m.size)}" aria-label="Скачать">${ICON.download}</a>`;

function cardHtml(m, big) {
  const k = KIND[m.kind] || KIND.other;
  return `<article class="card ${S.selected.has(m.id) ? 'selected' : ''}" data-id="${m.id}" style="--kc:${k.color}">
    ${selBox(m)}
    ${thumbHtml(m, { big })}
    <div class="card-body">
      <div class="kicker"><i></i>${k.one} · ${esc(m.ext.toUpperCase())}${m.pinned && !big ? ' · Закреплено' : ''}</div>
      <h3 title="${esc(m.title)}">${hl(m.title)}</h3>
      ${m.description ? `<p class="desc">${hl(m.description)}</p>` : ''}
      <div class="card-foot">
        <span class="meta"><b>${fmtSize(m.size)}</b>${fmtDay(m.created_at)}</span>
        ${actions(m)}
      </div>
    </div>
  </article>`;
}

function rowHtml(m) {
  const k = KIND[m.kind] || KIND.other;
  return `<div class="row ${S.selected.has(m.id) ? 'selected' : ''}" data-id="${m.id}" style="--kc:${k.color}">
    ${selBox(m)}
    ${thumbHtml(m)}
    <div class="t"><b data-open="${m.id}" title="${esc(m.title)}">${hl(m.title)}</b><small>${esc(m.file)}${m.uploader ? ` · загрузил(а) ${esc(m.uploader)}` : ''}</small></div>
    <div class="k"><i></i>${k.one}</div>
    <div class="s">${fmtSize(m.size)}</div>
    <div class="d">${fmtDay(m.created_at)}</div>
    <div class="a">${actions(m)}</div>
  </div>`;
}

function renderItems() {
  if (PAGE !== 'all') return renderHome();
  const list = filtered();
  // заголовок нужен только при фильтре или поиске — без них он повторял бы «Все материалы»
  const filteredView = S.q || S.kind !== 'all';
  const title = S.q ? 'Найдено' : filteredView ? KIND[S.kind].name : '';
  $('#result-head').innerHTML = filteredView
    ? `<h2>${title}</h2><span class="count">${String(list.length).padStart(2, '0')}</span><button class="clear" data-clear>Сбросить фильтр</button>`
    : '';

  if (!S.items.length) {
    $('#items').innerHTML = `<div class="empty-state"><b>Здесь пока пусто</b>${S.canUpload ? 'Нажмите «Загрузить» вверху.' : 'Администратор скоро добавит материалы.'}
      ${S.canUpload ? `<br><button class="btn" data-upload>${ICON.upload}Загрузить файлы</button>` : ''}</div>`;
  } else if (!list.length) {
    $('#items').innerHTML = `<div class="empty-state"><b>Ничего не нашлось</b>Попробуйте другое слово или сбросьте фильтр.<br><button class="btn ghost" data-clear>Показать всё</button></div>`;
  } else {
    $('#items').innerHTML = S.view === 'list'
      ? `<div class="list">${list.map(rowHtml).join('')}</div>`
      : `<div class="grid">${list.map((m) => cardHtml(m, false)).join('')}</div>`;
  }
  syncUrl();
  bindMedia();
}

/* Превью видео при наведении и листание слайдов */
function bindMedia() {
  $$('.thumb').forEach((btn) => {
    const m = byId(btn.dataset.open);
    if (!m) return;
    const v = $('video', btn);
    if (v) {
      const start = m.meta.preview ?? Math.min(10, (m.meta.duration || 30) * 0.15);
      const bar = $('.preview-bar', btn);
      let timer, raf;
      const tick = () => { bar.style.width = Math.max(0, (v.currentTime - start) % 12) / 12 * 100 + '%'; raf = requestAnimationFrame(tick); };
      btn.addEventListener('mouseenter', () => {
        if (matchMedia('(hover: none)').matches || btn.closest('.row')) return;
        timer = setTimeout(() => {
          if (!v.src) v.src = m.url + '#t=' + start;
          v.currentTime = start;
          v.play().then(() => { btn.classList.add('previewing'); tick(); }).catch(() => {});
        }, 280);
      });
      btn.addEventListener('mouseleave', () => { clearTimeout(timer); cancelAnimationFrame(raf); btn.classList.remove('previewing'); v.pause(); bar.style.width = 0; });
      v.addEventListener('timeupdate', () => { if (v.currentTime > start + 12) v.currentTime = start; });
    }
    if (m.meta.slides && !btn.closest('.row')) {
      const img = $('img', btn), ticks = $$('.scrub-ticks i', btn), cover = m.meta.cover_slide || 1;
      let cur = cover;
      btn.addEventListener('mouseenter', () => { for (let n = 1; n <= m.meta.slides; n++) new Image().src = slideUrl(m, n); }, { once: true });
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const n = Math.min(m.meta.slides, Math.max(1, Math.ceil((e.clientX - r.left) / r.width * m.meta.slides)));
        if (n === cur) return;
        cur = n; img.src = slideUrl(m, n);
        const k = Math.floor((n - 1) / m.meta.slides * ticks.length);
        ticks.forEach((t, j) => t.classList.toggle('on', j <= k));
        btn.dataset.slide = n;
      });
      btn.addEventListener('mouseleave', () => { cur = cover; img.src = m.cover; ticks.forEach((t) => t.classList.remove('on')); delete btn.dataset.slide; });
    }
  });
}

/* =============================== Выбор =============================== */
function toggleSelect(id, on) {
  on ? S.selected.add(id) : S.selected.delete(id);
  $$(`[data-id="${id}"]`).forEach((el) => {
    el.classList.toggle('selected', on);
    const cb = $('input[data-sel]', el); if (cb) cb.checked = on;
  });
  renderSelbar();
}

function renderSelbar() {
  const bar = $('#selbar');
  document.body.classList.toggle('selecting', S.selected.size > 0);
  $('#uploads').classList.toggle('lift', S.selected.size > 0);
  if (!S.selected.size) { bar.hidden = true; return; }
  const items = [...S.selected].map(byId).filter(Boolean);
  const size = items.reduce((s, m) => s + m.size, 0);
  const mine = items.filter((m) => m.can_edit);
  const visible = visibleItems();
  const allVisible = visible.every((m) => S.selected.has(m.id));
  bar.hidden = false;
  bar.innerHTML = `
    <span class="info"><b>Выбрано: ${items.length}</b><small>${fmtSize(size)}</small></span>
    ${!allVisible ? `<button class="btn small light" data-selall>Выбрать все (${visible.length})</button>` : ''}
    <button class="btn small light" data-selnone>Снять</button>
    ${mine.length ? `<span class="sep"></span><button class="btn small del" data-seldel>${ICON.trash}Удалить${mine.length < items.length ? ` свои (${mine.length})` : ''}</button>` : ''}
    <a class="btn small white" href="/zip?ids=${items.map((m) => m.id).join(',')}" download>${ICON.download}Скачать ZIP</a>`;
}

/* Удаление нескольких выбранных (только админ) */
async function deleteSelected() {
  const items = [...S.selected].map(byId).filter((m) => m && m.can_edit);  // удалить можно только свои (админ — любые)
  if (!items.length) return;
  const list = items.slice(0, 8).map((m) => `<li>${esc(m.title)} <span style="color:var(--steel)">· ${fmtSize(m.size)}</span></li>`).join('')
    + (items.length > 8 ? `<li style="color:var(--steel)">…и ещё ${items.length - 8}</li>` : '');
  const n = items.length;
  const ok = await confirmModal(`Удалить ${n} ${plural(n, 'файл', 'файла', 'файлов')}?`,
    `Восстановить будет нельзя.<ul class="confirm-list">${list}</ul>`,
    `Удалить ${n}`, true);
  if (!ok) return;
  try {
    const r = await api('/api/materials/delete', { ids: items.map((m) => m.id) });
    const gone = new Set(items.map((m) => m.id));
    S.selected.clear();
    for (let i = queue.length - 1; i >= 0; i--) if (gone.has(queue[i].mid)) queue.splice(i, 1);
    renderUploads();
    toast(`Удалено: ${r.deleted}` + (r.skipped ? ` · пропущено чужих: ${r.skipped}` : ''));
    await loadMaterials();
    renderFormats();
  } catch (ex) { toast(ex.message); }
}

/* =============================== Архивы =============================== */
let archTimer;
async function renderFormats() {
  if (!$('#formats')) return;  // панель «Скачать всё» есть только на главной
  let r = { archives: {}, building: false };
  try { r = await api('/api/archives'); } catch (_) { /* без архивов */ }
  const info = r.archives;
  $('#formats').innerHTML = ARCHIVE_FORMATS.map((f) => {
    const a = info[f.ext];
    if (!a) return `<div class="fmt off" style="--c:${f.color}"><span class="tag">${f.label}</span><span><b>Архив .${f.ext}</b><small>${r.building ? 'Собирается…' : 'Недоступен на этом сервере'}</small></span></div>`;
    return `<a class="fmt" style="--c:${f.color}" href="/archives/${encodeURIComponent(a.name)}?dl=1" download title="${esc(a.name)}">
      <span class="tag">${f.label}</span>
      <span><b>Архив .${f.ext}</b><small>${f.hint}</small></span>
      <span class="go">${fmtSize(a.size)}${ICON.download}</span></a>`;
  }).join('');
  const any = Object.values(info)[0];
  $('#pack-sub').innerHTML = r.building
    ? '<span class="spin"></span>Архивы обновляются…'
    : any ? `${S.items.length} ${plural(S.items.length, 'файл', 'файла', 'файлов')} · обновлено ${fmtDay(any.mtime)}` : 'Архивы ещё не собраны';
  if (r.error && S.isAdmin) $('#pack-sub').innerHTML += ` <span style="color:#ff8a8a">· ошибка сборки</span>`;
  clearTimeout(archTimer);
  if (r.building) archTimer = setTimeout(renderFormats, 5000);
}

/* =============================== Просмотрщики =============================== */
function viewer(m, sub, stageHtml, { stageClass = '', strip = '' } = {}) {
  closeViewer();
  const el = document.createElement('div');
  el.className = 'viewer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="viewer-head">
      <div class="t"><b>${esc(m.title)}</b><span>${sub}</span></div>
      <button class="btn small light" data-vlink title="Скопировать ссылку">${ICON.link}<span class="label">Ссылка</span></button>
      <a class="btn small btn-dl" href="${dlUrl(m)}" download>${ICON.download}<span class="label">Скачать · ${fmtSize(m.size)}</span></a>
      <button class="icon-btn" data-x aria-label="Закрыть">${ICON.close}</button>
    </div>
    <div class="stage ${stageClass}">${stageHtml}</div>
    <div class="strip">${strip}</div>`;
  document.body.append(el);
  document.body.style.overflow = 'hidden';
  history.replaceState(null, '', location.pathname + location.search + '#m-' + m.id);
  const handlers = { Escape: closeViewer };
  // клавиши работают и когда в фокусе ползунок плеера (range), но не в текстовых полях
  el._keys = (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const t = e.target instanceof Element ? e.target : document.body;
    if (k === ' ' && t.closest('button, a')) return;  // пробел на кнопке нажмёт саму кнопку
    if (handlers[k] && !e.ctrlKey && !e.metaKey && !e.altKey && !t.matches('textarea, input:not([type=range]), select')) { e.preventDefault(); handlers[k](e); }
  };
  document.addEventListener('keydown', el._keys);
  $('[data-x]', el).onclick = closeViewer;
  $('[data-vlink]', el).onclick = () => copyText(itemLink(m.id));
  $('[data-x]', el).focus();
  return { el, handlers };
}

function closeViewer() {
  const el = $('.viewer');
  if (!el) return;
  document.removeEventListener('keydown', el._keys);
  el._cleanup?.();
  // остановить воспроизведение и загрузку большого видео
  $$('video', el).forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  if (document.fullscreenElement && el.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
  el.remove();
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
}

/* =============================== Видеоплеер =============================== */
Object.assign(ICON, {
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  volLow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  fullExit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  back10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="Arial">10</text></svg>',
  fwd10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="Arial">10</text></svg>',
});

function mountPlayer(box, m, handlers) {
  const savedVol = Math.min(1, Math.max(0, parseFloat(store.get('vol', '0.8')) || 0.8));
  const savedMuted = store.get('muted', '0') === '1';
  box.innerHTML = `
    <div class="pl-screen">
      <video src="${m.url}" ${m.cover ? `poster="${m.cover}"` : ''} playsinline preload="auto"></video>
      <button class="pl-big" aria-label="Смотреть">${ICON.play}</button>
      <span class="pl-spin" hidden></span>
      <button class="pl-unmute" hidden>${ICON.mute}<span>Нажмите, чтобы включить звук</span></button>
      <span class="pl-flash" aria-hidden="true"></span>
    </div>
    <div class="pl-bar">
      <div class="pl-timeline">
        <input type="range" class="pl-seek" min="0" max="1000" step="1" value="0" aria-label="Перемотка">
        <span class="pl-tip" hidden>0:00</span>
      </div>
      <div class="pl-row">
        <button class="pl-btn pl-play" aria-label="Воспроизвести" title="Пауза / воспроизведение (пробел)">${ICON.play}</button>
        <button class="pl-btn" data-skip="-10" aria-label="Назад на 10 секунд" title="Назад 10 с (←)">${ICON.back10}</button>
        <button class="pl-btn" data-skip="10" aria-label="Вперёд на 10 секунд" title="Вперёд 10 с (→)">${ICON.fwd10}</button>
        <span class="pl-time"><b class="pl-cur">0:00</b> / <span class="pl-dur">${fmtDur(m.meta.duration) || '0:00'}</span></span>
        <span class="pl-sp"></span>
        <div class="pl-vol">
          <button class="pl-btn pl-mute" aria-label="Выключить звук" title="Звук вкл / выкл (M)">${ICON.vol}</button>
          <input type="range" class="pl-volume" min="0" max="1" step="0.05" value="${savedVol}" aria-label="Громкость">
        </div>
        <button class="pl-btn pl-speed" aria-label="Скорость воспроизведения" title="Скорость">1×</button>
        <button class="pl-btn pl-full" aria-label="На весь экран" title="На весь экран (F)">${ICON.full}</button>
      </div>
    </div>`;

  const v = $('video', box), seek = $('.pl-seek', box), tip = $('.pl-tip', box), vol = $('.pl-volume', box);
  const playBtn = $('.pl-play', box), muteBtn = $('.pl-mute', box), big = $('.pl-big', box), spin = $('.pl-spin', box);
  const unmute = $('.pl-unmute', box), flash = $('.pl-flash', box), cur = $('.pl-cur', box), dur = $('.pl-dur', box);
  const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
  let scrubbing = false;

  v.volume = savedVol;
  v.muted = savedMuted;

  const pct = (x) => (v.duration ? x / v.duration * 100 : 0);
  const paintSeek = () => {
    const p = scrubbing ? seek.value / 10 : pct(v.currentTime);
    let b = 0;
    for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5) b = Math.max(b, pct(v.buffered.end(i)));
    seek.style.setProperty('--p', p + '%');
    seek.style.setProperty('--b', Math.max(b, p) + '%');
    if (!scrubbing) seek.value = Math.round(p * 10);
    seek.setAttribute('aria-valuetext', `${fmtDur(v.currentTime) || '0:00'} из ${fmtDur(v.duration)}`);
  };
  const paintTime = () => { cur.textContent = fmtDur(v.currentTime) || '0:00'; };
  const paintPlay = () => {
    const playing = !v.paused && !v.ended;
    playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
    box.classList.toggle('playing', playing);
    big.hidden = playing;
  };
  const paintVol = () => {
    const silent = v.muted || v.volume === 0;
    muteBtn.innerHTML = silent ? ICON.mute : v.volume < 0.5 ? ICON.volLow : ICON.vol;
    muteBtn.setAttribute('aria-label', silent ? 'Включить звук' : 'Выключить звук');
    muteBtn.classList.toggle('off', silent);
    vol.value = v.muted ? 0 : v.volume;
    vol.style.setProperty('--p', (v.muted ? 0 : v.volume) * 100 + '%');
    if (!silent) unmute.hidden = true;
  };
  const showFlash = (icon) => { flash.innerHTML = icon; flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); };

  const toggle = () => { if (v.paused || v.ended) v.play().catch(() => {}); else v.pause(); };
  const skip = (s) => { v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration || 0); paintSeek(); paintTime(); showFlash(s < 0 ? ICON.back10 : ICON.fwd10); };
  const setMuted = (mu) => {
    v.muted = mu;
    if (!mu && v.volume === 0) v.volume = 0.6;
    store.set('muted', mu ? '1' : '0');
    paintVol();
    showFlash(mu ? ICON.mute : ICON.vol);
  };
  const setVol = (x) => { v.volume = Math.min(1, Math.max(0, x)); v.muted = v.volume === 0; store.set('vol', String(v.volume)); store.set('muted', v.muted ? '1' : '0'); paintVol(); };
  const full = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else (box.requestFullscreen ? box.requestFullscreen() : Promise.reject()).catch(() => v.webkitEnterFullscreen?.());
  };

  // события видео
  v.addEventListener('loadedmetadata', () => { dur.textContent = fmtDur(v.duration); paintSeek(); });
  v.addEventListener('timeupdate', () => { paintTime(); if (!scrubbing) paintSeek(); });
  v.addEventListener('progress', paintSeek);
  ['play', 'pause', 'ended'].forEach((e) => v.addEventListener(e, paintPlay));
  v.addEventListener('volumechange', paintVol);
  v.addEventListener('waiting', () => { spin.hidden = false; });
  ['playing', 'canplay', 'seeked'].forEach((e) => v.addEventListener(e, () => { spin.hidden = true; }));

  // клики
  playBtn.onclick = toggle;
  big.onclick = toggle;
  v.addEventListener('click', toggle);
  v.addEventListener('dblclick', full);
  $$('[data-skip]', box).forEach((b) => b.onclick = () => skip(+b.dataset.skip));
  muteBtn.onclick = () => setMuted(!(v.muted || v.volume === 0));
  unmute.onclick = () => setMuted(false);
  vol.addEventListener('input', () => setVol(+vol.value));
  $('.pl-speed', box).onclick = (e) => {
    const next = SPEEDS[(SPEEDS.indexOf(v.playbackRate) + 1) % SPEEDS.length];
    v.playbackRate = next;
    e.currentTarget.textContent = String(next).replace('.', ',') + '×';
  };
  $('.pl-full', box).onclick = full;
  const onFs = () => {
    const fs = document.fullscreenElement === box;
    box.classList.toggle('fs', fs);
    $('.pl-full', box).innerHTML = fs ? ICON.fullExit : ICON.full;
  };
  document.addEventListener('fullscreenchange', onFs);

  // таймлайн: перемотка и подсказка времени при наведении
  seek.addEventListener('input', () => { scrubbing = true; const t = seek.value / 1000 * (v.duration || 0); cur.textContent = fmtDur(t) || '0:00'; paintSeek(); });
  seek.addEventListener('change', () => { v.currentTime = seek.value / 1000 * (v.duration || 0); scrubbing = false; paintSeek(); });
  seek.addEventListener('pointermove', (e) => {
    if (!v.duration) return;
    const r = seek.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - r.left), r.width);
    tip.hidden = false;
    tip.textContent = fmtDur(x / r.width * v.duration) || '0:00';
    tip.style.left = x + 'px';
  });
  seek.addEventListener('pointerleave', () => { tip.hidden = true; });

  // панель прячется только в полноэкранном режиме, если мышь не двигается
  let idle;
  const wake = () => { box.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => { if (!v.paused && box.classList.contains('fs')) box.classList.add('idle'); }, 2500); };
  box.addEventListener('pointermove', wake);

  // горячие клавиши
  Object.assign(handlers, {
    ' ': toggle, k: toggle,
    ArrowLeft: () => skip(-5), ArrowRight: () => skip(5),
    ArrowUp: () => { setVol(v.volume + 0.1); showFlash(ICON.vol); },
    ArrowDown: () => { setVol(v.volume - 0.1); showFlash(v.volume === 0 ? ICON.mute : ICON.volLow); },
    m: () => setMuted(!(v.muted || v.volume === 0)),
    f: full,
  });

  box.closest('.viewer')._cleanup = () => { document.removeEventListener('fullscreenchange', onFs); clearTimeout(idle); };

  paintPlay(); paintVol(); paintSeek();
  // Запуск со звуком; если браузер не разрешил — играем без звука и предлагаем включить
  v.play().catch(() => {
    v.muted = true;
    v.play().then(() => { unmute.hidden = false; }).catch(() => paintPlay());
  });
  box.focus({ preventScroll: true });
}

function openMaterial(m, startSlide) {
  if (!m) return;
  const kindName = (KIND[m.kind] || KIND.other).one;
  if (m.kind === 'video' && PLAYABLE.has(m.ext)) {
    const { el, handlers } = viewer(m, [kindName, fmtDur(m.meta.duration), m.meta.quality, m.ext.toUpperCase()].filter(Boolean).join(' · '),
      `<div class="player" tabindex="-1"></div>`, { stageClass: 'video' });
    mountPlayer($('.player', el), m, handlers);
  } else if (m.meta.slides) {
    openSlides(m, startSlide || 1);
  } else if (VIEWABLE_IMG.has(m.ext)) {
    openImages(m);
  } else if (INLINE_DOC.has(m.ext)) {
    viewer(m, `${kindName} · ${m.ext.toUpperCase()} · ${fmtSize(m.size)}`, `<iframe src="${m.url}" title="${esc(m.title)}"></iframe>`, { stageClass: 'doc' });
  } else {
    const k = KIND[m.kind] || KIND.other;
    viewer(m, `${kindName} · ${m.ext.toUpperCase()} · ${fmtSize(m.size)}`, `
      <div class="nopreview">
        ${m.cover ? `<img class="pic" src="${m.cover}" alt="" style="max-height:50vh">` : `<span class="ph" style="--kc:${k.color}"><span class="ico">${k.icon}</span><span class="ext">${esc(m.ext || '?')}</span></span>`}
        <p>${m.description ? esc(m.description) + '<br><br>' : ''}Этот формат открывается после скачивания.</p>
        <a class="btn" href="${dlUrl(m)}" download>${ICON.download}Скачать · ${fmtSize(m.size)}</a>
      </div>`);
  }
}

function openSlides(m, start) {
  const total = m.meta.slides;
  const strip = Array.from({ length: total }, (_, k) =>
    `<button data-n="${k + 1}" aria-label="Слайд ${k + 1}"><img src="${slideUrl(m, k + 1)}" alt="" loading="lazy"><span>${k + 1}</span></button>`).join('');
  const { el, handlers } = viewer(m, `Презентация · ${total} слайдов · <span class="counter"></span>`,
    `<button class="icon-btn nav prev" aria-label="Предыдущий">${ICON.chevL}</button><img class="slide" alt=""><button class="icon-btn nav next" aria-label="Следующий">${ICON.chevR}</button>`,
    { strip });
  let n = start;
  const go = (k) => {
    n = Math.min(total, Math.max(1, k));
    $('img.slide', el).src = slideUrl(m, n);
    $('.counter', el).textContent = `${n} / ${total}`;
    $$('.strip button', el).forEach((b) => b.classList.toggle('on', +b.dataset.n === n));
    $(`.strip button[data-n="${n}"]`, el).scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  };
  bindNav(el, handlers, () => go(n - 1), () => go(n + 1));
  handlers.Home = () => go(1); handlers.End = () => go(total);
  $$('.strip button', el).forEach((b) => b.onclick = () => go(+b.dataset.n));
  go(n);
}

function openImages(m) {
  const pics = filtered().filter((x) => VIEWABLE_IMG.has(x.ext));
  let i = Math.max(0, pics.findIndex((x) => x.id === m.id));
  const strip = pics.length > 1 ? pics.map((p, k) => `<button data-n="${k}" aria-label="${esc(p.title)}"><img src="${p.cover || p.url}" alt="" loading="lazy"></button>`).join('') : '';
  const { el, handlers } = viewer(m, '', `${pics.length > 1 ? `<button class="icon-btn nav prev" aria-label="Предыдущее">${ICON.chevL}</button>` : ''}<img class="pic" alt="">${pics.length > 1 ? `<button class="icon-btn nav next" aria-label="Следующее">${ICON.chevR}</button>` : ''}`, { strip });
  const go = (k) => {
    i = (k + pics.length) % pics.length;
    const p = pics[i];
    $('img.pic', el).src = p.url;
    $('img.pic', el).alt = p.title;
    $('.viewer-head .t', el).innerHTML = `<b>${esc(p.title)}</b><span>Изображение · ${p.ext.toUpperCase()} · ${fmtSize(p.size)}${pics.length > 1 ? ` · <span class="counter">${i + 1} / ${pics.length}</span>` : ''}</span>`;
    $('.viewer-head a.btn-dl', el).href = dlUrl(p);
    $('.viewer-head a.btn-dl .label', el).textContent = 'Скачать · ' + fmtSize(p.size);
    $('[data-vlink]', el).onclick = () => copyText(itemLink(p.id));
    history.replaceState(null, '', location.pathname + location.search + '#m-' + p.id);
    $$('.strip button', el).forEach((b) => b.classList.toggle('on', +b.dataset.n === i));
  };
  if (pics.length > 1) {
    bindNav(el, handlers, () => go(i - 1), () => go(i + 1));
    $$('.strip button', el).forEach((b) => b.onclick = () => go(+b.dataset.n));
  }
  go(i);
}

function bindNav(el, handlers, prev, next) {
  const p = $('.nav.prev', el), n = $('.nav.next', el);
  if (p) p.onclick = prev;
  if (n) n.onclick = next;
  handlers.ArrowLeft = prev; handlers.ArrowRight = next;
  let x0 = null;
  const st = $('.stage', el);
  st.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  st.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    x0 = null;
  });
}

/* =============================== Загрузка (админ) =============================== */
const queue = [];
let uploading = false;

function pickFiles() { $('#file-input').click(); }

/* Окно «Загрузить файлы»: большая зона, понятная без инструкций */
function openUploadModal() {
  if (!S.canUpload) return;
  const types = [['video', 'Видео'], ['pres', 'Презентации'], ['doc', 'PDF и документы'], ['image', 'Картинки'], ['cad', 'Чертежи и 3D'], ['other', 'Любые другие']];
  const m = modal(`
    <div class="modal-head"><h3>Загрузить файлы</h3></div>
    <div class="modal-body">
      <label class="upzone" id="upzone" tabindex="0">
        <span class="upzone-ico">${ICON.upload}</span>
        <b>Перетащите файлы сюда</b>
        <span>или <u>выберите на компьютере</u> — можно сразу несколько</span>
        <input type="file" multiple hidden id="upzone-input">
      </label>
      <div class="uptypes">${types.map(([k, n]) => `<span style="--kc:${KIND[k].color}"><i></i>${n}</span>`).join('')}</div>
      <p class="hint-small">До ${fmtSize(S.maxUpload)} на файл.</p>
    </div>`);
  m.el.querySelector('.modal').classList.add('wide');
  const zone = $('#upzone', m.el), input = $('#upzone-input', m.el);
  const take = (files) => { if (files.length) { m.close(); enqueue(files); } };
  input.onchange = () => take([...input.files]);
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('over'); $('#drop').hidden = true; take([...e.dataTransfer.files]); });
  setTimeout(() => zone.focus(), 50);
}

function enqueue(files) {
  if (!S.canUpload || !files.length) return;
  for (const f of files) {
    if (f.size > S.maxUpload) { toast(`«${f.name}» больше ${fmtSize(S.maxUpload)} — пропущен`); continue; }
    queue.push({ file: f, id: Math.random().toString(36).slice(2), state: 'wait', loaded: 0 });
  }
  renderUploads();
  pump();
}

function renderUploads() {
  const box = $('#uploads');
  if (!queue.length) { box.hidden = true; return; }
  box.hidden = false;
  const active = queue.filter((q) => q.state === 'wait' || q.state === 'up').length;
  const done = queue.filter((q) => q.state === 'done').length;
  box.innerHTML = `
    <div class="up-head"><b>${active ? `Загрузка: ${done} из ${queue.length}` : `Загружено: ${done} из ${queue.length}`}</b>
      <button class="ib" data-upmin aria-label="Свернуть">${ICON.minus}</button>
      ${active ? '' : `<button class="ib" data-upclose aria-label="Закрыть">${ICON.close}</button>`}</div>
    <div class="up-list">${queue.map((q) => {
      const k = KIND[kindOf(q.file.name)];
      const pct = q.file.size ? Math.round(q.loaded / q.file.size * 100) : 100;
      const st = { wait: 'В очереди', up: `${pct}% · ${fmtSize(q.loaded)} из ${fmtSize(q.file.size)}${q.speed ? ' · ' + fmtSize(q.speed) + '/с' : ''}`, cover: 'Делаем обложку…', done: 'Готово', err: q.error || 'Ошибка' }[q.state];
      return `<div class="up ${q.state}" style="--kc:${k.color}">
        <span class="ico">${esc(q.file.name.split('.').pop().slice(0, 4))}</span>
        <div><div class="n" title="${esc(q.file.name)}">${esc(q.file.name)}</div><div class="st">${st}</div><div class="bar"><i style="width:${q.state === 'done' ? 100 : pct}%"></i></div></div>
        ${q.state === 'done' && q.mid ? `<button class="ib" data-edit="${q.mid}" title="Изменить название и описание" aria-label="Изменить">${ICON.edit}</button>` : q.state === 'done' ? `<span class="ok">${ICON.check}</span>` : '<span></span>'}
      </div>`;
    }).join('')}</div>`;
}

async function pump() {
  if (uploading) return;
  const q = queue.find((x) => x.state === 'wait');
  if (!q) { await loadMaterials(); renderFormats(); return; }
  uploading = true;
  try {
    // файл грузится сразу; обложка и длительность готовятся параллельно и дописываются в фоне —
    // очередь загрузки их не ждёт
    const coverJob = withTimeout(makeCover(q.file), 45000).catch(() => null);
    q.state = 'up'; renderUploads();
    const m = await putFile(q);
    q.mid = m.id;
    q.state = 'done';
    coverJob.then(async (extra) => {
      if (!extra) return;
      if (extra.blob) {
        await fetch(`/api/materials/${m.id}/cover`, { method: 'PUT', headers: { 'X-Requested-With': 'hettich', 'Content-Type': 'image/jpeg' }, body: extra.blob });
      }
      if (extra.meta) await api(`/api/materials/${m.id}`, { meta: extra.meta });
      if (!uploading) loadMaterials();  // обновить карточку с новой обложкой
    }).catch(() => {});
  } catch (ex) {
    q.state = 'err'; q.error = ex.message;
  }
  uploading = false;
  renderUploads();
  pump();
}

function putFile(q) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/upload?name=' + encodeURIComponent(q.file.name));
    xhr.setRequestHeader('X-Requested-With', 'hettich');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    let lastT = performance.now(), lastB = 0, shown = 0;
    xhr.upload.onprogress = (e) => {
      q.loaded = e.loaded;
      const t = performance.now();
      if (t - lastT > 700) { q.speed = (e.loaded - lastB) / ((t - lastT) / 1000); lastT = t; lastB = e.loaded; }
      if (t - shown > 250) { shown = t; renderUploads(); }
    };
    xhr.onload = () => {
      let r = {};
      try { r = JSON.parse(xhr.responseText); } catch (_) { /* */ }
      xhr.status === 200 ? resolve(r) : reject(new Error(r.error || 'Ошибка ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Нет связи с сервером'));
    xhr.send(q.file);
  });
}

/* Обложка: кадр из видео или уменьшенная картинка — делается прямо в браузере */
function drawCanvas(src, w, h, maxW = 1280, bg = null) {
  const k = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toJpeg = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
function canvasJpeg(src, w, h, maxW = 1280) { return toJpeg(drawCanvas(src, w, h, maxW, '#fff')); }

/* Кадр «пустой», если он почти одноцветный или прозрачный (браузер не успел его отрисовать) */
function isBlank(c) {
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  const step = Math.max(4, Math.floor(d.length / 4 / 400) * 4);
  let min = 255, max = 0, opaque = 0;
  for (let i = 0; i < d.length; i += step) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    min = Math.min(min, l); max = Math.max(max, l);
    if (d[i + 3] > 200) opaque++;
  }
  return opaque === 0 || max - min < 6;
}

/* Дождаться, пока кадр видео реально отрисован (в скрытой вкладке браузер может этого не делать) */
function frameReady(v) {
  return new Promise((ok) => {
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => ok());
    else requestAnimationFrame(() => requestAnimationFrame(ok));
    setTimeout(ok, 1500);
  });
}

async function makeCover(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const url = URL.createObjectURL(file);
  try {
    if (PLAYABLE.has(ext)) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      await withTimeout(new Promise((ok, bad) => { v.onloadedmetadata = ok; v.onerror = bad; }), 15000);
      const h = v.videoHeight;
      const meta = { duration: Math.round(v.duration * 10) / 10, width: v.videoWidth, height: h,
        quality: h >= 2160 ? '4K' : h >= 1080 ? 'Full HD' : h >= 720 ? 'HD' : 'SD' };
      // пробуем несколько моментов: начало ролика часто чёрное или белое
      for (const frac of [0.25, 0.5, 0.1]) {
        const t = Math.min(v.duration * frac, 30);
        try {
          await withTimeout(new Promise((ok) => { v.onseeked = ok; v.currentTime = t; }), 6000);
          await frameReady(v);
          let c = drawCanvas(v, v.videoWidth, v.videoHeight);
          if (isBlank(c)) {  // подтолкнуть декодер коротким воспроизведением
            await v.play().catch(() => {}); await new Promise((r) => setTimeout(r, 350)); v.pause();
            await frameReady(v);
            c = drawCanvas(v, v.videoWidth, v.videoHeight);
          }
          if (!isBlank(c)) return { blob: await toJpeg(c), meta: { ...meta, preview: Math.round(v.currentTime) } };
        } catch (_) { /* следующий момент */ }
      }
      return { blob: null, meta };  // без обложки — покажется аккуратная заглушка, но длительность сохранится
    }
    if (VIEWABLE_IMG.has(ext) && ext !== 'svg') {
      const img = new Image();
      img.src = url;
      await withTimeout(img.decode(), 15000);
      const blob = await canvasJpeg(img, img.naturalWidth, img.naturalHeight, 960);
      return { blob, meta: { width: img.naturalWidth, height: img.naturalHeight } };
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error('timeout')), ms))]);

/* =============================== Редактирование (админ) =============================== */
function editModal(m) {
  const k = KIND[m.kind] || KIND.other;
  const md = modal(`
    <div class="modal-head"><h3>Материал</h3><p class="file-info">${esc(m.file)} · ${fmtSize(m.size)}${m.uploader ? ` · загрузил(а) ${esc(m.uploader)}` : ''}</p></div>
    <form class="modal-body">
      <div class="field"><label for="e-title">Название</label><input class="input" id="e-title" value="${esc(m.title)}" maxlength="200" required></div>
      <div class="field"><label for="e-desc">Описание <span class="muted" style="font-weight:400;color:var(--steel)">(необязательно)</span></label><textarea class="input" id="e-desc" maxlength="2000" placeholder="Коротко: что это и когда пригодится">${esc(m.description)}</textarea></div>
      <div class="field"><label for="e-kind">Раздел</label>
        <select class="input" id="e-kind">${Object.entries(KIND).map(([key, v]) => `<option value="${key}" ${key === m.kind ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Обложка</label>
        <div class="cover-edit">
          <span class="thumb ${m.cover ? 'has-img' : ''}" style="--kc:${k.color}">${m.cover ? `<img src="${m.cover}" alt="">` : `<span class="ph"><span class="ext">${esc(m.ext)}</span></span>`}</span>
          <div><label class="btn small light" style="cursor:pointer">${ICON.image}Заменить картинкой<input type="file" accept="image/*" id="e-cover" hidden></label>
          <div class="hint" style="margin-top:8px">JPG или PNG, горизонтальная.</div></div>
        </div></div>
      ${S.isAdmin ? `<label class="check"><input type="checkbox" id="e-pin" ${m.pinned ? 'checked' : ''}>Закрепить на главной большой карточкой</label>` : ''}
      <div class="form-error" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="btn danger" data-del>${ICON.trash}Удалить</button>
        <button class="btn" type="submit">Сохранить</button>
      </div>
    </form>`);
  md.el.querySelector('.modal').classList.add('wide');
  const f = $('form', md.el), err = $('.form-error', f);
  let newCover = null;
  $('#e-cover', f).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      newCover = await canvasJpeg(img, img.naturalWidth, img.naturalHeight, 1280);
      URL.revokeObjectURL(url);
      const th = $('.cover-edit .thumb', f);
      th.classList.add('has-img');
      th.innerHTML = `<img src="${URL.createObjectURL(newCover)}" alt="">`;
    } catch (_) { err.textContent = 'Не получилось прочитать картинку'; }
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    try {
      await api(`/api/materials/${m.id}`, { title: $('#e-title', f).value, description: $('#e-desc', f).value, kind: $('#e-kind', f).value, ...(S.isAdmin ? { pinned: $('#e-pin', f).checked } : {}) });
      if (newCover) {
        const r = await fetch(`/api/materials/${m.id}/cover`, { method: 'PUT', headers: { 'X-Requested-With': 'hettich', 'Content-Type': 'image/jpeg' }, body: newCover });
        if (!r.ok) throw new Error((await r.json()).error);
      }
      md.close();
      toast('Сохранено');
      loadMaterials();
    } catch (ex) { err.textContent = ex.message; }
  };
  $('[data-del]', f).onclick = async () => {
    md.close();
    if (!await confirmModal('Удалить файл?', `«${esc(m.title)}» будет удалён. Восстановить будет нельзя.`, 'Удалить', true)) return;
    try {
      await api(`/api/materials/${m.id}/delete`, {});
      S.selected.delete(m.id);
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].mid === m.id) queue.splice(i, 1);
      renderUploads();
      toast('Удалено');
      await loadMaterials();
      renderFormats();
    } catch (ex) { toast(ex.message); }
  };
}

/* =============================== События =============================== */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('.tab');
    if (tab) {
      S.kind = tab.dataset.k;
      renderTabs(); renderItems(); renderSelbar();
      const tb = $('#toolbar');
      if (window.scrollY > tb.offsetTop) window.scrollTo({ top: tb.offsetTop, behavior: 'smooth' });
      return;
    }
    const opener = t.closest('[data-open]');
    if (opener && !t.closest('.sel')) {
      const m = byId(opener.dataset.open);
      return openMaterial(m, opener.dataset.slide ? +opener.dataset.slide : (m?.meta.cover_slide || 1));
    }
    if (t.closest('[data-link]')) return copyText(itemLink(t.closest('[data-link]').dataset.link));
    if (t.closest('[data-edit]')) return editModal(byId(t.closest('[data-edit]').dataset.edit));
    if (t.closest('[data-clear]')) { S.q = ''; $('#hq').value = ''; S.kind = 'all'; renderTabs(); renderItems(); return; }
    if (t.closest('[data-upload]')) return openUploadModal();
    if (t.closest('[data-selall]')) { visibleItems().forEach((m) => toggleSelect(m.id, true)); return; }
    if (t.closest('[data-selnone]')) { [...S.selected].forEach((id) => toggleSelect(id, false)); return; }
    if (t.closest('[data-seldel]')) return deleteSelected();
    if (t.closest('[data-upmin]')) return $('#uploads').classList.toggle('min');
    if (t.closest('[data-upclose]')) { queue.length = 0; renderUploads(); }
  });
  document.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-sel]');
    if (cb) toggleSelect(+cb.dataset.sel, cb.checked);
  });

  // Панель поиска/сортировки/вида есть только на странице «Все материалы»
  if (PAGE === 'all') {
    // Поиск — в шапке сайта; здесь он фильтрует каталог на лету
    $('#hq').value = S.q;
    window.onHeaderSearch = (q) => { S.q = q; renderItems(); renderSelbar(); };

    $('#sort').value = S.sort;
    $('#sort').onchange = (e) => { S.sort = e.target.value; store.set('sort', S.sort); renderItems(); };
    const vb = $$('.view button');
    vb[0].innerHTML = ICON.grid; vb[1].innerHTML = ICON.list;
    const setView = (v) => { S.view = v; store.set('view', v); vb.forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v)); renderItems(); };
    vb.forEach((b) => b.onclick = () => setView(b.dataset.view));
    vb.forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === S.view));
  }

  // Загрузка: кнопка в шапке открывает окно, файлы можно и просто перетащить в браузер
  if (S.canUpload) {
    window.openUpload = openUploadModal;
    $('#file-input').onchange = (e) => { enqueue([...e.target.files]); e.target.value = ''; };
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; $('#drop').hidden = false; });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('#drop').hidden = true; } });
    window.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; $('#drop').hidden = true; enqueue([...e.dataTransfer.files]); });
    window.addEventListener('beforeunload', (e) => { if (queue.some((q) => q.state === 'wait' || q.state === 'up' || q.state === 'cover')) { e.preventDefault(); e.returnValue = ''; } });
  }
}

/* =============================== Запуск =============================== */
if (PAGE === 'all') {  // фильтр из адреса: /all?kind=video&q=кухня
  const p = new URLSearchParams(location.search);
  if (KIND[p.get('kind')]) S.kind = p.get('kind');
  S.q = (p.get('q') || '').trim();
}

mountTopbar(PAGE === 'all' ? 'all' : 'home').then(async (me) => {
  S.me = me;
  await loadMaterials();
  bindEvents();
  renderFormats();
  // Пришли по кнопке «Загрузить» с другой страницы: /all?upload=1
  const p = new URLSearchParams(location.search);
  if (p.get('upload') === '1') {
    p.delete('upload');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
    if (S.canUpload) openUploadModal();
  }
  const m = location.hash.match(/^#m-(\d+)/);
  if (m && byId(m[1])) openMaterial(byId(m[1]));
});
