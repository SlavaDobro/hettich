/* Демо-версия для GitHub Pages.
   Настоящего сервера нет: этот файл отвечает на те же запросы (/api/...), что и server.py,
   а данные хранит только в браузере зрителя (localStorage + IndexedDB для файлов).
   Подключается перед common.js только в сборке для GitHub Pages (deploy/build-pages.py). */
(function () {
  'use strict';

  window.DEMO = true;
  window.SITE = {
    home: 'index.html', all: 'all.html', admin: 'admin.html', login: 'login.html',
    assets: 'demo/assets', zip: '#demo-zip', archives: '#demo-archives',
  };

  const KEY = 'hm-demo-v1';
  const DAY = 86400;
  const now = () => Math.floor(Date.now() / 1000);
  const PAGE = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  /* ---------------- хранилище ---------------- */
  let memState = null;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (_) { /* приватный режим */ }
    return memState;
  }
  function save(s) { memState = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* без сохранения */ } }

  const blobs = (() => {  // файлы, загруженные зрителем, — в IndexedDB (или в памяти, если она недоступна)
    const mem = new Map();
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, bad) => {
      try {
        const r = indexedDB.open('hm-demo', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('b');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => bad(r.error);
      } catch (e) { bad(e); }
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((ok, bad) => { const t = db.transaction('b', mode); const req = fn(t.objectStore('b')); t.oncomplete = () => ok(req && req.result); t.onerror = () => bad(t.error); });
    };
    return {
      put: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => mem.set(k, v)),
      get: (k) => tx('readonly', (s) => s.get(k)).then((v) => v || mem.get(k)).catch(() => mem.get(k)),
      del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => mem.delete(k)),
      clear: () => tx('readwrite', (s) => s.clear()).catch(() => mem.clear()),
    };
  })();

  /* ---------------- стартовые (вымышленные) данные ---------------- */
  function seed() {
    const t = now();
    const users = [
      { id: 1, login: 'admin', name: 'Главный администратор', position: '', role: 'admin', can_upload: 1, active: 1, created_at: t - 40 * DAY, last_login: t - 600 },
      { id: 2, login: 'a.dizaynerova', name: 'Анна Дизайнерова', position: 'Дизайнер интерьера', role: 'user', can_upload: 1, active: 1, created_at: t - 30 * DAY, last_login: t - DAY },
      { id: 3, login: 'b.menedzherov', name: 'Борис Менеджеров', position: 'Менеджер', role: 'user', can_upload: 0, active: 1, created_at: t - 25 * DAY, last_login: t - 3 * DAY },
      { id: 4, login: 'v.adminova', name: 'Вера Админова', position: 'Руководитель', role: 'admin', can_upload: 1, active: 1, created_at: t - 20 * DAY, last_login: t - 5 * DAY },
      { id: 5, login: 'g.novichkov', name: 'Глеб Новичков', position: 'Стажёр', role: 'user', can_upload: 1, active: 1, created_at: t - DAY, last_login: null, must_change: 1 },
    ];
    const F = (file) => 'demo/files/' + file;
    const materials = [
      { id: 1, file: 'Demo_rolik.webm', title: 'Демо-ролик: полезные материалы', description: 'Короткое видео для примера — попробуйте плеер: таймлайн, звук, скорость, полный экран.', kind: 'video', size: 2157167, src: F('Demo_rolik.webm'), cover: 'demo/assets/covers/demo-rolik.jpg', meta: { duration: 12, quality: 'HD', preview: 3 }, pinned: 1, created_at: t - 2 * DAY, uploaded_by: 1 },
      { id: 2, file: 'Primer_prezentacii.pptx', title: 'Пример презентации', description: 'Ведите курсором по обложке — слайды листаются. Нажмите, чтобы открыть просмотр.', kind: 'pres', size: 18432000, src: null, cover: 'demo/assets/slides/slide01.svg', meta: { slides: 6, slides_dir: 'slides', slide_ext: 'svg', cover_slide: 1 }, pinned: 1, created_at: t - 3 * DAY, uploaded_by: 1 },
      { id: 3, file: 'Kuhnya_demo.png', title: 'Кухня — демо-визуализация', description: '', kind: 'image', size: 174288, src: F('Kuhnya_demo.png'), cover: null, meta: { width: 1600, height: 1000 }, pinned: 0, created_at: t - 1 * DAY, uploaded_by: 2 },
      { id: 4, file: 'Garderob_demo.png', title: 'Гардероб — демо-визуализация', description: '', kind: 'image', size: 134821, src: F('Garderob_demo.png'), cover: null, meta: { width: 1600, height: 1000 }, pinned: 0, created_at: t - 4 * DAY, uploaded_by: 2 },
      { id: 5, file: 'Gostinaya_demo.png', title: 'Гостиная — демо-визуализация', description: '', kind: 'image', size: 168007, src: F('Gostinaya_demo.png'), cover: null, meta: { width: 1600, height: 1000 }, pinned: 0, created_at: t - 12 * DAY, uploaded_by: 4 },
      { id: 6, file: 'Demo_katalog.pdf', title: 'Демо-каталог', description: 'PDF открывается прямо в браузере.', kind: 'doc', size: 726, src: F('Demo_katalog.pdf'), cover: null, meta: {}, pinned: 0, created_at: t - 6 * DAY, uploaded_by: 1 },
      { id: 7, file: 'Artikuly_demo.txt', title: 'Артикулы (пример)', description: 'Текстовые файлы тоже открываются в браузере.', kind: 'doc', size: 264, src: F('Artikuly_demo.txt'), cover: null, meta: {}, pinned: 0, created_at: t - 9 * DAY, uploaded_by: 2 },
      { id: 8, file: 'Shema_kuhni_demo.dwg', title: 'Схема кухни (чертёж)', description: 'Чертежи браузер не показывает — их скачивают.', kind: 'cad', size: 412000, src: null, cover: null, meta: {}, pinned: 0, created_at: t - 15 * DAY, uploaded_by: 4 },
    ];
    const downloads = [
      { user_id: 2, path: 'files/Demo_rolik.webm', at: t - DAY }, { user_id: 3, path: 'files/Demo_rolik.webm', at: t - 2 * DAY },
      { user_id: 2, path: 'files/Primer_prezentacii.pptx', at: t - DAY }, { user_id: 3, path: 'archives/Hettich_Poleznye_materialy.zip', at: t - 3 * DAY },
      { user_id: 4, path: 'files/Demo_katalog.pdf', at: t - 5 * DAY },
    ];
    return { v: 1, session: null, users, materials, downloads, nextUser: 6, nextMat: 9, recovery: t - 10 * DAY };
  }

  let S = load();
  if (!S) { S = seed(); save(S); }

  /* ---------------- вход: в демо без пароля ---------------- */
  if (PAGE === 'login') {
    if (S.session) location.replace(SITE.home);
  } else if (!S.session) {
    location.replace(SITE.login);
  } else if (PAGE === 'admin' && me().role !== 'admin') {
    location.replace(SITE.home);
  }

  function me() { return S.users.find((u) => u.id === S.session) || null; }
  const mayUpload = (u) => u.role === 'admin' || !!u.can_upload;
  const mayEdit = (u, m) => u.role === 'admin' || m.uploaded_by === u.id;
  const userPublic = (u) => ({
    id: u.id, login: u.login, name: u.name, position: u.position, role: u.role, active: u.active,
    must_change: 0, created_at: u.created_at, last_login: u.last_login,
    has_recovery: u.id === 1 ? !!S.recovery : false, recovery_created: u.id === 1 ? S.recovery : null,
    can_upload: mayUpload(u),
  });

  const ALPH = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = (n, a = ALPH) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => a[x % a.length]).join('');
  const genPassword = () => [rnd(4), rnd(4), rnd(4)].join('-');
  const kindOf = (name) => {
    const e = (name.split('.').pop() || '').toLowerCase();
    const map = { video: 'mp4 m4v mov webm avi mkv wmv', pres: 'pptx ppt pps ppsx potx key odp', image: 'jpg jpeg png gif webp svg bmp tif tiff heic avif psd ai eps', doc: 'pdf doc docx xls xlsx csv txt rtf odt ods md', cad: 'dwg dxf skp 3ds max obj fbx step stp igs iges stl 3dm blend glb gltf' };
    return Object.keys(map).find((k) => map[k].split(' ').includes(e)) || 'other';
  };
  const titleFrom = (name) => { const b = name.replace(/\.[^.]+$/, '').replace(/[_\s]+/g, ' ').trim(); return b ? b[0].toUpperCase() + b.slice(1) : name; };

  /* URL файла и обложки: статический демо-файл или файл зрителя из IndexedDB */
  const urlCache = new Map();
  const fileByUrl = new Map();  // адрес → имя файла (для скачивания с правильным именем)
  async function blobUrl(key) {
    if (urlCache.has(key)) return urlCache.get(key);
    const b = await blobs.get(key);
    const u = b ? URL.createObjectURL(b) : null;
    urlCache.set(key, u);
    return u;
  }
  async function materialJson(m, u) {
    const url = m.src || (m.blob ? await blobUrl('f' + m.id) : null);
    if (url) fileByUrl.set(url, m.file);
    let cover = m.coverBlob ? await blobUrl('c' + m.id) : m.cover;
    if (!cover && m.meta.slides) cover = `${SITE.assets}/${m.meta.slides_dir}/slide01.${m.meta.slide_ext || 'jpg'}`;
    const up = S.users.find((x) => x.id === m.uploaded_by);
    return {
      id: m.id, file: m.file, title: m.title, description: m.description, kind: m.kind,
      ext: (m.file.split('.').pop() || '').toLowerCase(), size: m.size, cover, meta: m.meta, pinned: !!m.pinned,
      created_at: m.created_at, url: url || '#demo-nofile', can_edit: mayEdit(u, m), uploader: up ? up.name : null,
    };
  }

  /* ---------------- «сервер» ---------------- */
  async function handle(method, path, query, body) {
    const u = me();
    const J = (data, status = 200) => ({ status, data });
    const E = (error, status) => ({ status, data: { error } });

    if (path === '/api/login' && method === 'POST') {  // в демо вход по кнопке: { as: 'admin' | 'user' }
      S.session = body.as === 'user' ? 2 : 1;
      const x = me(); x.last_login = now(); save(S);
      return J({ ok: true, must_change: false });
    }
    if (!u) return E('unauthorized', 401);

    if (path === '/api/me') return J(userPublic(u));
    if (path === '/api/logout') { S.session = null; save(S); return J({ ok: true }); }
    if (path === '/api/password') return J({ ok: true });

    if (path === '/api/materials' && method === 'GET') {
      const list = [...S.materials].sort((a, b) => b.pinned - a.pinned || b.created_at - a.created_at);
      return J({ materials: await Promise.all(list.map((m) => materialJson(m, u))), is_admin: u.role === 'admin', can_upload: mayUpload(u), max_upload: 500 * 1024 * 1024 });
    }
    if (path === '/api/archives') {
      const size = S.materials.reduce((s, m) => s + m.size, 0) + 4096;
      const a = (ext) => ({ name: 'Hettich_Poleznye_materialy.' + ext, size, mtime: now() - 3600 });
      return J({ archives: { zip: a('zip'), rar: a('rar'), '7z': a('7z') }, building: false, error: '' });
    }
    if (path === '/api/upload' && method === 'PUT') {
      if (!mayUpload(u)) return E('Загрузка файлов для вас отключена — обратитесь к администратору', 403);
      const name = (query.get('name') || 'file').replace(/[\\/:*?"<>|]/g, '_');
      const id = S.nextMat++;
      await blobs.put('f' + id, body);
      S.materials.push({ id, file: name, title: titleFrom(name), description: '', kind: kindOf(name), size: body.size, src: null, blob: true, cover: null, meta: {}, pinned: 0, created_at: now(), uploaded_by: u.id });
      save(S);
      return J(await materialJson(S.materials.find((m) => m.id === id), u));
    }
    let mm = path.match(/^\/api\/materials\/(\d+)\/cover$/);
    if (mm && method === 'PUT') {
      const m = S.materials.find((x) => x.id === +mm[1]);
      if (!m) return E('Материал не найден', 404);
      if (!mayEdit(u, m)) return E('Можно менять только свои файлы', 403);
      await blobs.put('c' + m.id, body); urlCache.delete('c' + m.id);
      m.coverBlob = true; save(S);
      return J({ ok: true });
    }
    if (path === '/api/materials/delete' && method === 'POST') {
      const ids = new Set((body.ids || []).map(Number));
      const target = S.materials.filter((m) => ids.has(m.id));
      const allowed = target.filter((m) => mayEdit(u, m));
      for (const m of allowed) { await blobs.del('f' + m.id); await blobs.del('c' + m.id); }
      S.materials = S.materials.filter((m) => !allowed.includes(m));
      save(S);
      return J({ ok: true, deleted: allowed.length, skipped: target.length - allowed.length });
    }
    mm = path.match(/^\/api\/materials\/(\d+)(?:\/(delete))?$/);
    if (mm && method === 'POST') {
      const m = S.materials.find((x) => x.id === +mm[1]);
      if (!m) return E('Материал не найден', 404);
      if (!mayEdit(u, m)) return E('Можно менять только свои файлы', 403);
      if (mm[2] === 'delete') {
        await blobs.del('f' + m.id); await blobs.del('c' + m.id);
        S.materials = S.materials.filter((x) => x !== m); save(S);
        return J({ ok: true });
      }
      if (body.meta) Object.assign(m.meta, body.meta);
      if (body.title !== undefined) m.title = String(body.title).trim().slice(0, 200) || m.title;
      if (body.description !== undefined) m.description = String(body.description).trim().slice(0, 2000);
      if (body.kind) m.kind = body.kind;
      if (body.pinned !== undefined && u.role === 'admin') m.pinned = body.pinned ? 1 : 0;
      save(S);
      return J(await materialJson(m, u));
    }

    if (path === '/api/recovery-key' && method === 'POST') {
      if (u.role !== 'admin') return E('forbidden', 403);
      if (!body.password) return E('Неверный текущий пароль', 400);  // в демо подойдёт любой непустой
      S.recovery = now(); save(S);
      const K = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
      return J({ ok: true, key: 'HETTICH-' + [0, 1, 2, 3, 4].map(() => rnd(5, K)).join('-'), login: u.login, created: S.recovery });
    }

    // ---- дальше только администратор
    if (u.role !== 'admin') return E('forbidden', 403);
    if (path === '/api/requests') {  // заявки посетителей — в демо вымышленные
      const t = now();
      const items = [
        { id: 3, at: t - 3600, name: 'Ирина Клиентова', email: 'irina@example.ru', phone: '+7 (912) 345-67-89', comment: 'Для выставки', target: 'Демо-ролик: полезные материалы', ip: '', downloaded: 1 },
        { id: 2, at: t - DAY, name: 'Олег Дизайнов', email: 'oleg@example.com', phone: '+7 (921) 000-11-22', comment: 'Для дизайн-проекта', target: 'Всё одним архивом .zip', ip: '', downloaded: 1 },
        { id: 1, at: t - 3 * DAY, name: 'Peter Guest', email: 'peter@example.com', phone: '+44 20 7946 0958', comment: '', target: 'Пример презентации', ip: '', downloaded: 0 },
      ];
      return J({ total: items.length, items });
    }
    if (/^\/api\/requests\/\d+\/delete$/.test(path)) return J({ ok: true });
    if (path === '/api/users' && method === 'GET') {
      const count = (uid) => S.downloads.filter((d) => d.user_id === uid).length;
      const by = {};
      S.downloads.forEach((d) => { by[d.path] = (by[d.path] || 0) + 1; });
      const title = (p) => { const m = S.materials.find((x) => 'files/' + x.file === p); return m ? m.title : null; };
      const users = [...S.users].sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || a.name.localeCompare(b.name, 'ru'));
      return J({
        users: users.map((x) => Object.assign(userPublic(x), { downloads: count(x.id), must_change: x.must_change || 0 })),
        downloads: { total: S.downloads.length, by_file: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, n]) => ({ path: p, n, title: title(p) })) },
        me: u.id,
      });
    }
    if (path === '/api/users' && method === 'POST') {
      const name = String(body.name || '').trim(), login = String(body.login || '').trim();
      if (!name || !/^[\w.@+-]{3,120}$/.test(login)) return E('Укажите имя и логин (латиница, цифры, . @ - _ ; от 3 символов)', 400);
      if (S.users.some((x) => x.login.toLowerCase() === login.toLowerCase())) return E('Такой логин уже есть', 409);
      const id = S.nextUser++;
      S.users.push({ id, login, name, position: String(body.position || '').trim(), role: body.role === 'admin' ? 'admin' : 'user', can_upload: body.can_upload === false ? 0 : 1, active: 1, created_at: now(), last_login: null, must_change: 1 });
      save(S);
      return J({ ok: true, id, login, name, password: genPassword() });
    }
    mm = path.match(/^\/api\/users\/(\d+)\/(reset|active|delete|upload)$/);
    if (mm && method === 'POST') {
      const x = S.users.find((y) => y.id === +mm[1]);
      if (!x) return E('Пользователь не найден', 404);
      const act = mm[2];
      if (act === 'reset') { x.must_change = 1; save(S); return J({ ok: true, login: x.login, name: x.name, password: genPassword() }); }
      if (act === 'upload') { x.can_upload = body.can_upload ? 1 : 0; save(S); return J({ ok: true }); }
      if (x.id === u.id) return E('Нельзя заблокировать или удалить самого себя', 400);
      if (act === 'active') { x.active = body.active ? 1 : 0; save(S); return J({ ok: true }); }
      if (act === 'delete') { S.users = S.users.filter((y) => y !== x); save(S); return J({ ok: true }); }
    }
    return E('not found', 404);
  }

  /* fetch: запросы к /api/ обслуживает демо-«сервер», остальное — как обычно */
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const i = url.pathname.indexOf('/api/');
    if (i === -1) return realFetch(input, init);
    const path = url.pathname.slice(i);
    const method = (init.method || 'GET').toUpperCase();
    let body = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    const r = await handle(method, path, url.searchParams, body || {});
    return new Response(JSON.stringify(r.data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };

  /* XMLHttpRequest — только для загрузки файлов (с имитацией прогресса) */
  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function DemoXHR() {
    const x = { upload: {}, status: 0, responseText: '', _h: {} };
    x.open = (m, u) => { x._m = m; x._u = new URL(u, location.href); };
    x.setRequestHeader = () => {};
    x.send = (body) => {
      const i = x._u.pathname.indexOf('/api/');
      if (i === -1) {  // не наше — настоящий XHR
        const r = new RealXHR(); r.open(x._m, x._u.href);
        r.onload = () => { x.status = r.status; x.responseText = r.responseText; x.onload && x.onload(); };
        r.onerror = () => x.onerror && x.onerror();
        return r.send(body);
      }
      const total = (body && body.size) || 1;
      let loaded = 0;
      const step = Math.max(total / 12, 1);
      const tick = () => {
        loaded = Math.min(total, loaded + step);
        x.upload.onprogress && x.upload.onprogress({ loaded, total, lengthComputable: true });
        if (loaded < total) return setTimeout(tick, 70);
        handle(x._m, x._u.pathname.slice(i), x._u.searchParams, body).then((r) => {
          x.status = r.status; x.responseText = JSON.stringify(r.data); x.onload && x.onload();
        }).catch(() => x.onerror && x.onerror());
      };
      setTimeout(tick, 60);
    };
    return x;
  };

  /* Скачивание: свои и демо-файлы скачиваются, архивы и «пустые» файлы — сообщение */
  document.addEventListener('click', async (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const say = (t) => (window.toast ? window.toast(t) : alert(t));
    if (href.startsWith('#demo-zip') || href.startsWith('#demo-archives')) {
      e.preventDefault();
      say('В демо-версии архивы не скачиваются — на рабочем сайте здесь будет ZIP');
      return;
    }
    if (href.includes('requests.csv')) {
      e.preventDefault();
      say('В демо-версии выгрузка заявок отключена — на рабочем сайте здесь скачается файл для Excel');
      return;
    }
    if (href.startsWith('#demo-nofile')) {
      e.preventDefault();
      say('Это демо-файл без содержимого — на рабочем сайте он скачается');
      return;
    }
    if (href.includes('?dl=1')) {
      e.preventDefault();
      const src = href.replace('?dl=1', '');
      const file = fileByUrl.get(src) || decodeURIComponent(src.split('/').pop());
      const u = me();
      if (u) { S.downloads.push({ user_id: u.id, path: 'files/' + file, at: now() }); save(S); }
      const link = document.createElement('a');
      link.href = src; link.download = file; document.body.append(link); link.click(); link.remove();
    }
  }, true);

  /* Плашка «Демо-версия» с переключателем роли */
  function banner() {
    if (PAGE === 'login') return;
    const u = me();
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `<div class="wrap"><b>Демо-версия</b><span>Данные вымышленные и хранятся только в этом браузере.</span>
      <button type="button" data-demo="role">${u && u.role === 'admin' ? 'Смотреть как сотрудник' : 'Смотреть как администратор'}</button>
      <button type="button" data-demo="reset">Сбросить демо</button></div>`;
    document.body.prepend(bar);
    bar.querySelector('[data-demo="role"]').onclick = () => { S.session = u && u.role === 'admin' ? 2 : 1; save(S); location.href = SITE.home; };
    bar.querySelector('[data-demo="reset"]').onclick = async () => {
      if (!confirm('Вернуть демо к исходному виду? Загруженные вами файлы удалятся.')) return;
      await blobs.clear();
      const fresh = seed(); fresh.session = S.session; S = fresh; save(S);
      location.href = SITE.home;
    };
  }

  /* Страница входа: вместо логина и пароля — две кнопки */
  function loginPage() {
    const form = document.getElementById('form');
    if (!form) return;
    form.hidden = true;
    const box = document.createElement('div');
    box.className = 'form demo-login';
    box.innerHTML = `
      <div class="kicker"><span class="stripes"><i></i><i></i><i></i><i></i></span>Демо-версия</div>
      <h1>Вход</h1>
      <p class="intro">Пароль не нужен: это демонстрация. Все данные вымышленные и остаются в вашем браузере.</p>
      <button class="btn block" type="button" data-as="admin">Войти как администратор</button>
      <button class="btn ghost block" type="button" data-as="user">Войти как сотрудник</button>
      <div class="help">На рабочем сайте здесь вход по логину и паролю от администратора.</div>`;
    form.after(box);
    box.querySelectorAll('[data-as]').forEach((b) => b.onclick = async () => {
      await window.fetch('/api/login', { method: 'POST', body: JSON.stringify({ as: b.dataset.as }) });
      location.href = SITE.home;
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .demo-bar { background: #121212; color: #fff; font: 13px/1.4 var(--font, sans-serif); }
    .demo-bar .wrap { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; min-height: 40px; padding: 6px 0; }
    .demo-bar b { background: var(--s-yellow, #fab900); color: #121212; padding: 2px 8px; border-radius: 3px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .demo-bar span { color: #c9cbd0; margin-right: auto; }
    .demo-bar button { border: 1px solid rgba(255,255,255,.3); background: none; color: #fff; border-radius: 3px; padding: 5px 10px; font: 600 12.5px var(--font, sans-serif); cursor: pointer; }
    .demo-bar button:hover { background: rgba(255,255,255,.12); }
    @media (max-width: 720px) { .demo-bar span { display: none; } .demo-bar b { margin-right: auto; } .demo-bar .wrap { gap: 8px; } }
    .demo-login .btn { height: 50px; font-size: 15px; }
    .demo-login .btn + .btn { margin-top: -6px; }
  `;
  document.head.append(style);

  const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => { if (PAGE === 'login') loginPage(); else banner(); });
})();
