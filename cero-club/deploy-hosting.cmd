@echo off
cd /d "%~dp0"
echo Proyecto: cero-club
echo Carpeta: %CD%
call npx -y firebase-tools@latest use cero-club
call npx -y firebase-tools@latest deploy --only hosting
echo.
echo Deploy listo. Proba: https://cero-club.web.app/app/?v=2026052837
pause
