"""Bounded subject matching, never inferred from a publisher or country tag."""
import re
import requests
from datetime import timedelta
from difflib import SequenceMatcher
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from django.core.cache import cache
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .freenews import request_data, store_article_text

# Lexical search keywords targeting prominent cities, institutions, and leaders.
SEARCH_TERMS = ("India", "Indian", "Delhi", "Mumbai", "Bengaluru", "Modi")
# Bounded subject regex for Indian cities, states, institutions, and national bodies.
SUBJECT = re.compile(r"\b(?:india|indians?|bharat|new delhi|delhi|mumbai|bengaluru|bangalore|chennai|kolkata|hyderabad|pune|kerala|gujarat|maharashtra|tamil nadu|uttar pradesh|punjab|karnataka|rajasthan|narendra modi|isro|reserve bank of india|lok sabha|rajya sabha)\b", re.I)
# Exclude geographical and historical false-positives that mention 'Indian' without relating to the nation of India.
AMBIGUOUS = re.compile(r"\b(?:indian ocean|american indians?|west indians?|indian wells|indianapolis|indiana)\b", re.I)
# Common English stopwords and wire boilerplate stripped during title similarity comparison.
STOP = set("a an the of in on for to and as with from by at over after says said india indian new live updates breaking news".split())


def about_india(article):
    # Country/publisher metadata does not reliably establish the story subject. Filter on
    # article title and incipit (lead paragraph) text after removing ambiguous expressions.
    text = " ".join(article.get(k, "") for k in ("title", "incipit") if isinstance(article.get(k), str))
    return bool(SUBJECT.search(AMBIGUOUS.sub(" ", text)))


def publication(value):
    try:
        parsed = parse_datetime(value) if isinstance(value, str) else None
        return parsed if parsed and timezone.is_aware(parsed) else None
    except ValueError:
        return None


def same_story(a, b):
    """
    Detects syndicated wire duplicates (e.g. PTI/ANI copies published across multiple outlets)
    using sequence similarity (>= 86%) or high shared non-stopword overlap (>= 65% with 4+ words).
    """
    def words(title):
        return [w for w in re.findall(r"\w+", title.lower()) if w not in STOP]
    aa, bb = words(a), words(b)
    if not aa or not bb:
        return a.casefold() == b.casefold()
    shared = len(set(aa) & set(bb))
    return (SequenceMatcher(None, " ".join(aa), " ".join(bb)).ratio() >= .86
            or (shared >= 4 and shared / len(set(aa) | set(bb)) >= .65))


def fetch_india(deadline, safe_url):
    """
    Harvests up to 5 distinct India stories published in the past 72 hours.
    Falls back gracefully to a bounded global scan if the provider's title search returns 5xx.
    """
    now = timezone.now()
    # 72-hour cutoff prevents stale articles from circulating.
    cutoff = now - timedelta(hours=72)
    candidates = {}
    coverage = "Bounded title searches and text relevance checks; coverage may be incomplete."
    base = {"language": "en", "order_by": "recent", "published_after": cutoff.isoformat()}

    def collect(rows):
        if not isinstance(rows, list):
            raise ValueError("Invalid India candidate list.")
        for row in rows[:10]:
            if not isinstance(row, dict) or not about_india(row):
                continue
            try:
                identity = str(UUID(row.get("uuid", "")))
            except (ValueError, TypeError, AttributeError):
                continue
            date = publication(row.get("published_at"))
            # Disallow dates older than 72 hours or more than 5 minutes into the future.
            if date and cutoff <= date <= now + timedelta(minutes=5):
                candidates[identity] = (date, row)

    # Bounded query loop: at most eight listing calls total (including retry/pagination).
    calls = 0
    for term in (*SEARCH_TERMS, None):
        params = {**base, **({"in_title": term} if term else {})}
        calls += 1
        try:
            collect(request_data("news", params, deadline))
        except requests.HTTPError as exc:
            # FreeNewsApi title search intermittently returns HTTP 500.
            # When this occurs, gracefully fall back to scanning recent global pages.
            if not term or exc.response is None or exc.response.status_code < 500:
                raise
            coverage = "Provider title search unavailable; relevance checked within a limited scan of recent global headlines."
            for page in range(8 - calls):
                rows = request_data("news", {**base, "offset": page * 10}, deadline)
                collect(rows)
                if len(rows) < 10:
                    break
            break
    items = []
    # Inspect at most 20 candidate UUIDs to fetch full details and original article links.
    for identity, _ in sorted(candidates.items(), key=lambda pair: pair[1][0], reverse=True)[:20]:
        key = f"freenews:details:{identity}"
        detail = cache.get(key)
        if detail is None:
            try:
                detail = request_data("details", {"uuid": identity}, deadline)
            except requests.HTTPError as exc:
                if exc.response is not None and exc.response.status_code == 404:
                    continue
                raise
            if not isinstance(detail, dict) or detail.get("uuid") != identity:
                raise ValueError("Invalid India article details.")
            # Cache details for 1 hour to prevent redundant HTTP requests across runs.
            cache.set(key, detail, 3600)
        url = safe_url(detail.get("original_url"))
        date = publication(detail.get("published_at"))
        title = detail.get("title")
        if not url or not isinstance(title, str) or not title.strip() or not date or not cutoff <= date <= now + timedelta(minutes=5) or not about_india(detail):
            continue
        items.append({"title": title.strip(), "url": url, "description": str(detail.get("incipit") or "")[:500],
                      "source": detail["publisher"] if isinstance(detail.get("publisher"), str) and detail["publisher"] else "Unknown source", "published_at": date.isoformat()})
        store_article_text(url, detail.get("body"))
    # Deduplicate against canonical URLs and syndicated wire headlines.
    unique, urls = [], set()
    for item in sorted(items, key=lambda item: publication(item["published_at"]), reverse=True):
        parts = urlsplit(item["url"])
        canonical = urlunsplit((parts.scheme, parts.netloc.lower(), parts.path.rstrip("/"), "", ""))
        if canonical in urls or any(same_story(item["title"], prior["title"]) for prior in unique):
            continue
        urls.add(canonical)
        unique.append(item)
        if len(unique) == 5:
            break
    return unique, coverage
