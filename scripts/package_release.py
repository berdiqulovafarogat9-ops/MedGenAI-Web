"""Build separate Cloudflare static and GitHub source ZIPs without secrets."""
from pathlib import Path
import subprocess
import sys
import zipfile
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent
OUT.mkdir(parents=True, exist_ok=True)
SHA = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
API = 'https://medgenai-web-1.onrender.com/api/v1'
assets = {}
for name in ['index.html', 'app.js', 'styles.css', 'legal.html', 'phase1-academy.js']:
    content = (ROOT / name).read_text()
    if name in ('index.html', 'app.js'):
        content = content.replace(API, '/api/v1')
    if name == 'index.html':
        content = content.replace('<script src="app.js', '<script>window.MEDGEN_API_BASE="/api/v1";</script>\n<script src="app.js', 1)
        # Add only script origins used by the existing 3D viewers.
        for origin in ['https://3dmol.csb.pitt.edu', 'https://cdn.jsdelivr.net']:
            policy = re.search(r"script-src[^;]+", content)
            if policy and origin not in policy.group(0):
                content = content[:policy.end()] + ' ' + origin + content[policy.end():]
    assets[name] = content
for name in ['_worker.js', '_headers', '_routes.json']:
    assets[name] = (ROOT / 'deployment/cloudflare' / name).read_text()
assert 'window.MEDGEN_API_BASE="/api/v1"' in assets['index.html']
assert API not in assets['app.js'] and API not in assets['index.html']
assets['DEPLOY-UZ.txt'] = f'''MedGen AI tekshiruv paketi: {SHA}
Bu butun platforma tayyor degani emas. DEPLOYdan oldin source ichidagi docs/RELEASE-GATES-2026-10-18.md ni o‘qing.
1. Avval MedGenAI-Source.zip ichidagi fayllarni GitHub MedGenAI-Web/main repositoryga yuklang.
   backend/main.py va backend/phase1_academy_ext.py o'z joyida qolishi kerak.
   Render backend auto-deploy tugashini kuting. ZIPni Renderga yuklash funksiyasi yo'q.
2. Cloudflare: Workers & Pages > medgen-ai > Create deployment > Production.
   MedGenAI-Frontend.zip ni yuklang va Save and Deploy bosing.
3. CI natijalari, login, professor ruxsatlari, Learning Hub saqlash va graph chegaralarini tekshiring.
Snapshot versiyasi himoyasi barcha backend yozuvchi jarayonlarda bir xil yangi kod bo‘lishini talab qiladi.
Haqiqiy PostgreSQL, Docker va brauzer E2E tekshiruvlari mahalliy tasdiqlanmagan.
Backend yangilanmasa yangi professor ruxsatlari endpointi ishlamaydi.
Frontend ZIP faqat statik fayllar va API proxy; Python backend ZIP ichida emas.
Lokal testlar live deploy yoki to'liq browser E2E o'rnini bosmaydi.
'''
assets['RELEASE.txt'] = 'Commit: ' + SHA + '\nVerification details: docs/RELEASE-GATES-2026-10-18.md and docs/HARDENING-2026-10-18.md.\nNot a fully validated production release.\n'
with zipfile.ZipFile(OUT / 'MedGenAI-Frontend.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for name, content in assets.items():
        z.writestr(name, content)
# Only version-controlled files; never include credentials, caches or local runtime state.
names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
with zipfile.ZipFile(OUT / 'MedGenAI-Source.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for name in filter(None, names):
        z.write(ROOT / name, name)
for name in ['MedGenAI-Frontend.zip', 'MedGenAI-Source.zip']:
    with zipfile.ZipFile(OUT / name) as z:
        assert z.testzip() is None
        print(name, len(z.namelist()), 'files', (OUT / name).stat().st_size, 'bytes')
