@echo off
cd /d "C:\Users\Krish Patel\Desktop\CARGOFLOW"
echo Starting CargoFlow dev server + public tunnel...
echo.
echo Step 1: starting Next.js dev server...
start "cargoflow-dev" cmd /c "npm run dev > dev.log 2> dev.err.log"
echo Step 2: waiting for server on port 3000...
:wait
timeout /t 2 /nobreak > nul
netstat -an | findstr /r ":3000 .*LISTENING" > nul
if errorlevel 1 goto wait
echo Step 3: starting public tunnel...
start "cargoflow-tunnel" cmd /c "npx --yes localtunnel --port 3000 > tunnel.log 2> tunnel.err.log"
echo.
echo Waiting for tunnel URL...
timeout /t 8 /nobreak > nul
type tunnel.log
echo.
echo Done. The current tunnel URL is shown above.
