"""Hettich · Полезные материалы — закрытый файлообменник для сотрудников.

Только стандартная библиотека Python 3.9+, без установки пакетов.

    python server.py                      запустить (порт 8765, см. переменные ниже)
    python server.py create-admin LOGIN   создать главного администратора (пароль будет выведен)
    python server.py reset-password LOGIN выдать новый временный пароль

Переменные окружения:
    HOST (127.0.0.1), PORT (8765), SECURE_COOKIES=1 — когда сайт работает по HTTPS,
    TRUST_PROXY=1 — когда перед сервером стоит прокси (Caddy/nginx),
    MAX_UPLOAD_GB (10) — предельный размер одного загружаемого файла.
"""
import contextlib, hashlib, hmac, http.server, json, mimetypes, os, re, secrets, shutil, sqlite3
import subprocess, sys, threading, time, unicodedata, urllib.parse, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "data", "hettich.db")
FILES = os.path.join(ROOT, "files")
ARCHIVES = os.path.join(ROOT, "archives")
COVERS = os.path.join(ROOT, "assets", "covers")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
SECURE = os.environ.get("SECURE_COOKIES") == "1"
# За прокси (Caddy/nginx) настоящий адрес посетителя приходит в X-Forwarded-For.
# Включайте только когда сервер недоступен напрямую, иначе заголовок можно подделать.
TRUST_PROXY = os.environ.get("TRUST_PROXY") == "1"
MAX_UPLOAD = int(float(os.environ.get("MAX_UPLOAD_GB", "10")) * 1024 ** 3)
SESSION_DAYS = 30
COOKIE = "hm_session"
ARCHIVE_NAME = "Hettich_Poleznye_materialy"

PROTECTED = {"assets": "assets", "files": "files", "archives": "archives"}
for ext, t in {".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
               ".7z": "application/x-7z-compressed", ".rar": "application/vnd.rar", ".webp": "image/webp",
               ".avif": "image/avif", ".svg": "image/svg+xml", ".dwg": "image/vnd.dwg",
               ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
               ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
               ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}.items():
    mimetypes.add_type(t, ext)

