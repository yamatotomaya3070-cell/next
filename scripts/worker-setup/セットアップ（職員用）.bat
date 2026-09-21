@echo off
chcp 65001 >nul
title 絆 ワーカー セットアップ
rem ===== 職員用：事業所で1台だけ、常時起動のパソコンで最初に1回実行します =====
rem 必要なソフトを入れ、アプリのコードを取ってきて、YouTube動画生成と提出動画の検品の2つのワーカーを常駐させます。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
if errorlevel 1 (
  echo セットアップは途中で止まりました。上の赤い文を開発担当に伝えてください。
) else (
  echo この窓は閉じて大丈夫です。
)
pause
