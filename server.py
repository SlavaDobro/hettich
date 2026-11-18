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
    """Удаляет файл, его обложку (если она загружена через сайт) и запись в каталоге."""
    with contextlib.suppress(FileNotFoundError):
        os.remove(os.path.join(FILES, r["file"]))
    if re.fullmatch(r"covers/m\d+-\w+\.jpg", r["cover"] or ""):
        with contextlib.suppress(OSError):
            os.remove(os.path.join(ROOT, "assets", r["cover"]))
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

    def log_download(self, user, path):
        with db() as con:
            con.execute("INSERT INTO downloads (user_id, path, at) VALUES (?,?,?)", (user["id"], path, int(time.time())))

    def stream_zip(self, user, ids):
        with db() as con:
            q = ",".join("?" * len(ids))
            rows = con.execute(f"SELECT file FROM materials WHERE id IN ({q}) ORDER BY title", ids).fetchall()
        files = [r["file"] for r in rows if os.path.isfile(os.path.join(FILES, r["file"]))]
        if not files:
            return self.send_error(404)
        self.log_download(user, f"zip/{len(files)}")
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

    # ---- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        path, qs = u.path, urllib.parse.parse_qs(u.query)
        user = self.current_user()

        if path == "/login":
            return self.redirect("/") if user else self.serve_file(os.path.join(ROOT, "web", "login.html"))
        if path in ("/", "/index.html"):
            return self.serve_file(os.path.join(ROOT, "web", "index.html")) if user else self.redirect("/login")
        if path in ("/all", "/all/"):
            return self.serve_file(os.path.join(ROOT, "web", "all.html")) if user else self.redirect("/login")
        if path == "/admin":
            if not user:
                return self.redirect("/login")
            if user["role"] != "admin":
                return self.redirect("/")
            return self.serve_file(os.path.join(ROOT, "web", "admin.html"))
        if path.startswith("/web/"):
            return self.serve_file(self.safe_join("web", path[5:]))
        if path == "/zip":
            if not user:
                return self.send_error(401)
            ids = [int(x) for x in (qs.get("ids", [""])[0]).split(",") if x.isdigit()][:500]
            return self.stream_zip(user, ids) if ids else self.send_error(400)

        top, _, rest = path.lstrip("/").partition("/")
        if top in PROTECTED:
            if not user:
                return self.send_error(401)
            p = self.safe_join(PROTECTED[top], rest)
            if not p or os.path.basename(p).startswith("."):
                return self.send_error(404)
            dl = qs.get("dl") == ["1"]
            rng = self.headers.get("Range") or ""
            first_chunk = not rng or rng.startswith("bytes=0-")  # докачки не считаем повторно
            if dl and top in ("files", "archives") and os.path.isfile(p) and self.command == "GET" and first_chunk:
                self.log_download(user, f"{top}/{os.path.basename(p)}")
            return self.serve_file(p, download=dl, user_content=True)

        if not path.startswith("/api/"):
            return self.send_error(404)
        if not user:
            return self.send_json({"error": "unauthorized"}, 401)

        if path == "/api/me":
            return self.send_json(user_public(user))
        if path == "/api/materials":
            sync_materials()
            with db() as con:
                rows = con.execute("""SELECT m.*, u.name AS uploader FROM materials m
                                      LEFT JOIN users u ON u.id = m.uploaded_by
                                      ORDER BY m.pinned DESC, m.created_at DESC""").fetchall()
            return self.send_json({"materials": [dict(material_json(r), can_edit=may_edit(user, r), uploader=r["uploader"])
                                                 for r in rows],
                                   "is_admin": user["role"] == "admin",
                                   "can_upload": may_upload(user),
                                   "max_upload": MAX_UPLOAD})
        if path == "/api/archives":
            out = {}
            for fn in os.listdir(ARCHIVES):
                fp = os.path.join(ARCHIVES, fn)
                ext = fn.rsplit(".", 1)[-1]
                if os.path.isfile(fp) and not fn.startswith(".") and ext in ("zip", "rar", "7z"):
                    out[ext] = {"name": fn, "size": os.path.getsize(fp), "mtime": int(os.path.getmtime(fp))}
            return self.send_json({"archives": out, "building": ARCHIVER.state["building"] or ARCHIVER.event.is_set(),
                                   "error": ARCHIVER.state["error"] if user["role"] == "admin" else ""})
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
    print(f"Архивы: ZIP — да, 7z — {'да' if TAR7Z else 'нет (нужен bsdtar)'}, RAR — {'да' if RAR else 'нет (нужен rar)'}")
    srv = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    print(f"Hettich · Полезные материалы: http://{HOST}:{PORT}", flush=True)
    srv.serve_forever()
