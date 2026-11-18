#!/usr/bin/env bash
# Установка «Hettich · Полезные материалы» на чистый VDS (Ubuntu 22.04/24.04 или Debian 12).
#
#   curl -fsSL https://raw.githubusercontent.com/SlavaDobro/hettich/main/deploy/install.sh -o install.sh
#   sudo bash install.sh files.example.ru        # с доменом — будет HTTPS
#   sudo bash install.sh                         # без домена — http://IP (только для проверки)
#
# Повторный запуск безопасен: обновит код из GitHub и перезапустит сайт, данные не трогает.
set -euo pipefail

REPO="https://github.com/SlavaDobro/hettich.git"
DIR="/opt/hettich"
DOMAIN="${1:-}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "запустите через sudo: sudo bash install.sh ${DOMAIN}"
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) die "скрипт рассчитан на Ubuntu или Debian, у вас: $PRETTY_NAME" ;; esac

# 1. Docker из официального репозитория Docker
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  say "Устанавливаю Docker"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  say "Docker уже установлен: $(docker --version)"
  command -v git >/dev/null 2>&1 || { apt-get update -qq; apt-get install -y -qq git; }
fi

# 2. Код сайта
if [ -d "$DIR/.git" ]; then
  say "Обновляю код в $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Скачиваю код в $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"
mkdir -p files archives assets/covers assets/slides data
# сайт в контейнере работает не от root, а от пользователя с uid 10001 — ему нужна запись в эти папки
chown -R 10001:10001 files archives assets data

# 3. Настройки (.env создаётся один раз, дальше не перезаписывается)
if [ ! -f .env ]; then
  cp .env.example .env
  if [ -n "$DOMAIN" ]; then
    sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
  else
    sed -i "s|^DOMAIN=.*|DOMAIN=:80|; s|^SECURE_COOKIES=.*|SECURE_COOKIES=0|" .env
    say "Домен не указан — сайт будет по http://IP без шифрования. Для работы укажите домен."
  fi
elif [ -n "$DOMAIN" ]; then
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|; s|^SECURE_COOKIES=.*|SECURE_COOKIES=1|" .env
fi
say "Настройки: $(grep -E '^(DOMAIN|SECURE_COOKIES)=' .env | tr '\n' ' ')"

# 4. Брандмауэр (если включён ufw)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "Открываю порты 80 и 443 в ufw"
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
fi

# 5. Запуск
say "Собираю и запускаю сайт"
docker compose -f docker-compose.prod.yml up -d --build

say "Жду запуска"
for _ in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml logs app 2>/dev/null | grep -q "Полезные материалы: http"; then break; fi
  sleep 2
done
docker compose -f docker-compose.prod.yml ps

# 6. Первый администратор
if docker compose -f docker-compose.prod.yml logs app 2>/dev/null | grep -q "Администратор создан"; then
  say "Первый вход (пароль показывается только здесь — сохраните его):"
  docker compose -f docker-compose.prod.yml logs app 2>/dev/null | grep -A3 "Администратор создан" | sed 's/^[^|]*| //'
fi

IP=$(curl -fsS4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
if [ -n "$DOMAIN" ]; then
  say "Готово: https://${DOMAIN}  (A-запись домена должна указывать на ${IP})"
else
  say "Готово: http://${IP}"
fi
