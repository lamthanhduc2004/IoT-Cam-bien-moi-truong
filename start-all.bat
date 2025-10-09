@echo off
title IoT System Launcher
color 0A

echo.
echo ========================================
echo    IOT SYSTEM - ALL IN ONE LAUNCHER
echo ========================================
echo.

REM Check if .env exists
if not exist "server\.env" (
    echo [WARNING] Backend .env file not found!
    echo Creating from config.env...
    copy "server\config.env" "server\.env" >nul
    echo [OK] Created server\.env - Please update your credentials!
    echo.
    timeout /t 3 >nul
)

REM Check Backend dependencies
if not exist "server\node_modules" (
    echo [WARNING] Backend dependencies not installed!
    echo Installing backend dependencies...
    cd server
    call npm install
    cd ..
    echo [OK] Backend dependencies installed!
    echo.
)

REM Check Frontend dependencies
if not exist "iot-dashboard\node_modules" (
    echo [WARNING] Frontend dependencies not installed!
    echo Installing frontend dependencies...
    cd iot-dashboard
    call npm install
    cd ..
    echo [OK] Frontend dependencies installed!
    echo.
)

echo Starting all services...
echo.

REM Start MQTT Broker
echo [1/3] Starting MQTT Broker...
start "MQTT Broker" cmd /k "cd /d "C:\HOC TAP\IOT\Web" && mosquitto -c mqtt-broker\broker.conf -v"
timeout /t 3 >nul

REM Start Backend Server
echo [2/3] Starting Backend Server...
start "Backend Server" cmd /k "cd /d "C:\HOC TAP\IOT\Web\server" && npm run dev"
timeout /t 5 >nul

REM Start Frontend
echo [3/3] Starting Frontend Dashboard...
start "Frontend Dashboard" cmd /k "cd /d "C:\HOC TAP\IOT\Web\iot-dashboard" && npm run dev"
timeout /t 3 >nul

echo.
echo ========================================
echo    ALL SERVICES STARTED!
echo ========================================
echo.
echo MQTT Broker:  Running on port 1883 (TCP) and 9001 (WebSocket)
echo Backend API:  http://localhost:3000
echo Frontend UI:  http://localhost:5173
echo.
echo Waiting 10 seconds for services to initialize...
timeout /t 10 >nul

echo.
echo Opening Frontend in browser...
start http://localhost:5173

echo.
echo ========================================
echo    SYSTEM IS READY!
echo ========================================
echo.
echo All services are running in separate windows.
echo To stop: Close all terminal windows.
echo.
echo Useful commands:
echo   - Check Backend Health: http://localhost:3000/api/health
echo   - Frontend Dashboard:   http://localhost:5173
echo   - MQTT TCP Port:        1883
echo   - MQTT WebSocket:       9001
echo.
echo Tips for demo:
echo   1. Wait for all services to show "ready" status
echo   2. Check ESP32 is connected and sending data
echo   3. Open Postman for API demonstration
echo.
pause