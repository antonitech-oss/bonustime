@echo off
echo === BONUSTIME DEPLOY ===
cd /d "%~dp0"

echo Pulizia .git precedente...
if exist ".git" rd /s /q ".git"

echo Init git...
git init -b main

git config user.email "antonybusinesshub@gmail.com"
git config user.name "antonitech-oss"

echo Aggiungo remote...
git remote add origin https://github.com/antonitech-oss/bonustime.git

echo Staging tutti i file...
git add .

echo Commit...
git commit -m "MultiControlClick + SmartTap + Supabase persistence"

echo Push su main (force)...
git push origin main --force

echo.
echo === DONE - Vercel si aggiorna automaticamente ===
pause
