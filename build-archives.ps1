# Packs everything in .\files into three archives: ZIP, RAR, 7z.
# Run again whenever you add or replace files:   powershell -ExecutionPolicy Bypass -File .\build-archives.ps1
# Needs: Windows 10/11 built-in tar.exe (ZIP + 7z) and WinRAR (RAR).
# Video/PPTX are already compressed, so files are stored without recompression (fast, same size).

$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$name   = 'Hettich_Poleznye_materialy'
$out    = Join-Path $root 'archives'
$rarExe = 'C:\Program Files\WinRAR\Rar.exe'
New-Item -ItemType Directory -Force $out | Out-Null

$files = Get-ChildItem (Join-Path $root 'files') -File | Sort-Object Name
if (-not $files) { throw 'No files in .\files' }

# Staging folder made of hard links (no extra disk space), so archives contain one neat top folder.
$stage = Join-Path $out '.staging'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $stage $name) | Out-Null
foreach ($f in $files) {
    $link = Join-Path (Join-Path $stage $name) $f.Name
    try { New-Item -ItemType HardLink -Path $link -Target $f.FullName | Out-Null }
    catch { Copy-Item $f.FullName $link }
}

Push-Location $stage
try {
    foreach ($ext in 'zip', '7z', 'rar') { Remove-Item (Join-Path $out "$name.$ext") -ErrorAction SilentlyContinue }

    Write-Host '[1/3] ZIP...'
    & tar.exe -c -f (Join-Path $out "$name.zip") --format zip --options 'zip:compression=store' $name
    if ($LASTEXITCODE) { throw 'ZIP failed' }

    Write-Host '[2/3] 7z...'
    & tar.exe -c -f (Join-Path $out "$name.7z") --format 7zip --options '7zip:compression=store' $name
    if ($LASTEXITCODE) { throw '7z failed' }

    Write-Host '[3/3] RAR...'
    if (Test-Path $rarExe) {
        & $rarExe a -m0 -ma5 -idq -r (Join-Path $out "$name.rar") $name
        if ($LASTEXITCODE) { throw 'RAR failed' }
    } else { Write-Warning "WinRAR not found at $rarExe - RAR skipped" }
} finally {
    Pop-Location
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}

Get-ChildItem $out | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } } | Format-Table -AutoSize
