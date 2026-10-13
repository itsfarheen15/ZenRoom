"""FreeNewsApi transport shared by all background feed jobs."""

import hashlib
import time

import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.cache import cache

API_ROOT = "https://api.freenewsapi.io/v1"


def request_data(endpoint, params, deadline):
    # Atomic Redis add spaces requests across worker processes. Leave the gate
    # to expire: deleting it after a response would allow a burst of requests.
    while not cache.add("freenews:request-gate", True, timeout=1):
        if time.monotonic() >= deadline:
            raise requests.Timeout("News refresh exceeded its time budget.")
        time.sleep(0.1)
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise requests.Timeout("News refresh exceeded its time budget.")
    response = requests.get(
        f"{API_ROOT}/{endpoint}", params=params,
        headers={"x-api-key": settings.FREENEWS_API_KEY},
        timeout=(min(4, remaining), min(10, remaining)), allow_redirects=False,
    )
    response.raise_for_status()
    if response.is_redirect:
        raise ValueError("Unexpected news provider redirect.")
    payload = response.json()
    if not isinstance(payload, dict) or "error" in payload or "data" not in payload:
        raise ValueError("Invalid FreeNewsApi payload.")
    return payload["data"]


def article_text_key(url):
    return "freenews:article-text:" + hashlib.sha256(url.encode()).hexdigest()


def store_article_text(url, body):
    if not isinstance(body, str):
        return
    soup = BeautifulSoup(body[:200000], "html.parser")
    for element in soup.select("script, style, noscript"):
        element.decompose()
    text = soup.get_text(" ", strip=True)[:24000]
    if len(text) >= 200:
        cache.set(article_text_key(url), text, 3600)
