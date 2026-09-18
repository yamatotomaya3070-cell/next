@echo off
chcp 65001 >nul
title 絆 ワーカー 更新
rem ===== 職員用：開発担当から「更新してください」と連絡があったときに実行します =====
rem 動いているワーカーを止め、コードを最新にして、もう一度起動します。設定はそのままです。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
if errorlevel 1 (
  echo 更新は途中で止まりました。上の赤い文を開発担当に伝えてください。
) else (
  echo この窓は閉じて大丈夫です。
)
pause
