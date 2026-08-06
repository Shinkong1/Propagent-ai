"""Shared rate limiter instance"""
from slowapi import Limiter
from starlette.requests import Request


def get_real_client_ip(request: Request) -> str:
    """slowapi's default get_remote_address reads request.client.host, which
    is the TCP peer address -- behind Render's (Cloudflare-fronted) proxy
    that's the proxy's own connection, not the real client, and it isn't
    even stable request-to-request. That silently made every rate limit a
    no-op in production: every request looked like a different, single-use
    "client" so the per-IP counter never accumulated. Use the client IP the
    proxy chain actually reports instead. CF-Connecting-IP is set by
    Cloudflare itself (Render's edge) and can't be spoofed by the client,
    since Cloudflare overwrites it rather than passing through whatever the
    request arrived with; fall back to the first hop of X-Forwarded-For,
    then the raw connection as a last resort."""
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_real_client_ip)
