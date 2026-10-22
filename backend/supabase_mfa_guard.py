"""Supabase Auth + MFA verifier for MedGen STAGING endpoints only.

No third-party HTTP client dependency. All database access uses the user's
own verified Supabase token (and the project's PUBLIC publishable key).
Do not use this as a replacement for legacy MedGen tokens or sessions.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import Depends, Header, HTTPException


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str
    verification: str
    aal: str


def _config() -> tuple[str, str]:
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
    parsed = urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or not key:
        raise HTTPException(status_code=503, detail='Supabase identity check not configured')
    return base, key


def _verified_claims(token: str, verified_id: str, base: str) -> dict:
    """Decode only AFTER /auth/v1/user accepted the identical bearer token."""
    try:
        sections = token.split('.')
        if len(sections) != 3:
            raise ValueError('invalid token structure')
        encoded = sections[1]
        raw = base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4))
        claims = json.loads(raw)
        if not isinstance(claims, dict):
            raise ValueError('bad claims')
        aud = claims.get('aud')
        valid_audience = aud == 'authenticated' or (isinstance(aud, list) and 'authenticated' in aud)
        if (claims.get('sub') != verified_id or
                claims.get('iss') != base + '/auth/v1' or
                not valid_audience or
                type(claims.get('exp')) not in (int, float) or
                claims['exp'] <= time.time() or
                claims.get('aal') not in ('aal1', 'aal2')):
            raise ValueError('claims mismatched')
        return claims
    except (ValueError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail='Invalid Supabase access token') from exc


class _DenyRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward an access token to another host via redirect.
        return None


def _fetch_json(url: str, headers: dict) -> object:
    req = Request(url, headers=headers, method='GET')
    try:
        with build_opener(_DenyRedirects()).open(req, timeout=8) as response:
            if response.status != 200:
                raise HTTPException(status_code=401, detail='Supabase authentication failed')
            body = response.read(65537)
            if len(body) > 65536:
                raise HTTPException(status_code=502, detail='Unexpected identity provider response')
            return json.loads(body.decode('utf-8'))
    except HTTPError as exc:
        if exc.code in (400, 401, 403):
            raise HTTPException(status_code=401, detail='Supabase authentication failed') from exc
        raise HTTPException(status_code=503, detail='Supabase identity service unavailable') from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise HTTPException(status_code=503, detail='Supabase identity service unavailable') from exc
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(status_code=502, detail='Invalid identity provider response') from exc


def _check_supabase(token: str) -> Principal:
    base, key = _config()
    headers = {'apikey': key, 'Authorization': 'Bearer ' + token}
    user = _fetch_json(base + '/auth/v1/user', headers)
    if not isinstance(user, dict):
        raise HTTPException(status_code=401, detail='Supabase user not found')
    user_id = user.get('id')
    try:
        user_id = str(uuid.UUID(user_id))
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=401, detail='Invalid Supabase identity') from exc
    claims = _verified_claims(token, user_id, base)
    query = urlencode({'select': 'role,verification', 'id': 'eq.' + user_id, 'limit': '1'})
    rows = _fetch_json(base + '/rest/v1/profiles?' + query, headers)
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        raise HTTPException(status_code=403, detail='Profile missing or inaccessible')
    profile = rows[0]
    role = profile.get('role')
    if role not in ('student', 'doctor', 'researcher', 'pharma', 'super_admin'):
        raise HTTPException(status_code=403, detail='Unexpected account role')
    return Principal(user_id=user_id, role=role,
                     verification=str(profile.get('verification', 'none')),
                     aal=claims['aal'])


async def get_supabase_principal(authorization: str | None = Header(default=None)) -> Principal:
    if not isinstance(authorization, str) or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Supabase bearer token required')
    token = authorization[7:].strip()
    if not token or len(token) > 12000 or re.search(r'\s', token):
        raise HTTPException(status_code=401, detail='Invalid bearer token')
    return await asyncio.to_thread(_check_supabase, token)


def require_role_with_mfa(*allowed_roles: str) -> Callable:
    async def dependency(principal: Principal = Depends(get_supabase_principal)) -> Principal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=403, detail='Insufficient role')
        if principal.role in {'doctor', 'researcher', 'pharma'} and principal.verification != 'approved':
            raise HTTPException(status_code=403, detail='Professional role not verified')
        if principal.aal != 'aal2':
            raise HTTPException(status_code=403, detail='MFA_REQUIRED')
        return principal
    return dependency
