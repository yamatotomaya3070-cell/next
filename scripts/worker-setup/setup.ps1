# 絆 ワーカー セットアップ（YouTube動画生成＋提出動画の検品、Windows 10 / 11）
# 「セットアップ（職員用）.bat」から呼ばれる。事業所で1台だけ、常時起動のパソコンで実行する。
# start-worker.bat が「YouTube動画生成」と「提出動画の検品」の2つのワーカーを別々の窓で起動する。
#
# やること
#   1. Git / Node.js / ffmpeg が無ければ winget で入れる
#   2. アプリのコード一式を GitHub から取ってくる（2回目からは更新）
#   3. 依存パッケージを入れる（npm install）
#   4. 設定ファイル（.env.local）を置く（隣に「設定ファイル.txt」があればそれを使う。無ければ聞く）
#   5. 準備がそろったかを確かめる（scripts/scene/checkWorkerSetup.ts）
#   6. パソコン起動時にワーカーが自動で立ち上がるようにする（スタートアップ）
#   7. ワーカーをいま起動する
param(
  [string]$InstallDir = "$env:LOCALAPPDATA\KizunaWorker\app",
  [string]$RepoUrl = "https://github.com/yamatotomaya3070-cell/next.git",
  [switch]$NoStartup,   # スタートアップに登録しない（動作確認用）
  [switch]$NoStart      # 最後にワーカーを起動しない（動作確認用）
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerTitle = "絆ワーカー"

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  ○ $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "  $msg" }
function RefreshPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function EnsureTool($cmd, $wingetId, $label) {
  if (Has $cmd) { Ok "$label はもう入っています"; return }
  if (-not (Has "winget")) {
    throw "$label が入っておらず、winget も使えません。Microsoft Store で「アプリ インストーラー」を入れてから、もう一度セットアップを実行してください。"
  }
  Info "$label を入れています（数分かかります。確認の画面が出たら「はい」を押してください）..."
  & winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
  RefreshPath
  if (-not (Has $cmd)) {
    throw "$label を入れましたが、まだ見つかりません。パソコンを再起動してから、もう一度セットアップを実行してください。"
  }
  Ok "$label を入れました"
}

function StopWorker {
  # start-worker.bat は窓の題名を「絆ワーカー…」にしている。動いていれば止める（更新のため）
  $procs = Get-Process -Name cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "$workerTitle*" }
  foreach ($p in $procs) {
    Info "動いているワーカー（PID $($p.Id)）をいったん止めます"
    & taskkill /PID $p.Id /T /F | Out-Null
  }
}

function WriteUtf8NoBom($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function MakeShortcut($lnkPath, $target, $workDir, $desc) {
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = $target
  $lnk.WorkingDirectory = $workDir
  $lnk.WindowStyle = 7   # 最小化で開く
  $lnk.Description = $desc
  $lnk.Save()
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 絆 ワーカー セットアップ（YouTube動画生成＋提出動画の検品）" -ForegroundColor Cyan
Write-Host " 入れる場所: $InstallDir"
Write-Host "================================================" -ForegroundColor Cyan

Step 1 "必要なソフトを確かめる"
EnsureTool "git" "Git.Git" "Git"
EnsureTool "node" "OpenJS.NodeJS.LTS" "Node.js"
EnsureTool "ffmpeg" "Gyan.FFmpeg" "ffmpeg"
Info ("Node.js " + (& node -v))

Step 2 "アプリのコードを取ってくる"
StopWorker
if (Test-Path (Join-Path $InstallDir ".git")) {
  Info "もう入っているので、最新に更新します"
  & git -C $InstallDir pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "更新（git pull）に失敗しました。インターネットにつながっているか確かめてください。" }
} else {
  New-Item -ItemType Directory -Force (Split-Path -Parent $InstallDir) | Out-Null
  & git clone --depth 1 $RepoUrl $InstallDir
  if ($LASTEXITCODE -ne 0) { throw "コードの取得（git clone）に失敗しました。インターネットにつながっているか確かめてください。" }
}
Ok ("コード " + (& git -C $InstallDir rev-parse --short HEAD))

Step 3 "依存パッケージを入れる（数分かかります）"
Push-Location $InstallDir
try {
  $env:NODE_ENV = $null
  & npm install --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw "npm install に失敗しました。" }
  Ok "依存パッケージを入れました"
} finally { Pop-Location }

Step 4 "設定ファイルを置く"
$envFile = Join-Path $InstallDir ".env.local"
$supplied = @((Join-Path $here "設定ファイル.txt"), (Join-Path $here ".env.local")) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($supplied) {
  Copy-Item $supplied $envFile -Force
  Ok "隣にあった設定ファイルを使いました: $(Split-Path -Leaf $supplied)"
} elseif (Test-Path $envFile) {
  Ok "設定ファイルはすでにあります（そのまま使います）"
} else {
  Info "開発担当から受け取った3つの値を、順に貼り付けて Enter を押してください。"
  $url = Read-Host "  Supabase の URL (NEXT_PUBLIC_SUPABASE_URL)"
  $key = Read-Host "  Supabase の service role key (SUPABASE_SERVICE_ROLE_KEY)"
  $gem = Read-Host "  Gemini の API キー (GEMINI_API_KEY)"
  if (-not $url -or -not $key -or -not $gem) { throw "3つとも必要です。値をそろえてから、もう一度セットアップを実行してください。" }
  $text = "NEXT_PUBLIC_SUPABASE_URL=$($url.Trim())`nSUPABASE_SERVICE_ROLE_KEY=$($key.Trim())`nGEMINI_API_KEY=$($gem.Trim())`n"
  WriteUtf8NoBom $envFile $text
  Ok "設定ファイルを作りました"
}

Step 5 "準備がそろったか確かめる"
Push-Location $InstallDir
try {
  & npx tsx scripts/scene/checkWorkerSetup.ts
  if ($LASTEXITCODE -ne 0) { throw "上の × の項目を直してから、もう一度セットアップを実行してください。" }
} finally { Pop-Location }

$bat = Join-Path $InstallDir "start-worker.bat"
if (-not $NoStartup) {
  Step 6 "パソコン起動時に自動で立ち上がるようにする"
  $startup = [Environment]::GetFolderPath("Startup")
  MakeShortcut (Join-Path $startup "絆ワーカー.lnk") $bat $InstallDir "絆 ワーカー（YouTube動画生成＋提出動画の検品）の自動起動"
  Ok "スタートアップに登録しました"
  $desktop = [Environment]::GetFolderPath("Desktop")
  MakeShortcut (Join-Path $desktop "絆ワーカーを起動.lnk") $bat $InstallDir "絆 ワーカー（YouTube動画生成＋提出動画の検品）を手で起動する"
  Ok "デスクトップに「絆ワーカーを起動」を置きました"
}

if (-not $NoStart) {
  Step 7 "ワーカーを起動する"
  Start-Process -FilePath $bat -WorkingDirectory $InstallDir -WindowStyle Minimized
  Ok "起動しました（タスクバーに「絆ワーカー」の窓が2つ出ます。どちらも閉じないでください）"
}

Write-Host ""
Write-Host "セットアップが終わりました。" -ForegroundColor Green
Write-Host "アプリの「YouTube動画生成」でテーマを登録すると、このパソコンが5〜6分で案件を作ります。"
Write-Host "利用者が動画を提出すると、このパソコンが完成見本と照合して「提出物レビュー」に結果を出します。"
