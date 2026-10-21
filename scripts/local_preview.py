"""Isolated localhost preview for CI/browser tests. Never uses a production DB."""
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ['DATABASE_URL'] = ''
os.environ['MEDGEN_ADMIN_PASSWORD'] = secrets.token_urlsafe(32)
os.environ['MEDGEN_SECRET_KEY'] = secrets.token_urlsafe(32)
import main
from fastapi.responses import HTMLResponse, FileResponse

@main.app.get('/')
def preview():
    html = (ROOT / 'index.html').read_text()
    return HTMLResponse(html.replace('<head>', '<head><script>window.MEDGEN_API_BASE="/api/v1";</script>', 1))

@main.app.get('/{asset}')
def static_asset(asset: str):
    if asset not in {'app.js', 'ux.js', 'opportunities.js', 'styles.css', 'legal.html', 'phase1-academy.js', 'phase1-controller.js', 'phase1-shell.js'}:
        raise main.HTTPException(404)
    return FileResponse(ROOT / asset)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(main.app, host='127.0.0.1', port=8080)
