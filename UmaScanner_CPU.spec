# -*- mode: python ; coding: utf-8 -*-
import os
vc_dlls_path = 'vc_dlls'

a = Analysis(
    ['src\\main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('data/game_data', 'data/game_data'),
        ('assets/profile_images', 'assets/profile_images'),
        ('src/config.json', 'src'),
        (os.path.join(vc_dlls_path, 'vcruntime140.dll'), '.'),
        (os.path.join(vc_dlls_path, 'msvcp140.dll'), '.'),
        (os.path.join(vc_dlls_path, 'vcruntime140_1.dll'), '.')
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
