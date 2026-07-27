@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
echo. >> scripts\output\worker.log
echo ===== %date% %time% worker start ===== >> scripts\output\worker.log
call npm run video:worker >> scripts\output\worker.log 2>&1
echo ===== %date% %time% worker end ===== >> scripts\output\worker.log
