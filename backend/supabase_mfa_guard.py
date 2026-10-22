"""FastAPI dependency for *migrated* MedGen endpoints only.

Pip install httpx (pin version in your project's requirements.lock).
This MUST replace (not run alongside) legacy token auth for protected APIs.
No Supabase service-role key or JWT signing secret is ever used client-side.
"""

from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlparse

import httpx
from fastapi import Depends, Header, HTTPException


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str
    aal: str
    verification: str


def _config() -> tuple[str, str]:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    parsed = urlparse(base)
    if parsed.scheme != "https" or not parsed.hostname or not key:
        raise RuntimeError("SUPABASE_URL (https) va SUPABASE_PUBLISHABLE_KEY talab qilinadi")
    return base, key


def _claims_after_remote_verification(token: str) -> dict:
    """ONLY parse this JWT *after* Supabase Auth verified the identical token.

    Parsing does NOT verify its signature; Auth's /user endpoint validates
    token validity and authorization before this is called.
    """
    try:
        segments = token.split(".")
        if len(segments) != 3:
            raise ValueError("bad segments")
        piece = segments[1]
        decoded = base64.urlsafe_b64decode(piece + "=" * (-len(piece) % 4))
        claims = json.loads(decoded)
        if not isinstance(claims, dict):
            raise ValueError("bad claims")
        return claims
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc


async def get_supabase_principal(authorization: str | None = Header(default=None)) -> Principal:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization[7:].strip()
    if not token or len(token) > 12000:
        raise HTTPException(status_code=401, detail="Invalid access token")

    base, key = _config()
    headers = {"apikey": key, "Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            user_response = await client.get(f"{base}/auth/v1/user", headers=headers)
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Supabase authentication failed")
            user_id = user_response.json().get("id")
            if not isinstance(user_id, str) or not user_id:
                raise HTTPException(status_code=401, detail="Missing auth user")

            # Trust aal only after remote verification succeeded, then bind
            # the claims to the returned user, issuer, audience and expiry.
            claims = _claims_after_remote_verification(token)
            audience = claims.get("aud")
            valid_aud = audience == "authenticated" or (
                isinstance(audience, list) and "authenticated" in audience
            )
            if (
                claims.get("sub") != user_id
                or claims.get("iss") != f"{base}/auth/v1"
                or not valid_aud
                or not isinstance(claims.get("exp"), (float, int))
                or claims["exp"] <= time.time()
            ):
                raise HTTPException(status_code=401, detail="Invalid auth claims")

            profile_response = await client.get(
                f"{base}/rest/v1/profiles",
                headers=headers,
                params={"id": f"eq.{user_id}", "select": "role,verification", "limit": "1"},
            )
            if profile_response.status_code != 200:
                raise HTTPException(status_code=403, detail="Profile inaccessible")
            rows = profile_response.json()
            if not isinstance(rows, list) or len(rows) != 1:
                raise HTTPException(status_code=403, detail="Profile not found")
            profile = rows[0]
            return Principal(
                user_id=user_id,
                role=profile["role"],
                verification=profile.get("verification", "none"),
                aal=claims.get("aal", "aal1"),
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Identity provider unavailable") from exc


def require_role_with_mfa(*allowed_roles: str) -> Callable:
    """Use as a Depends() on protected, Supabase-authenticated routes."""
    async def dependency(principal: Principal = Depends(get_supabase_principal)) -> Principal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        if principal.role in {"doctor", "researcher", "pharma"} and principal.verification != "approved":
            raise HTTPException(status_code=403, detail="Professional role not verified")
        if principal.aal != "aal2":
            raise HTTPException(status_code=403, detail="MFA_REQUIRED")
        return principal
    return dependency

# In an existing app ONLY after its login/token migration is complete:
# @app.get('/api/v1/clinical/private')
# async def clinical(principal: Principal = Depends(require_role_with_mfa('doctor','super_admin'))):
#     return {'user_id': principal.user_id}
