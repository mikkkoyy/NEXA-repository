@echo off
setlocal EnableExtensions

title NEXA - GitHub Commit + Push

cd /d "D:\FILES\project\NEXA_nodejs" || (
    echo [ERROR] NEXA repository not found.
    timeout /t 3 /nobreak >nul
    exit /b 1
)

echo.
echo ==========================================
echo       NEXA - GITHUB COMMIT + PUSH
echo ==========================================
echo.
echo Repository:
echo D:\FILES\project\NEXA_nodejs
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This folder is not a Git repository.
    timeout /t 3 /nobreak >nul
    exit /b 1
)

echo [1/6] Remote:
git remote -v
echo.

echo [2/6] Branch:
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
echo %BRANCH%
echo.

if /I not "%BRANCH%"=="main" (
    echo [ERROR] Current branch is not main.
    echo Expected: main
    timeout /t 3 /nobreak >nul
    exit /b 1
)

echo [3/6] Current commit:
git log -1 --oneline
echo.

echo [4/6] Changes:
git status --short
echo.

echo [5/6] Staging changes...
git add -A

if errorlevel 1 (
    echo [ERROR] git add failed.
    timeout /t 3 /nobreak >nul
    exit /b 1
)

git diff --cached --quiet

if not errorlevel 1 (
    echo.
    echo [INFO] Nothing to commit.
    echo.
    echo Current GitHub target:
    git remote get-url origin
    echo.
    timeout /t 2 /nobreak >nul
    exit /b 0
)

set "COMMIT_MSG=NEXA: repair creator marketplace and ID consistency"

echo.
echo Commit message:
echo %COMMIT_MSG%
echo.

git commit -m "%COMMIT_MSG%"

if errorlevel 1 (
    echo.
    echo [ERROR] Commit failed.
    timeout /t 3 /nobreak >nul
    exit /b 1
)

echo.
echo [6/6] Pushing to GitHub...
echo.

git push origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed.
    echo The commit is saved locally.
    timeout /t 4 /nobreak >nul
    exit /b 1
)

echo.
echo ==========================================
echo          GITHUB PUSH SUCCESSFUL
echo ==========================================
echo.

echo Latest commit:
git log -1 --oneline

echo.
echo GitHub branch:
git branch --show-current

echo.
echo Remote:
git remote get-url origin

echo.
echo ==========================================
echo   WISPBYYTE AUTO-UPDATE REQUIREMENT
echo ==========================================
echo.
echo Wispbyte must have:
echo.
echo AUTO_UPDATE=1
echo JS_FILE=src/index.js
echo.
echo Wispbyte must also be deployed from the
echo Git repository so that .git exists.
echo.
echo This BAT only pushes to GitHub.
echo It does NOT update Wispbyte directly.
echo.

echo Closing automatically...
timeout /t 3 /nobreak >nul

endlocal
exit /b 0
