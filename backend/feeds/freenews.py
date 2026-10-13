"""FreeNewsApi transport shared by all background feed jobs."""

import hashlib
import time

import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.cache import cache

API_ROOT = "https://api.freenewsapi.io/v1"


def request_data(endpoint, params, deadline):
    # Atomic Redis add spaces requests to at most 1/sec across distributed worker processes,
    # respecting FreeNewsApi's rate bounds. The key is left to expire naturally (timeout=1)
    # rather than deleted, preventing request bursts.
    while not cache.add("freenews:request-gate", True, timeout=1):
        if time.monotonic() >= deadline:
            raise requests.Timeout("News refresh exceeded its time budget.")
        time.sleep(0.1)
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise requests.Timeout("News refresh exceeded its time budget.")
    # Distinct connect (4s) and read (10s) timeouts strictly bounded by remaining deadline.
    # allow_redirects=False blocks unexpected redirect chains that could leak API keys.
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
    """
    Extracts and caches clean plain text from provider-supplied article HTML.
    Preemptively caching text allows the Gemini summarizer to skip live web scraping,
    reducing separate website requests and connection failures.
    """
    if not isinstance(body, str):
        return
    # Bound input slice to 200,000 characters to protect BeautifulSoup against oversized payload DoS.
    soup = BeautifulSoup(body[:200000], "html.parser")
    for element in soup.select("script, style, noscript"):
        element.decompose()
    # Limit clean plain text to 24,000 characters to fit Gemini context comfortably without token waste.
    text = soup.get_text(" ", strip=True)[:24000]
    if len(text) >= 200:
        cache.set(article_text_key(url), text, 3600)
