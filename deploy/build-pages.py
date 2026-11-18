"""Собирает демо-версию сайта для GitHub Pages (статический хостинг, без сервера).

    python deploy/build-pages.py [папка_вывода]     # по умолчанию _site/

Что делает:
  * берёт страницы из web/ и переписывает адреса: /web/... → web/..., /all → all.html и т. п.;
  * подключает web/demo.js — «сервер в браузере» с вымышленными данными;
  * кладёт демо-материалы из demo/ (ролик, картинки, слайды — всё нарисовано для демо);
  * НЕ берёт ничего из files/, assets/, data/ и фон входа web/login-bg.jpg — это материалы компании.
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "_site"))
PAGES = {"index.html": "index.html", "all.html": "all.html", "admin.html": "admin.html", "login.html": "login.html"}
WEB_FILES = ["app.css", "materials.css", "common.js", "materials.js", "demo.js"]  # login-bg.jpg — нет!


def rewrite(html):
    html = html.replace('href="/web/', 'href="web/').replace('src="/web/', 'src="web/')
    html = html.replace('<script src="web/common.js"></script>',
                        '<script src="web/demo.js"></script>\n<script src="web/common.js"></script>')
    html = re.sub(r'href="/all"', 'href="all.html"', html)
    html = re.sub(r'href="/admin"', 'href="admin.html"', html)
    html = re.sub(r'href="/"', 'href="index.html"', html)
    # фон страницы входа — кадр из внутреннего видео; в демо его нет: тёмный фон с фирменными полосами
    html = html.replace("#0d0d0e url(/web/login-bg.jpg) center / cover no-repeat", "#121212")
    html = html.replace("<title>", '<meta name="robots" content="noindex, nofollow">\n<title>', 1)
    html = html.replace("<title>", "<title>Демо · ", 1)
    assert "/web/" not in html, "остался абсолютный путь /web/"
    return html


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "web"))
    for src, dst in PAGES.items():
        with open(os.path.join(ROOT, "web", src), encoding="utf-8") as f:
            html = rewrite(f.read())
        with open(os.path.join(OUT, dst), "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
    for name in WEB_FILES:
        shutil.copy2(os.path.join(ROOT, "web", name), os.path.join(OUT, "web", name))
    shutil.copytree(os.path.join(ROOT, "demo"), os.path.join(OUT, "demo"))
    # GitHub Pages: без Jekyll; неизвестный адрес — на главную
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    with open(os.path.join(OUT, "404.html"), "w", encoding="utf-8") as f:
        f.write('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
                '<title>Демо · Hettich · Полезные материалы</title>'
                '<script>location.replace(location.pathname.replace(/[^/]*$/, "") + "index.html")</script>')
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f"Собрано в {OUT}: {sum(len(fs) for _, _, fs in os.walk(OUT))} файлов, {total / 1024 / 1024:.1f} МБ")


if __name__ == "__main__":
    main()
