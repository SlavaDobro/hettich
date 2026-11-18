#!/usr/bin/env bash
# Обновляет демо-версию на GitHub Pages (публикация из корня ветки main):
#   bash deploy/publish-pages.sh
# Сайт: https://slavadobro.github.io/hettich/
set -euo pipefail
cd "$(dirname "$0")/.."

python -I deploy/build-pages.py --root
git add index.html all.html admin.html login.html 404.html .nojekyll web demo
if git diff --cached --quiet; then
  echo "Демо уже актуально."
  exit 0
fi
git -c core.quotepath=false commit -q -m "Демо на GitHub Pages: обновление страниц"
git push -q
echo "Опубликовано: https://slavadobro.github.io/hettich/ (обновление занимает 1–2 минуты)"
