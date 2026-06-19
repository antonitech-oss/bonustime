@echo off
echo === CREA REPO + DEPLOY ===
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -Command ^
  "$cred = ('protocol=https`nhost=github.com`n' | git credential fill 2>$null); " ^
  "$token = ($cred -split '\n' | Where-Object { $_ -match '^password=' }) -replace 'password=',''; " ^
  "if (!$token) { Write-Host 'Nessun token trovato'; exit 1 }; " ^
  "$h = @{ Authorization='token '+$token; Accept='application/vnd.github.v3+json' }; " ^
  "$b = '{\"name\":\"bonustime\",\"private\":true,\"auto_init\":false}'; " ^
  "try { $r = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method POST -Headers $h -Body $b -ContentType 'application/json'; Write-Host ('Repo creato: '+$r.clone_url) } " ^
  "catch { if ($_.Exception.Response.StatusCode -eq 422) { Write-Host 'Repo gia esistente, ok' } else { Write-Host $_.Exception.Message } }"

echo.
echo Pulizia .git e reinit...
if exist ".git" rd /s /q ".git"
git init -b main
git config user.email "antonybusinesshub@gmail.com"
git config user.name "antonitech-oss"
git remote add origin https://github.com/antonitech-oss/bonustime.git

echo Staging...
git add .
git commit -m "MultiControlClick + SmartTap + Supabase persistence"

echo Push...
git push origin main --force

echo.
echo === DONE ===
pause