KINDS = {
    "video": {"mp4", "m4v", "mov", "webm", "avi", "mkv", "wmv"},
    "pres": {"pptx", "ppt", "pps", "ppsx", "potx", "key", "odp"},
    "image": {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tif", "tiff", "heic", "avif", "psd", "ai", "eps"},
    "doc": {"pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf", "odt", "ods", "md"},
    "cad": {"dwg", "dxf", "skp", "3ds", "max", "obj", "fbx", "step", "stp", "igs", "iges", "stl", "3dm", "blend", "glb", "gltf"},
}


def kind_of(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return next((k for k, exts in KINDS.items() if ext in exts), "other")


# Описания для материалов, которые были на сайте с самого начала
SEED = {
    "Hettich_Imidzhevoe_video_2024.mp4": dict(
        title="Имиджевое видео для событий 2024", pinned=1, cover="covers/video-2024.jpg",
        description="Большой фильм о Hettich для выставок, конференций и мероприятий с партнёрами: люди, продукты, производство и ценности бренда.",
        meta={"duration": 505.2, "quality": "Full HD", "preview": 205}),
    "Hettich_Imidzh.mp4": dict(
        title="Имиджевый ролик", cover="covers/video-imidzh.jpg",
        description="Короткий ролик о ценностях бренда: тренды, энтузиазм, решительность.",
        meta={"duration": 69, "quality": "SD", "preview": 14}),
    "Hettich_AvanTech_YOU_Design.mp4": dict(
        title="AvanTech YOU — варианты дизайна", cover="covers/video-avantech.jpg",
        description="Система ящиков AvanTech YOU: цвета, отделки и дизайн-варианты боковин.",
        meta={"duration": 24, "quality": "Full HD", "preview": 4}),
    "Hettich_Proizvodstvo_i_logistika.mp4": dict(
        title="Производство и логистика", cover="covers/video-production.jpg",
        description="Заводы Hettich, автоматизация, роботы и международная логистика.",
        meta={"duration": 60.5, "quality": "HD", "preview": 12}),
    "Hettich_Its_all_in_Hettich_2026.pptx": dict(
        title="It's all in Hettich 2026", pinned=1, cover="",
        description="Корпоративная презентация: история компании с 1888 года, производство, ключевые клиенты, продукты и награды. Видео встроены в файл.",
        meta={"slides": 33, "slides_dir": "slides", "cover_slide": 3}),
}

# ---------------------------------------------------------------- database

@contextlib.contextmanager
def db():
    """Соединение на один запрос: commit при успехе, rollback при ошибке, всегда close."""
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        with con:
            yield con
    finally:
        con.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    for d in (FILES, ARCHIVES, COVERS):
        os.makedirs(d, exist_ok=True)
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            login TEXT UNIQUE NOT NULL COLLATE NOCASE,
            name TEXT NOT NULL,
            position TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
            pw TEXT NOT NULL,
            must_change INTEGER NOT NULL DEFAULT 1,
            active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            created_by INTEGER,
            last_login INTEGER
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY,
            at INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            comment TEXT NOT NULL DEFAULT '',
            target TEXT NOT NULL,
            ip TEXT NOT NULL DEFAULT '',
            downloaded INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            path TEXT NOT NULL,
            at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY,
            file TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            size INTEGER NOT NULL DEFAULT 0,
            cover TEXT NOT NULL DEFAULT '',
            meta TEXT NOT NULL DEFAULT '{}',
            pinned INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        """)
        # Миграция: ключ восстановления администратора (хранится только хеш)
        cols = {r["name"] for r in con.execute("PRAGMA table_info(users)")}
        if "recovery_hash" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN recovery_hash TEXT")
            con.execute("ALTER TABLE users ADD COLUMN recovery_created INTEGER")
        # Миграция: право сотрудника загружать файлы (у администратора есть всегда)
        if "can_upload" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN can_upload INTEGER NOT NULL DEFAULT 1")


def title_from(name):
    base = name.rsplit(".", 1)[0] if "." in name else name
    base = re.sub(r"[_\s]+", " ", base).strip(" -.")
    return base[:1].upper() + base[1:] if base else name


def list_files():
    return sorted(f for f in os.listdir(FILES)
                  if not f.startswith(".") and os.path.isfile(os.path.join(FILES, f)))


def sync_materials():
    """Сверяет таблицу материалов с папкой files/: новые файлы добавляет, исчезнувшие убирает."""
    on_disk = {f: os.stat(os.path.join(FILES, f)) for f in list_files()}
    with db() as con:
        known = {r["file"]: r for r in con.execute("SELECT id, file, size FROM materials")}
        for f, st in on_disk.items():
            if f not in known:
                s = SEED.get(f, {})
                con.execute("""INSERT INTO materials (file, title, description, kind, size, cover, meta, pinned, created_at)
                               VALUES (?,?,?,?,?,?,?,?,?)""",
                            (f, s.get("title") or title_from(f), s.get("description", ""), kind_of(f), st.st_size,
                             s.get("cover", ""), json.dumps(s.get("meta", {}), ensure_ascii=False),
                             s.get("pinned", 0), int(st.st_mtime)))
            elif known[f]["size"] != st.st_size:
                con.execute("UPDATE materials SET size = ? WHERE id = ?", (st.st_size, known[f]["id"]))
        for f, r in known.items():
            if f not in on_disk:
                con.execute("DELETE FROM materials WHERE id = ?", (r["id"],))


def delete_material(con, r):
    """Удаляет файл, его обложку и слайды (если их сделал сайт) и запись в каталоге."""
    with contextlib.suppress(FileNotFoundError):
        os.remove(os.path.join(FILES, r["file"]))
    if re.fullmatch(r"covers/m\d+-\w+\.jpg", r["cover"] or ""):
        with contextlib.suppress(OSError):
            os.remove(os.path.join(ROOT, "assets", r["cover"]))
    meta = json.loads(r["meta"] or "{}")
    if re.fullmatch(r"slides/m\d+", meta.get("slides_dir") or ""):
        shutil.rmtree(os.path.join(ROOT, "assets", meta["slides_dir"]), ignore_errors=True)
    con.execute("DELETE FROM materials WHERE id = ?", (r["id"],))


def material_json(r):
    meta = json.loads(r["meta"] or "{}")
    cover = ("/assets/" + r["cover"]) if r["cover"] else None
    if not cover and meta.get("slides"):
        cover = "/assets/%s/slide%02d.jpg" % (meta["slides_dir"], meta.get("cover_slide", 1))
    return {"id": r["id"], "file": r["file"], "title": r["title"], "description": r["description"],
            "kind": r["kind"], "ext": r["file"].rsplit(".", 1)[-1].lower() if "." in r["file"] else "",
            "size": r["size"], "cover": cover, "meta": meta, "pinned": bool(r["pinned"]),
            "created_at": r["created_at"], "url": "/files/" + urllib.parse.quote(r["file"])}


BAD_CHARS = re.compile(r'[\x00-\x1f<>:"/\\|?*]')


def safe_filename(name):
    name = unicodedata.normalize("NFC", os.path.basename(name.replace("\\", "/")))
    name = BAD_CHARS.sub("_", name).strip(" .")[:150]
    return name or "file"


def unique_filename(name):
    base, dot, ext = name.rpartition(".")
    if not dot:
        base, ext = name, ""
    cand, n = name, 2
    while os.path.exists(os.path.join(FILES, cand)):
        cand = f"{base} ({n}).{ext}" if ext else f"{base} ({n})"
        n += 1
    return cand


def ascii_name(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r'[^\w.\- ()]+', "_", s).strip("_ ")
    return s if s and s.strip(".") else "download"


# ---------------------------------------------------------------- архивы «Скачать всё»

def find_tool(names, windows_paths=()):
    for p in windows_paths:
        if os.name == "nt" and os.path.isfile(p):
            return p
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


TAR7Z = find_tool(["bsdtar"], [r"C:\Windows\System32\tar.exe"])
RAR = find_tool(["rar"], [r"C:\Program Files\WinRAR\Rar.exe"])


class Archiver:
    """Пересобирает ZIP/7z/RAR в фоне после изменений (с паузой, чтобы собрать пачку загрузок)."""
    DEBOUNCE = 6

    def __init__(self):
        self.event = threading.Event()
        self.lock = threading.Lock()
        self.state = {"building": False, "error": "", "built_at": 0}
        self.last_request = 0
        threading.Thread(target=self.loop, daemon=True).start()

    def request(self):
        self.last_request = time.time()
        self.event.set()

    def signature(self):
        return [[f, os.path.getsize(os.path.join(FILES, f)), int(os.path.getmtime(os.path.join(FILES, f)))]
                for f in list_files()]

    def check_on_start(self):
        try:
            with open(os.path.join(ARCHIVES, ".manifest.json"), encoding="utf-8") as fh:
                saved = json.load(fh)
        except (OSError, ValueError):
            saved = None
        formats = ["zip"] + (["7z"] if TAR7Z else []) + (["rar"] if RAR else [])
        missing = any(not os.path.exists(os.path.join(ARCHIVES, f"{ARCHIVE_NAME}.{e}")) for e in formats)
        if saved != self.signature() or missing:
            self.request()

    def loop(self):
        while True:
            self.event.wait()
            while time.time() - self.last_request < self.DEBOUNCE:
                time.sleep(1)
            self.event.clear()
            self.state.update(building=True, error="")
            try:
                self.build()
                self.state["built_at"] = int(time.time())
            except Exception as ex:  # noqa: BLE001 — показываем в админке
                self.state["error"] = str(ex)[:300]
                sys.stderr.write(f"archive build failed: {ex}\n")
            finally:
                self.state["building"] = bool(self.event.is_set())

    def build(self):
        files = list_files()
        tmp = os.path.join(ARCHIVES, ".building")
        shutil.rmtree(tmp, ignore_errors=True)
        os.makedirs(tmp)
        try:
            # ZIP — без сжатия: видео и презентации уже сжаты
            out = os.path.join(tmp, ARCHIVE_NAME + ".zip")
            with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED, allowZip64=True) as z:
                for f in files:
                    z.write(os.path.join(FILES, f), f"{ARCHIVE_NAME}/{f}")
            self.publish(out)

            if TAR7Z:
                out = os.path.join(tmp, ARCHIVE_NAME + ".7z")
                if os.name == "nt":  # tar.exe в Windows не умеет -s → папка из жёстких ссылок
                    stage = os.path.join(tmp, "stage", ARCHIVE_NAME)
                    os.makedirs(stage)
                    for f in files:
                        try:
                            os.link(os.path.join(FILES, f), os.path.join(stage, f))
                        except OSError:
                            shutil.copy2(os.path.join(FILES, f), os.path.join(stage, f))
                    cmd = [TAR7Z, "-cf", out, "--format", "7zip", "--options", "7zip:compression=store",
                           "-C", os.path.dirname(stage), ARCHIVE_NAME]
                else:
                    cmd = [TAR7Z, "-cf", out, "--format", "7zip", "--options", "7zip:compression=store",
                           "-s", f",^,{ARCHIVE_NAME}/,", "-C", FILES, *files]
                subprocess.run(cmd, check=True, capture_output=True)
                self.publish(out)
            else:
                self.remove("7z")

            if RAR:
                out = os.path.join(tmp, ARCHIVE_NAME + ".rar")
                subprocess.run([RAR, "a", "-m0", "-ma5", "-idq", "-ep1", f"-ap{ARCHIVE_NAME}", out,
                                *[os.path.join(FILES, f) for f in files]], check=True, capture_output=True)
                self.publish(out)
            else:
                self.remove("rar")

            with open(os.path.join(ARCHIVES, ".manifest.json"), "w", encoding="utf-8") as fh:
                json.dump(self.signature(), fh)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def publish(self, path):
        os.replace(path, os.path.join(ARCHIVES, os.path.basename(path)))

    def remove(self, ext):
        with contextlib.suppress(FileNotFoundError):
            os.remove(os.path.join(ARCHIVES, f"{ARCHIVE_NAME}.{ext}"))


ARCHIVER = None

# ---------------------------------------------------------------- превью: обложки видео и слайды презентаций

FFMPEG, FFPROBE = shutil.which("ffmpeg"), shutil.which("ffprobe")
SOFFICE = shutil.which("soffice") or shutil.which("libreoffice")
PDFTOPPM = shutil.which("pdftoppm")
PRES_EXTS = {"pptx", "ppt", "pps", "ppsx", "potx", "odp"}
MAX_SLIDES = 300


class Previewer:
    """Фоновая очередь: для загруженных файлов сервер сам готовит превью.
    Видео — обложка (удачный кадр), длительность, качество; презентации — все слайды картинками;
    PDF — обложка из первой страницы. По одному файлу за раз, с пониженным приоритетом."""

    def __init__(self):
        self.lock = threading.Lock()
        self.pending = []      # id в очереди
        self.current = None    # id, который сейчас обрабатывается
        self.event = threading.Event()
        threading.Thread(target=self.loop, daemon=True).start()

    @staticmethod
    def needs(r):
        meta = json.loads(r["meta"] or "{}")
        if meta.get("preview_failed"):
            return False
        ext = r["file"].rsplit(".", 1)[-1].lower() if "." in r["file"] else ""
        if r["kind"] == "video" and FFMPEG and FFPROBE:
            return not r["cover"] or not meta.get("duration")
        if ext in PRES_EXTS and SOFFICE and PDFTOPPM:
            return not meta.get("slides")
        if ext == "pdf" and PDFTOPPM:
            return not r["cover"]
        return False

    def request(self, mid):
        with self.lock:
            if mid != self.current and mid not in self.pending:
                self.pending.append(mid)
        self.event.set()

    def scan(self, rows):
        for r in rows:
            if self.needs(r):
                self.request(r["id"])

    def busy_ids(self):
        with self.lock:
            return ([self.current] if self.current else []) + list(self.pending)

    def loop(self):
        while True:
            self.event.wait()
            with self.lock:
                if not self.pending:
                    self.event.clear()
                    continue
                self.current = self.pending.pop(0)
            try:
                self.process(self.current)
            except Exception as ex:  # noqa: BLE001 — один неудачный файл не должен останавливать очередь
                sys.stderr.write(f"preview failed for material {self.current}: {ex}\n")
                self.update(self.current, meta={"preview_failed": 1})
            finally:
                with self.lock:
                    self.current = None

    @staticmethod
    def run(cmd, timeout, **kw):
        # nice — чтобы обработка не мешала сайту отвечать посетителям
        prefix = ["nice", "-n", "15"] if shutil.which("nice") else []
        return subprocess.run(prefix + cmd, capture_output=True, timeout=timeout, check=True, **kw)

    def update(self, mid, cover=None, meta=None):
        with db() as con:
            r = con.execute("SELECT cover, meta FROM materials WHERE id = ?", (mid,)).fetchone()
            if not r:
                return
            m = json.loads(r["meta"] or "{}")
            m.update(meta or {})
            con.execute("UPDATE materials SET cover = ?, meta = ? WHERE id = ?",
                        (cover if cover and not r["cover"] else r["cover"], json.dumps(m, ensure_ascii=False), mid))

    def process(self, mid):
        with db() as con:
            r = con.execute("SELECT * FROM materials WHERE id = ?", (mid,)).fetchone()
        if not r or not self.needs(r):
            return
        path = os.path.join(FILES, r["file"])
        if not os.path.isfile(path):
            return
        ext = r["file"].rsplit(".", 1)[-1].lower()
        if r["kind"] == "video":
            self.video(r, path)
        elif ext in PRES_EXTS:
            self.slides(r, path)
        elif ext == "pdf":
            self.pdf_cover(r, path)

    def video(self, r, path):
        info = json.loads(self.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                                    "format=duration:stream=width,height", "-of", "json", path], 120).stdout)
        dur = float((info.get("format") or {}).get("duration") or 0)
        st = (info.get("streams") or [{}])[0]
        w, h = int(st.get("width") or 0), int(st.get("height") or 0)
        quality = "4K" if h >= 2160 else "Full HD" if h >= 1080 else "HD" if h >= 720 else "SD"
        t = min(dur * 0.25, 30) if dur else 0
        meta = {"duration": round(dur, 1), "width": w, "height": h, "quality": quality, "preview": int(t)}
        cover = None
        if not r["cover"]:
            fn = f"m{r['id']}-{secrets.token_hex(3)}.jpg"
            out = os.path.join(COVERS, fn)
            # thumbnail=60 выбирает самый «типичный» кадр из 60 подряд — без чёрных и смазанных
            self.run([FFMPEG, "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", path, "-vf",
                      "thumbnail=60,scale='min(1280,iw)':-2", "-frames:v", "1", "-q:v", "3", out], 300)
            if os.path.isfile(out) and os.path.getsize(out) > 1000:
                cover = "covers/" + fn
        self.update(r["id"], cover=cover, meta=meta)

    def slides(self, r, path):
        rel = f"slides/m{r['id']}"
        out_dir = os.path.join(ROOT, "assets", rel)
        tmp = os.path.join(ROOT, "assets", f".tmp-m{r['id']}")
        shutil.rmtree(tmp, ignore_errors=True)
        os.makedirs(tmp)
        try:
            src = self.slim_copy(path, tmp)
            # LibreOffice: презентация → PDF. HOME во временной папке — ему нужен свой профиль.
            env = dict(os.environ, HOME=tmp)
            self.run([SOFFICE, "--headless", "--norestore", "--nolockcheck", "--convert-to", "pdf",
                      "--outdir", tmp, src], 1800, env=env)
            pdf = next((os.path.join(tmp, f) for f in os.listdir(tmp) if f.lower().endswith(".pdf")), None)
            if not pdf:
                raise RuntimeError("LibreOffice не сделал PDF")
            self.run([PDFTOPPM, "-jpeg", "-jpegopt", "quality=85", "-scale-to-x", "1280", "-scale-to-y", "-1",
                      "-l", str(MAX_SLIDES), pdf, os.path.join(tmp, "p")], 900)
            pages = sorted(f for f in os.listdir(tmp) if f.startswith("p-") and f.endswith(".jpg"))
            if not pages:
                raise RuntimeError("нет страниц")
            shutil.rmtree(out_dir, ignore_errors=True)
            os.makedirs(out_dir)
            for i, f in enumerate(pages, 1):
                os.replace(os.path.join(tmp, f), os.path.join(out_dir, "slide%02d.jpg" % i))
            self.update(r["id"], meta={"slides": len(pages), "slides_dir": rel, "slide_ext": "jpg", "cover_slide": 1})
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    MEDIA_EXTS = (".mp4", ".m4v", ".mov", ".avi", ".wmv", ".mkv", ".webm", ".mpg", ".mpeg",
                  ".mp3", ".wav", ".m4a", ".wma", ".ogg", ".aac")

    def slim_copy(self, path, tmp):
        """Копия презентации без встроенных видео и аудио. Для картинок слайдов они не нужны
        (на слайде рисуется кадр-заставка), а LibreOffice грузит их в память целиком —
        презентация на 1 ГБ с роликами не помещалась в память сервера."""
        ext = path.rsplit(".", 1)[-1].lower()
        if ext not in ("pptx", "ppsx", "potx", "odp"):
            return path
        try:
            zin = zipfile.ZipFile(path)
        except zipfile.BadZipFile:
            return path
        out = os.path.join(tmp, "slim." + ext)
        with zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as zout:
            for info in zin.infolist():
                data = b"" if info.filename.lower().endswith(self.MEDIA_EXTS) else zin.read(info)
                zout.writestr(info, data)  # тот же порядок и способ сжатия (для .odp важно)
        return out

    def pdf_cover(self, r, path):
        fn = f"m{r['id']}-{secrets.token_hex(3)}"
        self.run([PDFTOPPM, "-jpeg", "-jpegopt", "quality=85", "-f", "1", "-l", "1", "-singlefile",
                  "-scale-to-x", "960", "-scale-to-y", "-1", path, os.path.join(COVERS, fn)], 300)
        if os.path.isfile(os.path.join(COVERS, fn + ".jpg")):
            self.update(r["id"], cover=f"covers/{fn}.jpg")


PREVIEWER = None

# ---------------------------------------------------------------- passwords

ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def gen_password():
    return "-".join("".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3))


def hash_pw(pw, salt=None, it=260_000):
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, it)
    return f"pbkdf2${it}${salt.hex()}${dk.hex()}"


def check_pw(pw, stored):
    try:
        _, it, salt, dk = stored.split("$")
        cand = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(cand.hex(), dk)
    except Exception:
        return False


DUMMY_HASH = hash_pw(secrets.token_hex(8))
FAILS = {}  # ip -> [timestamps]  (простая защита от перебора)

# ---------------------------------------------------------------- скачивание для посетителей
# Посетитель без входа скачивает только по одноразовой ссылке, которую выдаёт форма заявки.
DL_TOKENS = {}   # токен -> {"kind": file|archive|zip, "key": ..., "exp": время, "req": id заявки}
DL_TTL = 1800    # ссылка живёт 30 минут (браузер может докачивать файл частями)
LEAD_HITS = {}   # ip -> [timestamps]  (не больше 20 заявок в час с одного адреса)
LEAD_LIMIT = 20

EMAIL_RE = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]{2,}$")


def issue_token(kind, key, req_id):
    now = time.time()
    for t in [t for t, d in DL_TOKENS.items() if d["exp"] < now]:
        DL_TOKENS.pop(t, None)
    tok = secrets.token_urlsafe(18)
    DL_TOKENS[tok] = {"kind": kind, "key": key, "exp": now + DL_TTL, "req": req_id}
    return tok


def check_token(tok, kind, key):
    d = DL_TOKENS.get(tok or "")
    if d and d["exp"] > time.time() and d["kind"] == kind and d["key"] == key:
        return d
    return None


def lead_limited(ip):
    now = time.time()
    LEAD_HITS[ip] = [t for t in LEAD_HITS.get(ip, []) if now - t < 3600]
    if len(LEAD_HITS[ip]) >= LEAD_LIMIT:
        return True
    LEAD_HITS[ip].append(now)
    return False


def csv_cell(v):
    """Ячейка CSV для Excel: без формул (защита от CSV-инъекций), кавычки экранируются."""
    s = str(v if v is not None else "")
    if s[:1] in ("=", "+", "-", "@", "\t", "\r"):
        s = "'" + s
    return '"' + s.replace('"', '""') + '"'


def too_many_fails(ip):
    now = time.time()
    FAILS[ip] = [t for t in FAILS.get(ip, []) if now - t < 900]
    return len(FAILS[ip]) >= 10


def user_public(r):
    d = {k: r[k] for k in ("id", "login", "name", "position", "role", "active", "must_change",
                           "created_at", "last_login")}
    d["has_recovery"] = bool(r["recovery_hash"])
    d["recovery_created"] = r["recovery_created"]
    d["can_upload"] = may_upload(r)
    return d


def may_upload(u):
    return u["role"] == "admin" or bool(u["can_upload"])


def may_edit(u, material):
    """Админ правит всё, сотрудник — только то, что загрузил сам."""
    return u["role"] == "admin" or (material["uploaded_by"] is not None and material["uploaded_by"] == u["id"])


# ---------------------------------------------------------------- ключ восстановления администратора

KEY_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"  # без похожих символов: 0/O, 1/I/L, U/V


def gen_recovery_key():
    """25 случайных символов (~122 бита) в виде HETTICH-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX."""
    raw = "".join(secrets.choice(KEY_ALPHABET) for _ in range(25))
    return "HETTICH-" + "-".join(raw[i:i + 5] for i in range(0, 25, 5))


def normalize_key(key):
    k = re.sub(r"[^A-Za-z0-9]", "", str(key)).upper()
    return k[7:] if k.startswith("HETTICH") else k


# ---------------------------------------------------------------- HTTP

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "HettichMaterials/2.0"

    def client_ip(self):
        if TRUST_PROXY:
            fwd = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
            if fwd:
                return fwd
        return self.client_address[0]

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.client_ip(), fmt % args))

    # ---- helpers
    def send_json(self, obj, status=200, headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, to):
        self.send_response(302)
        self.send_header("Location", to)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 100_000:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def cookie_token(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE:
                return v
        return None

    def current_user(self):
        tok = self.cookie_token()
        if not tok:
            return None
        th = hashlib.sha256(tok.encode()).hexdigest()
        with db() as con:
            return con.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                                  WHERE s.token = ? AND s.expires > ? AND u.active = 1""",
                               (th, int(time.time()))).fetchone()

    def set_session(self, user_id):
        tok = secrets.token_urlsafe(32)
        th = hashlib.sha256(tok.encode()).hexdigest()
        exp = int(time.time()) + SESSION_DAYS * 86400
        with db() as con:
            con.execute("DELETE FROM sessions WHERE expires < ?", (int(time.time()),))
            con.execute("INSERT INTO sessions VALUES (?,?,?)", (th, user_id, exp))
        return (f"{COOKIE}={tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_DAYS * 86400}"
                + ("; Secure" if SECURE else ""))

    def csrf_ok(self):
        # Нестандартный заголовок нельзя отправить с чужого сайта без CORS — защита от CSRF.
        return self.headers.get("X-Requested-With") == "hettich"

    def disposition(self, fn, attach=True):
        return (f"{'attachment' if attach else 'inline'}; filename=\"{ascii_name(fn)}\"; "
                f"filename*=UTF-8''{urllib.parse.quote(fn)}")

    def serve_file(self, path, download=False, user_content=False):
        if not path or not os.path.isfile(path):
            return self.send_error(404)
        size = os.path.getsize(path)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        start, end, status = 0, size - 1, 200
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range") or "")
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
            else:
                start = max(0, size - int(m.group(2)))
            if start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            status = 206
        self.send_response(status)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") else ""))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("X-Content-Type-Options", "nosniff")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        if download:
            self.send_header("Content-Disposition", self.disposition(os.path.basename(path)))
        elif user_content and ctype in ("image/svg+xml", "text/html", "application/xhtml+xml", "text/xml"):
            # загруженные SVG/HTML не исполняются в контексте сайта (страницы самого сайта это не затрагивает)
            self.send_header("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:")
        if path.endswith((".html", ".js", ".css")):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                pass

    def safe_join(self, base, rel):
        base = os.path.realpath(os.path.join(ROOT, base))
        p = os.path.realpath(os.path.join(base, urllib.parse.unquote(rel)))
        return p if p.startswith(base + os.sep) else None

    def log_download(self, user, path, token=None):
        with db() as con:
            con.execute("INSERT INTO downloads (user_id, path, at) VALUES (?,?,?)",
                        (user["id"] if user else None, path, int(time.time())))
            if token:
                con.execute("UPDATE requests SET downloaded = 1 WHERE id = ?", (token["req"],))

    def stream_zip(self, user, ids, token=None):
        with db() as con:
            q = ",".join("?" * len(ids))
            rows = con.execute(f"SELECT file FROM materials WHERE id IN ({q}) ORDER BY title", ids).fetchall()
        files = [r["file"] for r in rows if os.path.isfile(os.path.join(FILES, r["file"]))]
        if not files:
            return self.send_error(404)
        self.log_download(user, f"zip/{len(files)}", token)
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", self.disposition("Hettich_vybrannoe.zip"))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.close_connection = True
        try:
            with zipfile.ZipFile(self.wfile, "w", zipfile.ZIP_STORED, allowZip64=True) as z:
                for f in files:
                    p = os.path.join(FILES, f)
                    zi = zipfile.ZipInfo(f, time.localtime(os.path.getmtime(p))[:6])
                    zi.compress_type = zipfile.ZIP_STORED
                    with open(p, "rb") as src, z.open(zi, "w", force_zip64=True) as dst:
                        shutil.copyfileobj(src, dst, 1 << 20)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            pass

    def need_form(self):
        """Прямая ссылка на скачивание без заявки: понятная страница вместо голой ошибки."""
        body = ("<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                "<title>Скачивание · Hettich · Полезные материалы</title>"
                "<body style='margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#f1f2f2;color:#121212'>"
                "<div style='max-width:420px;padding:32px;background:#fff;border-radius:8px;text-align:center'>"
                "<h1 style='margin:0 0 10px;font-size:24px'>Скачивание по заявке</h1>"
                "<p style='color:#666977'>Чтобы скачать файл, нажмите «Скачать» на сайте и оставьте контакты — это займёт полминуты.</p>"
                "<a href='/' style='display:inline-block;margin-top:8px;padding:12px 22px;background:#121212;color:#fff;border-radius:4px;text-decoration:none;font-weight:600'>Перейти к материалам</a>"
                "</div></body>").encode("utf-8")
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def download_request(self, data, ip):
        """Посетитель оставил контакты → сохраняем заявку и выдаём одноразовую ссылку на скачивание."""
        name = str(data.get("name", "")).strip()[:100]
        email = str(data.get("email", "")).strip()[:200]
        phone = str(data.get("phone", "")).strip()[:40]
        comment = str(data.get("comment", "")).strip()[:1000]
        errors = {}
        if len(name) < 2:
            errors["name"] = "Как к вам обращаться?"
        if not EMAIL_RE.match(email):
            errors["email"] = "Проверьте почту"
        digits = re.sub(r"\D", "", phone)
        if not re.fullmatch(r"[\d\s()+\-.]+", phone or "x") or not 7 <= len(digits) <= 15:
            errors["phone"] = "Проверьте телефон"
        if not data.get("consent"):
            errors["consent"] = "Нужно согласие на обработку данных"
        if errors:
            return self.send_json({"error": "Проверьте поля формы", "fields": errors}, 400)
        if lead_limited(ip):
            return self.send_json({"error": "Слишком много заявок. Попробуйте через час."}, 429)

        target = data.get("target") or {}
        kind = target.get("type")
        with db() as con:
            if kind == "file":
                r = con.execute("SELECT * FROM materials WHERE id = ?", (int(target.get("id") or 0),)).fetchone()
                if not r or not os.path.isfile(os.path.join(FILES, r["file"])):
                    return self.send_json({"error": "Файл не найден"}, 404)
                label, tkind, key = r["title"], "file", r["file"]
                url = f"/files/{urllib.parse.quote(r['file'])}?dl=1&t="
            elif kind == "zip":
                ids = sorted({int(x) for x in (target.get("ids") or []) if str(x).isdigit()})[:500]
                rows = con.execute(f"SELECT id, title FROM materials WHERE id IN ({','.join('?' * len(ids))})", ids).fetchall() if ids else []
                if not rows:
                    return self.send_json({"error": "Файлы не найдены"}, 404)
                ids = sorted(r["id"] for r in rows)
                titles = ", ".join(r["title"] for r in rows)
                label = f"Выбранное одним ZIP ({len(rows)}): " + (titles[:300] + "…" if len(titles) > 300 else titles)
                tkind, key = "zip", ",".join(map(str, ids))
                url = f"/zip?ids={key}&t="
            elif kind == "archive":
                ext = str(target.get("ext", ""))
                fn = f"{ARCHIVE_NAME}.{ext}"
                if ext not in ("zip", "rar", "7z") or not os.path.isfile(os.path.join(ARCHIVES, fn)):
                    return self.send_json({"error": "Архив ещё не готов"}, 404)
                label, tkind, key = f"Всё одним архивом .{ext}", "archive", fn
                url = f"/archives/{urllib.parse.quote(fn)}?dl=1&t="
            else:
                return self.send_json({"error": "Не указано, что скачать"}, 400)
            cur = con.execute("""INSERT INTO requests (at, name, email, phone, comment, target, ip)
                                 VALUES (?,?,?,?,?,?,?)""", (int(time.time()), name, email, phone, comment, label, ip))
        return self.send_json({"ok": True, "url": url + issue_token(tkind, key, cur.lastrowid)})

    # ---- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        path, qs = u.path, urllib.parse.parse_qs(u.query)
        user = self.current_user()

        # Главная и каталог открыты всем: посетители смотрят и скачивают через форму заявки
        if path == "/login":
            return self.redirect("/") if user else self.serve_file(os.path.join(ROOT, "web", "login.html"))
        if path in ("/", "/index.html"):
            return self.serve_file(os.path.join(ROOT, "web", "index.html"))
        if path in ("/all", "/all/"):
            return self.serve_file(os.path.join(ROOT, "web", "all.html"))
        if path == "/admin":
            if not user:
                return self.redirect("/login")
            if user["role"] != "admin":
                return self.redirect("/")
            return self.serve_file(os.path.join(ROOT, "web", "admin.html"))
        if path.startswith("/web/"):
            return self.serve_file(self.safe_join("web", path[5:]))
        tok = qs.get("t", [""])[0]
        if path == "/zip":
            ids = sorted({int(x) for x in (qs.get("ids", [""])[0]).split(",") if x.isdigit()})[:500]
            if not ids:
                return self.send_error(400)
            token = None if user else check_token(tok, "zip", ",".join(map(str, ids)))
            if not user and not token:
                return self.need_form()
            return self.stream_zip(user, ids, token)

        top, _, rest = path.lstrip("/").partition("/")
        if top in PROTECTED:
            p = self.safe_join(PROTECTED[top], rest)
            if not p or os.path.basename(p).startswith("."):
                return self.send_error(404)
            dl = qs.get("dl") == ["1"]
            token = None
            if not user:
                # обложки и слайды — всем; файлы — смотреть всем, скачивать по ссылке из заявки; архивы — только по ссылке
                kind = {"files": "file", "archives": "archive"}.get(top)
                if kind and (dl or top == "archives"):
                    token = check_token(tok, kind, os.path.basename(p))
                    if not token:
                        return self.need_form()
            rng = self.headers.get("Range") or ""
            first_chunk = not rng or rng.startswith("bytes=0-")  # докачки не считаем повторно
            if dl and top in ("files", "archives") and os.path.isfile(p) and self.command == "GET" and first_chunk:
                self.log_download(user, f"{top}/{os.path.basename(p)}", token)
            return self.serve_file(p, download=dl or top == "archives", user_content=True)

        if not path.startswith("/api/"):
            return self.send_error(404)

        # ---- открытые для посетителей
        if path == "/api/me":
            return self.send_json(user_public(user) if user else {"guest": True})
        if path == "/api/materials":
            sync_materials()
            with db() as con:
                rows = con.execute("""SELECT m.*, u.name AS uploader FROM materials m
                                      LEFT JOIN users u ON u.id = m.uploaded_by
                                      ORDER BY m.pinned DESC, m.created_at DESC""").fetchall()
            PREVIEWER.scan(rows)  # всё, чему не хватает обложки или слайдов, — в очередь
            return self.send_json({"processing": PREVIEWER.busy_ids(),
                                   "materials": [dict(material_json(r),
                                                      can_edit=bool(user) and may_edit(user, r),
                                                      uploader=r["uploader"] if user else None)  # имена сотрудников посетителям не показываем
                                                 for r in rows],
                                   "is_admin": bool(user) and user["role"] == "admin",
                                   "can_upload": bool(user) and may_upload(user),
                                   "guest": not user,
                                   "max_upload": MAX_UPLOAD})
        if path == "/api/archives":
            out = {}
            for fn in os.listdir(ARCHIVES):
                fp = os.path.join(ARCHIVES, fn)
                ext = fn.rsplit(".", 1)[-1]
                if os.path.isfile(fp) and not fn.startswith(".") and ext in ("zip", "rar", "7z"):
                    out[ext] = {"name": fn, "size": os.path.getsize(fp), "mtime": int(os.path.getmtime(fp))}
            return self.send_json({"archives": out, "building": ARCHIVER.state["building"] or ARCHIVER.event.is_set(),
                                   "error": ARCHIVER.state["error"] if user and user["role"] == "admin" else ""})

        # ---- дальше только сотрудники
        if not user:
            return self.send_json({"error": "unauthorized"}, 401)

        if path in ("/api/requests", "/api/requests.csv"):
            if user["role"] != "admin":
                return self.send_json({"error": "forbidden"}, 403)
            with db() as con:
                total = con.execute("SELECT COUNT(*) FROM requests").fetchone()[0]
                rows = con.execute("SELECT * FROM requests ORDER BY at DESC" + ("" if path.endswith(".csv") else " LIMIT 500")).fetchall()
            if path.endswith(".csv"):
                head = ["Дата", "Имя", "Почта", "Телефон", "Комментарий", "Что скачивал", "Скачано", "IP"]
                lines = [";".join(csv_cell(h) for h in head)]
                for r in rows:
                    lines.append(";".join(csv_cell(v) for v in (
                        time.strftime("%d.%m.%Y %H:%M", time.localtime(r["at"])), r["name"], r["email"], r["phone"],
                        r["comment"], r["target"], "да" if r["downloaded"] else "нет", r["ip"])))
                body = ("﻿" + "\r\n".join(lines) + "\r\n").encode("utf-8")  # BOM — чтобы Excel открыл кириллицу
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", self.disposition(f"Zayavki_{time.strftime('%Y-%m-%d')}.csv"))
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return
            return self.send_json({"total": total, "items": [dict(r) for r in rows]})

        if path == "/api/users":
            if user["role"] != "admin":
                return self.send_json({"error": "forbidden"}, 403)
            with db() as con:
                rows = con.execute("""SELECT u.*, (SELECT COUNT(*) FROM downloads d WHERE d.user_id = u.id) AS dl
                                      FROM users u ORDER BY u.role = 'admin' DESC, u.name""").fetchall()
                top = con.execute("""SELECT d.path, COUNT(*) n, m.title FROM downloads d
                                     LEFT JOIN materials m ON 'files/' || m.file = d.path
                                     GROUP BY d.path ORDER BY n DESC LIMIT 10""").fetchall()
                total = con.execute("SELECT COUNT(*) FROM downloads").fetchone()[0]
            return self.send_json({
                "users": [dict(user_public(r), downloads=r["dl"]) for r in rows],
                "downloads": {"total": total, "by_file": [dict(r) for r in top]},
                "me": user["id"],
            })
        return self.send_json({"error": "not found"}, 404)

    # ---- загрузка файлов (PUT, тело запроса = файл целиком, без multipart)
    def do_PUT(self):
        u = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(u.query)
        if not self.csrf_ok():
            return self.send_json({"error": "bad request"}, 400)
        user = self.current_user()
        if not user:
            return self.send_json({"error": "unauthorized"}, 401)
        if not may_upload(user):
            return self.send_json({"error": "Загрузка файлов для вас отключена — обратитесь к администратору"}, 403)
        try:
            length = int(self.headers.get("Content-Length") or -1)
        except ValueError:
            length = -1
        if length < 0:
            return self.send_json({"error": "Нужен Content-Length"}, 411)

        if u.path == "/api/upload":
            if length > MAX_UPLOAD:
                return self.send_json({"error": f"Файл больше {MAX_UPLOAD // 1024 ** 3} ГБ"}, 413)
            name = unique_filename(safe_filename(qs.get("name", ["file"])[0]))
            part = os.path.join(FILES, f".upload-{secrets.token_hex(6)}.part")
            try:
                with open(part, "wb") as out:
                    left = length
                    while left > 0:
                        chunk = self.rfile.read(min(1 << 20, left))
                        if not chunk:
                            raise ConnectionError("upload interrupted")
                        out.write(chunk)
                        left -= len(chunk)
                os.replace(part, os.path.join(FILES, name))
            except Exception:
                with contextlib.suppress(OSError):
                    os.remove(part)
                self.close_connection = True
                return self.send_json({"error": "Загрузка прервалась"}, 400)
            title = (qs.get("title", [""])[0].strip() or title_from(name))[:200]
            with db() as con:
                cur = con.execute("""INSERT INTO materials (file, title, kind, size, created_at, uploaded_by)
                                     VALUES (?,?,?,?,?,?)""",
                                  (name, title, kind_of(name), length, int(time.time()), user["id"]))
                row = con.execute("SELECT * FROM materials WHERE id = ?", (cur.lastrowid,)).fetchone()
            ARCHIVER.request()
            PREVIEWER.request(row["id"])
            return self.send_json(material_json(row))

        m = re.fullmatch(r"/api/materials/(\d+)/cover", u.path)
        if m:
            if length > 8 * 1024 * 1024:
                return self.send_json({"error": "Обложка больше 8 МБ"}, 413)
            data = self.rfile.read(length)
            if not data.startswith(b"\xff\xd8"):
                return self.send_json({"error": "Обложка должна быть JPEG"}, 400)
            mid = int(m.group(1))
            fn = f"m{mid}-{secrets.token_hex(3)}.jpg"
            with db() as con:
                r = con.execute("SELECT cover, uploaded_by FROM materials WHERE id = ?", (mid,)).fetchone()
                if not r:
                    return self.send_json({"error": "Материал не найден"}, 404)
                if not may_edit(user, r):
                    return self.send_json({"error": "Можно менять только свои файлы"}, 403)
                with open(os.path.join(COVERS, fn), "wb") as fh:
                    fh.write(data)
                con.execute("UPDATE materials SET cover = ? WHERE id = ?", ("covers/" + fn, mid))
                old = r["cover"]
            if re.fullmatch(r"covers/m\d+-\w+\.jpg", old or ""):
                with contextlib.suppress(OSError):
                    os.remove(os.path.join(ROOT, "assets", old))
            return self.send_json({"ok": True, "cover": "/assets/covers/" + fn})
        return self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if not self.csrf_ok():
            return self.send_json({"error": "bad request"}, 400)
        data = self.body_json()
        ip = self.client_ip()

        if path == "/api/login":
            if too_many_fails(ip):
                return self.send_json({"error": "Слишком много попыток. Подождите 15 минут."}, 429)
            login = str(data.get("login", "")).strip()
            pw = str(data.get("password", ""))
            with db() as con:
                r = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
            ok = check_pw(pw, r["pw"] if r else DUMMY_HASH) and r is not None
            if not ok:
                FAILS.setdefault(ip, []).append(time.time())
                return self.send_json({"error": "Неверный логин или пароль"}, 401)
            if not r["active"]:
                return self.send_json({"error": "Доступ приостановлен. Обратитесь к администратору."}, 403)
            with db() as con:
                con.execute("UPDATE users SET last_login = ? WHERE id = ?", (int(time.time()), r["id"]))
            cookie = self.set_session(r["id"])
            return self.send_json({"ok": True, "must_change": bool(r["must_change"])}, headers={"Set-Cookie": cookie})

        if path == "/api/recover":  # вход администратора по ключу восстановления
            if too_many_fails(ip):
                return self.send_json({"error": "Слишком много попыток. Подождите 15 минут."}, 429)
            login = str(data.get("login", "")).strip()
            key = normalize_key(data.get("key", ""))
            new = str(data.get("new", ""))
            if len(new) < 8:
                return self.send_json({"error": "Новый пароль — минимум 8 символов"}, 400)
            with db() as con:
                r = con.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
            stored = r["recovery_hash"] if r and r["role"] == "admin" and r["recovery_hash"] else DUMMY_HASH
            if not (check_pw(key, stored) and stored != DUMMY_HASH and len(key) == 25):
                FAILS.setdefault(ip, []).append(time.time())
                return self.send_json({"error": "Ключ не подходит к этому логину (или уже был использован)"}, 401)
            if not r["active"]:
                return self.send_json({"error": "Учётная запись заблокирована"}, 403)
            with db() as con:
                # ключ одноразовый: сжигаем, все старые сессии закрываем
                con.execute("""UPDATE users SET pw = ?, must_change = 0, recovery_hash = NULL, recovery_created = NULL,
                               last_login = ? WHERE id = ?""", (hash_pw(new), int(time.time()), r["id"]))
                con.execute("DELETE FROM sessions WHERE user_id = ?", (r["id"],))
            sys.stderr.write(f"recovery key used for {login} from {ip}\n")
            return self.send_json({"ok": True}, headers={"Set-Cookie": self.set_session(r["id"])})

        if path == "/api/download-request":  # заявка посетителя на скачивание → одноразовая ссылка
            return self.download_request(data, ip)

        user = self.current_user()
        if not user:
            return self.send_json({"error": "unauthorized"}, 401)

        if path == "/api/recovery-key":  # создать/заменить свой ключ (только админ)
            if user["role"] != "admin":
                return self.send_json({"error": "forbidden"}, 403)
            if not check_pw(str(data.get("password", "")), user["pw"]):
                return self.send_json({"error": "Неверный текущий пароль"}, 400)
            key = gen_recovery_key()
            now = int(time.time())
            with db() as con:
                con.execute("UPDATE users SET recovery_hash = ?, recovery_created = ? WHERE id = ?",
                            (hash_pw(normalize_key(key)), now, user["id"]))
            return self.send_json({"ok": True, "key": key, "login": user["login"], "created": now})

        if path == "/api/logout":
            tok = self.cookie_token()
            with db() as con:
                con.execute("DELETE FROM sessions WHERE token = ?", (hashlib.sha256(tok.encode()).hexdigest(),))
            return self.send_json({"ok": True}, headers={"Set-Cookie": f"{COOKIE}=; Path=/; Max-Age=0"})

        if path == "/api/password":
            cur, new = str(data.get("current", "")), str(data.get("new", ""))
            if not check_pw(cur, user["pw"]):
                return self.send_json({"error": "Текущий пароль указан неверно"}, 400)
            if len(new) < 8:
                return self.send_json({"error": "Новый пароль — минимум 8 символов"}, 400)
            if new == cur:
                return self.send_json({"error": "Новый пароль должен отличаться от текущего"}, 400)
            with db() as con:
                con.execute("UPDATE users SET pw = ?, must_change = 0 WHERE id = ?", (hash_pw(new), user["id"]))
            return self.send_json({"ok": True})

        # ---- материалы: админ — любые, сотрудник — только свои
        if path == "/api/materials/delete":  # удаление нескольких сразу
            ids = [int(x) for x in data.get("ids", []) if str(x).isdigit()][:1000]
            if not ids:
                return self.send_json({"error": "Не выбраны файлы"}, 400)
            with db() as con:
                rows = con.execute(f"SELECT * FROM materials WHERE id IN ({','.join('?' * len(ids))})", ids).fetchall()
                allowed = [r for r in rows if may_edit(user, r)]
                for r in allowed:
                    delete_material(con, r)
            if allowed:
                ARCHIVER.request()
            return self.send_json({"ok": True, "deleted": len(allowed), "skipped": len(rows) - len(allowed)})

        m = re.fullmatch(r"/api/materials/(\d+)(?:/(delete))?", path)
        if m:
            mid = int(m.group(1))
            with db() as con:
                r = con.execute("SELECT * FROM materials WHERE id = ?", (mid,)).fetchone()
                if not r:
                    return self.send_json({"error": "Материал не найден"}, 404)
                if not may_edit(user, r):
                    return self.send_json({"error": "Можно менять только свои файлы"}, 403)
                if m.group(2) == "delete":
                    delete_material(con, r)
                    ARCHIVER.request()
                    return self.send_json({"ok": True})
                meta = json.loads(r["meta"] or "{}")
                for k in ("duration", "width", "height", "quality", "preview"):
                    if k in data.get("meta", {}):
                        meta[k] = data["meta"][k]
                kind = data.get("kind", r["kind"])
                kind = kind if kind in (*KINDS, "other") else r["kind"]
                # закреплять на главной может только администратор
                pinned = (1 if data.get("pinned", r["pinned"]) else 0) if user["role"] == "admin" else r["pinned"]
                con.execute("""UPDATE materials SET title = ?, description = ?, kind = ?, pinned = ?, meta = ?
                               WHERE id = ?""",
                            (str(data.get("title", r["title"])).strip()[:200] or r["title"],
                             str(data.get("description", r["description"])).strip()[:2000],
                             kind, pinned, json.dumps(meta, ensure_ascii=False), mid))
                row = con.execute("SELECT * FROM materials WHERE id = ?", (mid,)).fetchone()
            return self.send_json(material_json(row))

        # ---- admin only below
        if user["role"] != "admin":
            return self.send_json({"error": "forbidden"}, 403)

        m = re.fullmatch(r"/api/requests/(\d+)/delete", path)
        if m:
            with db() as con:
                n = con.execute("DELETE FROM requests WHERE id = ?", (int(m.group(1)),)).rowcount
            return self.send_json({"ok": True} if n else {"error": "Заявка не найдена"}, 200 if n else 404)

        if path == "/api/users":
            name = str(data.get("name", "")).strip()[:120]
            login = str(data.get("login", "")).strip()[:120]
            position = str(data.get("position", "")).strip()[:120]
            role = "admin" if data.get("role") == "admin" else "user"
            if not name or not re.fullmatch(r"[\w.@+\-]{3,120}", login):
                return self.send_json({"error": "Укажите имя и логин (латиница, цифры, . @ - _ ; от 3 символов)"}, 400)
            pw = gen_password()
            try:
                with db() as con:
                    cur = con.execute("""INSERT INTO users (login, name, position, role, pw, must_change, active,
                                         created_at, created_by, can_upload) VALUES (?,?,?,?,?,1,1,?,?,?)""",
                                      (login, name, position, role, hash_pw(pw), int(time.time()), user["id"],
                                       0 if data.get("can_upload") is False else 1))
            except sqlite3.IntegrityError:
                return self.send_json({"error": "Такой логин уже есть"}, 409)
            return self.send_json({"ok": True, "id": cur.lastrowid, "login": login, "name": name, "password": pw})

        m = re.fullmatch(r"/api/users/(\d+)/upload", path)  # право загружать файлы
        if m:
            with db() as con:
                n = con.execute("UPDATE users SET can_upload = ? WHERE id = ?",
                                (1 if data.get("can_upload") else 0, int(m.group(1)))).rowcount
            return self.send_json({"ok": True} if n else {"error": "Пользователь не найден"}, 200 if n else 404)

        m = re.fullmatch(r"/api/users/(\d+)/(reset|active|delete)", path)
        if m:
            uid, action = int(m.group(1)), m.group(2)
            with db() as con:
                target = con.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
                if not target:
                    return self.send_json({"error": "Пользователь не найден"}, 404)
                if action == "reset":
                    pw = gen_password()
                    con.execute("UPDATE users SET pw = ?, must_change = 1 WHERE id = ?", (hash_pw(pw), uid))
                    con.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
                    return self.send_json({"ok": True, "login": target["login"], "name": target["name"], "password": pw})
                if uid == user["id"]:
                    return self.send_json({"error": "Нельзя заблокировать или удалить самого себя"}, 400)
                if action == "active":
                    active = 1 if data.get("active") else 0
                    con.execute("UPDATE users SET active = ? WHERE id = ?", (active, uid))
                    if not active:
                        con.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
                    return self.send_json({"ok": True})
                if action == "delete":
                    con.execute("DELETE FROM users WHERE id = ?", (uid,))
                    return self.send_json({"ok": True})
        return self.send_json({"error": "not found"}, 404)


# ---------------------------------------------------------------- CLI

def cli_create_admin(login, name="Главный администратор"):
    pw = gen_password()
    with db() as con:
        con.execute("""INSERT INTO users (login, name, role, pw, must_change, active, created_at)
                       VALUES (?,?,'admin',?,1,1,?)""", (login, name, hash_pw(pw), int(time.time())))
    print(f"\n  Администратор создан\n  Логин:  {login}\n  Пароль: {pw}\n  (при первом входе система попросит сменить пароль)\n")


def cli_reset(login):
    pw = gen_password()
    with db() as con:
        n = con.execute("UPDATE users SET pw = ?, must_change = 1, active = 1 WHERE login = ?",
                        (hash_pw(pw), login)).rowcount
    print(f"\n  Новый пароль для {login}: {pw}\n" if n else f"  Логин {login} не найден")


if __name__ == "__main__":
    init_db()
    args = sys.argv[1:]
    if args[:1] == ["create-admin"] and len(args) == 2:
        cli_create_admin(args[1]); sys.exit()
    if args[:1] == ["reset-password"] and len(args) == 2:
        cli_reset(args[1]); sys.exit()
    with db() as con:
        if con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            print("Пользователей ещё нет — создаю главного администратора:")
            cli_create_admin("admin")
    sync_materials()
    ARCHIVER = Archiver()
    ARCHIVER.check_on_start()
    PREVIEWER = Previewer()
    with db() as con:
        PREVIEWER.scan(con.execute("SELECT * FROM materials").fetchall())
    print(f"Архивы: ZIP — да, 7z — {'да' if TAR7Z else 'нет (нужен bsdtar)'}, RAR — {'да' if RAR else 'нет (нужен rar)'}")
    print(f"Превью: видео — {'да' if FFMPEG else 'нет (нужен ffmpeg)'}, презентации — {'да' if SOFFICE and PDFTOPPM else 'нет (нужен LibreOffice)'}, PDF — {'да' if PDFTOPPM else 'нет'}")
    srv = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    print(f"Hettich · Полезные материалы: http://{HOST}:{PORT}", flush=True)
    srv.serve_forever()
