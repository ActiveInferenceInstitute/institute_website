#!/usr/bin/env python3
"""Convert manuscript/references.bib from act_inf_metaanalysis to structured JSON.

Reads the BibTeX file, groups entries by section comment, and writes a JSON
file with structured citation data for the institute_website bibliography page.

Usage:
  python scripts/generate_bibliography.py \\
    --bib /path/to/act_inf_metaanalysis/manuscript/references.bib \\
    --out src/content/bibliography.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = PROJECT_ROOT / "src" / "content" / "bibliography.json"

# Regex to parse BibTeX entries
ENTRY_RE = re.compile(
    r'@(\w+)\s*\{\s*(\w+)\s*,\s*\n(.*?)\n\}',
    re.DOTALL,
)
FIELD_RE = re.compile(r'(\w+)\s*=\s*[{"](.+?)[}"],?\s*$', re.MULTILINE)

# Known section anchors from bib comments
SECTION_RE = re.compile(r'^%\s*(.+)$', re.MULTILINE)


def parse_bibtex(text: str) -> list[dict]:
    """Parse BibTeX text into a list of structured entry dicts."""
    entries = []
    current_section = "References"

    # Split into lines and track sections
    lines = text.split('\n')

    # Manual parse: find @type{key, ... } blocks
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Track section comments
        section_match = SECTION_RE.match(line)
        if section_match:
            section_title = section_match.group(1).strip()
            if section_title and not section_title.startswith('===') and not section_title.startswith('NOTE'):
                current_section = section_title
            i += 1
            continue

        # Match entry start
        entry_match = re.match(r'@(\w+)\s*\{\s*(\w+)\s*,', line)
        if entry_match:
            entry_type = entry_match.group(1)
            entry_key = entry_match.group(2)

            # Collect all lines until closing }
            body_lines = []
            depth = 1
            i += 1
            while i < len(lines) and depth > 0:
                for ch in lines[i]:
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                if depth > 0:
                    body_lines.append(lines[i])
                i += 1

            body = '\n'.join(body_lines)

            # Parse fields
            fields = {}
            # Match field = value pairs (handle nested braces)
            field_pattern = re.compile(r'(\w+)\s*=\s*[{"](.+?)[}"],?\s*$', re.MULTILINE)
            for fm in field_pattern.finditer(body):
                key = fm.group(1).strip()
                val = fm.group(2).strip()
                # Clean LaTeX escapes
                val = val.replace("{\\'", "'")  # {\'e} -> é
                val = val.replace('\\"', '"')
                val = re.sub(r'\{([^}]*)\}', r'\1', val)  # strip inner braces
                val = re.sub(r'\\(url|texttt|textit|textbf)\{([^}]*)\}', r'\2', val)
                val = val.replace('\\&', '&')
                val = val.replace('\\_', '_')
                val = val.replace('\\#', '#')
                val = val.replace('\\%', '%')
                val = val.replace('~', ' ')
                val = ' '.join(val.split())  # normalize whitespace
                fields[key] = val

            # Build entry
            entry = {
                'key': entry_key,
                'type': entry_type,
                'section': current_section,
                'title': fields.get('title', ''),
                'authors': fields.get('author', fields.get('editor', '')),
                'year': fields.get('year', ''),
                'journal': fields.get('journal', fields.get('booktitle', '')),
                'volume': fields.get('volume', ''),
                'number': fields.get('number', ''),
                'pages': fields.get('pages', ''),
                'publisher': fields.get('publisher', ''),
                'doi': fields.get('doi', ''),
                'url': fields.get('url', ''),
                'isbn': fields.get('isbn', ''),
                'note': fields.get('note', ''),
                'howpublished': fields.get('howpublished', ''),
            }
            entries.append(entry)
        else:
            i += 1

    return entries


def entry_url(entry: dict) -> str:
    """Generate a URL for an entry: prefer DOI, then url field."""
    doi = entry.get('doi', '')
    url = entry.get('url', '')
    if doi:
        return f"https://doi.org/{doi}"
    if url:
        return url
    return ''


def format_authors(authors_str: str) -> str:
    """Format author string: 'Last, First and Last, First' → 'First Last, First Last'."""
    if not authors_str:
        return ''
    parts = [p.strip() for p in authors_str.split(' and ')]
    formatted = []
    for part in parts:
        if ',' in part:
            last, first = part.split(',', 1)
            formatted.append(f"{first.strip()} {last.strip()}")
        else:
            formatted.append(part)
    return ', '.join(formatted)


def format_citation(entry: dict) -> str:
    """Format a citation string in APA-like style."""
    authors = format_authors(entry.get('authors', ''))
    year = entry.get('year', '')
    title = entry.get('title', '')
    journal = entry.get('journal', '')
    volume = entry.get('volume', '')
    pages = entry.get('pages', '')
    publisher = entry.get('publisher', '')
    doi = entry.get('doi', '')

    parts = []
    if authors:
        parts.append(authors)
    if year:
        parts.append(f"({year})")
    if title:
        parts.append(f"{title}.")
    if journal:
        jpart = journal
        if volume:
            jpart += f", {volume}"
            if pages:
                jpart += f", {pages}"
        parts.append(f"{jpart}.")
    elif publisher:
        parts.append(f"{publisher}.")
    if doi:
        parts.append(f"DOI: {doi}")

    return ' '.join(parts)


def main():
    parser = argparse.ArgumentParser(
        description="Convert references.bib to structured JSON for institute_website bibliography page"
    )
    parser.add_argument('--bib', type=Path, required=True, help='Path to references.bib')
    parser.add_argument('--out', type=Path, default=OUT_PATH, help='Output JSON path')
    args = parser.parse_args()

    if not args.bib.is_file():
        print(f"Error: BibTeX file not found: {args.bib}", file=sys.stderr)
        sys.exit(1)

    text = args.bib.read_text(encoding='utf-8')
    entries = parse_bibtex(text)

    # Group by section
    sections = {}
    for entry in entries:
        section = entry['section']
        if section not in sections:
            sections[section] = {'title': section, 'entries': []}
        sections[section]['entries'].append({
            'key': entry['key'],
            'type': entry['type'],
            'title': entry['title'],
            'authors': format_authors(entry['authors']),
            'year': entry['year'],
            'journal': entry['journal'],
            'volume': entry['volume'],
            'number': entry['number'],
            'pages': entry['pages'],
            'publisher': entry['publisher'],
            'doi': entry['doi'],
            'url': entry_url(entry),
            'isbn': entry.get('isbn', ''),
            'citation': format_citation(entry),
        })

    output = {
        'description': 'Bibliography of the Active Inference Meta-Analysis project — curated references spanning foundational FEP, Active Inference textbooks, methods, tools, and related work.',
        'source': 'act_inf_metaanalysis/manuscript/references.bib',
        'total_entries': len(entries),
        'sections': list(sections.values()),
        'github_url': 'https://github.com/ActiveInferenceInstitute/act_inf_metaanalysis/blob/main/manuscript/references.bib',
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"Wrote {len(entries)} entries in {len(sections)} sections → {args.out}")


if __name__ == '__main__':
    main()
