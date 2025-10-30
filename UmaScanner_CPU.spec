# -*- mode: python ; coding: utf-8 -*-
import os

torch_lib_path = os.path.join('venv_cpu', 'Lib', 'site-packages', 'torch', 'lib')

vc_dlls_path = 'vc_dlls'

a = Analysis(
    ['src\\main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('data/game_data', 'data/game_data'),
        ('assets/profile_images', 'assets/profile_images'),
        ('src/config.json', 'src'),  
        ('src/conflict_resolver.py', 'src'),
        ('src/data_loader.py', 'src'),
        ('src/data_updater.py', 'src'),
        ('src/image_utils.py', 'src'),
        ('src/ocr_utils.py', 'src'),
        ('src/rankings.py', 'src'),
        ('src/roi_detector.py', 'src'),
        ('src/roi_selector_gui.py', 'src'),
        ('src/schema.py', 'src'),
        ('src/spark_parser.py', 'src'),
        ('src/tabs.py', 'src'),
        ('src/umamusume_parser.py', 'src'),
        (os.path.join(torch_lib_path, 'libiomp5md.dll'), '.'),
        (os.path.join(vc_dlls_path, 'vcruntime140.dll'), '.'),
        (os.path.join(vc_dlls_path, 'msvcp140.dll'), '.')
    ],
    hiddenimports=['modulefinder', 'PIL.ImageEnhance', 'PyQt5'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'cudatoolkit',
        'numpy.random._examples',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    console=True,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='UmaScanner_CPU',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
