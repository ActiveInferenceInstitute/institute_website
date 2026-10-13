import re
from urllib.parse import urlparse, urlunparse

DEAD_HOSTS = {"measure.activeinference.org", "onboard.activeinference.org", "octopus.activeinference.institute"}
SECURE_PROFILE_HOSTS = {"adeelrazi.org", "faculty.washington.edu", "jakubsmekal.com", "www.sandeepramesh.com", "alvaradolab.com", "crowdsmart.ai"}


def institute_host(host):
    return bool(re.search(r"(^|\.)activeinference\.(institute|org)$", host or ""))


def normalized_external_url(value):
    parsed = urlparse(value)
    if institute_host(parsed.hostname) or parsed.hostname in SECURE_PROFILE_HOSTS:
        parsed = parsed._replace(scheme="https")
    return urlunparse(parsed)


def institute_link_errors(href, known_hosts):
    parsed = urlparse(href)
    host = parsed.hostname or ""
    if not institute_host(host):
        return []
    errors = []
    if parsed.scheme == "http":
        errors.append("Institute anchor must use https")
    if host in DEAD_HOSTS:
        errors.append("dead Institute host must render as plain text")
    elif host not in known_hosts:
        errors.append("unknown Institute subdomain must be registered as a known public destination")
    if host == "www.activeinference.institute":
        errors.append("www self-link must use the internal apex route")
    return errors
