@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
echo. >> scripts\output\inspect-worker.log
echo ===== %date% %time% inspect-worker start ===== >> scripts\output\inspect-worker.log
call npm run video:inspect-worker >> scripts\output\inspect-worker.log 2>&1
echo ===== %date% %time% inspect-worker end ===== >> scripts\output\inspect-worker.log
