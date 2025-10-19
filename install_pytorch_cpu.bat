@echo off
echo Installing PyTorch for CPU...
echo This may take several minutes and download ~700-900 MB of data.

pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

if %errorlevel% neq 0 (
    echo Failed to install PyTorch.
    pause
    exit /b 1
)

echo PyTorch (CPU version) installed successfully.
pause
