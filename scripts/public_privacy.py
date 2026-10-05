"""Shared phone and private-field matching for public export boundaries."""

from __future__ import annotations

import re
from typing import Final

# Compact numbers require an explicit telephone cue; bare digits also identify
# publications, videos, timestamps, and other legitimate public records.
PHONE_RE: Final = re.compile(
    r"(?<![A-Za-z0-9])(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}"
    r"|(?<![A-Za-z0-9])(?:tel:\s*\+?1?|(?:call|phone|telephone|mobile)\s*[:=]?\s*\+?1?)\d{10}(?!\d)"
    r"|(?<![A-Za-z0-9])\+1\d{10}(?!\d)",
    re.IGNORECASE,
)
PRIVATE_ALIASES: Final = {
    "emailaddress": "email",
    "homeaddress": "address",
    "mailingaddress": "address",
    "postaladdress": "address",
    "phonenumber": "phone",
    "privatenotes": "notes",
    "primarycontact": "primary_contact",
}


def private_key(key: str, blocked: set[str]) -> str | None:
    """Recognize canonical, camel-case, and delimiter-separated private fields."""
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key).lower()
    tokens = set(re.split(r"[^a-z0-9]+", normalized))
    compact = re.sub(r"[^a-z0-9]", "", normalized)
    alias = PRIVATE_ALIASES.get(compact)
    if alias in blocked:
        return alias
    matches = sorted(tokens & blocked)
    return matches[0] if matches else None
