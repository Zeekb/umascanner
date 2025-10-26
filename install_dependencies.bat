@echo off
echo Checking for Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH.
    echo Please install Python from https://www.python.org/downloads/ and make sure to check "Add Python to PATH".
    pause
    exit /b 1
)

echo Python is installed.

echo Installing application dependencies from data/app_requirements.txt...
pip install -r data/app_requirements.txt
if %errorlevel% neq 0 (
    echo Failed to install application dependencies.
    pause
    exit /b 1
)


echo Dependencies installed successfully.
pause