@echo off
setlocal EnableExtensions

title NEXA - GitHub Commit + Push

cd /d "D:\FILES\project\NEXA_nodejs" || (
    echo [ERROR] NEXA repository not found.
    pause
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
    pause
    exit /b 1
)

echo [1/5] Remote:
git remote -v
echo.

echo [2/5] Current branch:
git branch --show-current
echo.

echo [3/5] Changes:
git status --short
echo.

echo [4/5] Staging changes...
git add -A

if errorlevel 1 (
    echo [ERROR] git add failed.
    pause
    exit /b 1
)

git diff --cached --quiet

if not errorlevel 1 (
    echo.
    echo [INFO] Nothing to commit.
    pause
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
    pause
    exit /b 1
)

echo.
echo [5/5] Pushing to GitHub...
git push

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed.
    echo The commit is saved locally.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo          GITHUB PUSH SUCCESSFUL
echo ==========================================
echo.

git log -1 --oneline

echo.
pause
endlocal