#!/usr/bin/env bash
# Публикует демо-версию на GitHub Pages (ветка gh-pages):
#   bash deploy/publish-pages.sh
# Сайт: https://slavadobro.github.io/hettich/
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python -I deploy/build-pages.py "$TMP/site"
cd "$TMP/site"
git init -q -b gh-pages
git add -A
git -c core.quotepath=false commit -q -m "Демо-версия для GitHub Pages ($(date '+%Y-%m-%d %H:%M'))"
git push -f -q "$REMOTE" gh-pages
echo "Опубликовано: https://slavadobro.github.io/hettich/ (обновление занимает 1–2 минуты)"
