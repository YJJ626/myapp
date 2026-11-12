@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8000/
  python -m http.server 8000 --directory app
  goto :eof
)
start "" "%~dp0app\index.html"
