#!/usr/bin/env python3
"""Pack www/ into dist/site-inspector-pwa.zip for upload to any HTTPS host (cPanel/DirectAdmin/Netlify). No network, no Node, no GitHub needed."""
import pathlib, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
www = root / 'www'
out = root / 'dist'; out.mkdir(exist_ok=True)
target = out / 'site-inspector-pwa.zip'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(www.rglob('*')):
        if f.is_file(): z.write(f, f.relative_to(www).as_posix())
print(target, target.stat().st_size, 'bytes')
