@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo   工作生活工作台  正在启动...
echo.

rem ---------- 1. 找 Node：先看 PATH，再用 --version 验证是真是假 ----------
set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do (
  if not defined NODE_EXE (
    "%%I" --version >nul 2>nul && set "NODE_EXE=%%I"
  )
)

rem ---------- 2. 常见安装位置 ----------
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%APPDATA%\nvm\current\node.exe" set "NODE_EXE=%APPDATA%\nvm\current\node.exe"
if not defined NODE_EXE if exist "D:\nodejs\node.exe" set "NODE_EXE=D:\nodejs\node.exe"

rem ---------- 3. WorkBuddy 内置 Node（目录名带版本号，取第一个可用的） ----------
if not defined NODE_EXE (
  for /f "delims=" %%D in ('dir /b /ad /o-n "%USERPROFILE%\.workbuddy\binaries\node\versions" 2^>nul') do (
    if not defined NODE_EXE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\%%D\node.exe" set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\%%D\node.exe"
  )
)

if defined NODE_EXE (
  echo   使用 Node：!NODE_EXE!
  echo   浏览器会自动打开，关闭这个窗口即停止服务。
  echo.
  "!NODE_EXE!" server.js --open
  goto :done
)

rem ---------- 4. 退而用 Python（同样要验证不是商店占位符） ----------
set "PY_EXE="
for /f "delims=" %%I in ('where python 2^>nul') do (
  if not defined PY_EXE (
    "%%I" -c "import sys" >nul 2>nul && set "PY_EXE=%%I"
  )
)
if not defined PY_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

if defined PY_EXE (
  echo   未找到 Node，改用 Python：!PY_EXE!
  echo   地址：http://127.0.0.1:8000/
  echo   关闭这个窗口即停止服务。
  echo.
  start "" http://127.0.0.1:8000/
  "!PY_EXE!" -m http.server 8000 --directory app
  goto :done
)

rem ---------- 5. 最后的兜底：直接打开文件 ----------
echo   没有找到 Node.js 或 Python，改为直接打开网页文件。
echo.
echo   注意：这种方式数据存在浏览器本地，容量较小。
echo   建议定期在「设置」里导出备份。
echo   想要更稳的方式，请安装 Node.js（https://nodejs.org）后重新双击本文件。
echo.
start "" "%~dp0app\index.html"

:done
endlocal
