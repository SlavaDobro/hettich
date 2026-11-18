# Переносит текущие материалы, базу сотрудников и обложки с этого компьютера на VDS.
# Запускать ПОСЛЕ install.sh на сервере, из папки проекта:
#   powershell -ExecutionPolicy Bypass -File deploy\copy-to-vds.ps1 -Server root@203.0.113.10
# Нужен доступ по SSH-ключу (ssh root@IP должен пускать без пароля или спросит его сам).
param(
    [Parameter(Mandatory = $true)][string]$Server,   # например root@203.0.113.10
    [string]$RemoteDir = '/opt/hettich'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Green }

# 1. Согласованная копия базы (даже если локальный сайт сейчас работает)
Step 'Делаю копию базы сотрудников'
$snap = Join-Path $env:TEMP 'hettich-db-snapshot.db'
python -I -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" `
    (Join-Path $root 'data\hettich.db') $snap
if ($LASTEXITCODE) { throw 'Не получилось скопировать базу' }

# 2. Папки на сервере
Step "Готовлю папки на $Server"
ssh $Server "mkdir -p $RemoteDir/files $RemoteDir/assets/covers $RemoteDir/assets/slides $RemoteDir/data $RemoteDir/web"
if ($LASTEXITCODE) { throw 'Нет доступа по SSH' }

# 3. Файлы (видео и презентации — это долго, гигабайты)
Step 'Копирую материалы (files/) — может занять время'
scp -r "files/." "${Server}:$RemoteDir/files/"
Step 'Копирую обложки и слайды'
if (Test-Path 'assets\covers') { scp -r "assets/covers/." "${Server}:$RemoteDir/assets/covers/" }
if (Test-Path 'assets\slides') { scp -r "assets/slides/." "${Server}:$RemoteDir/assets/slides/" }
if (Test-Path 'web\login-bg.jpg') { scp "web/login-bg.jpg" "${Server}:$RemoteDir/web/login-bg.jpg" }

# 4. База — заменяет пустую базу сервера (сотрудники, ваш пароль и ключ восстановления переедут)
Step 'Переношу базу сотрудников'
ssh $Server "cd $RemoteDir && docker compose -f docker-compose.prod.yml stop app"
scp $snap "${Server}:$RemoteDir/data/hettich.db"
Remove-Item $snap

# 5. Права и перезапуск (фон страницы входа попадает в образ — поэтому --build)
Step 'Перезапускаю сайт на сервере'
ssh $Server "cd $RemoteDir && chown -R 10001:10001 files archives assets data && docker compose -f docker-compose.prod.yml up -d --build"

Step 'Готово. Архивы «Скачать всё» соберутся на сервере сами в течение нескольких минут.'
