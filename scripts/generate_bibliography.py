#!/usr/bin/env python3
"""Generate comprehensive bibliography JSON from act_inf_metaanalysis outputs.

Reads references.bib and all structured output JSON files, combines them into a
single bibliography.json for the institute_website bibliography page.

Usage:
  python scripts/generate_bibliography.py \\
    --project-root /path/to/act_inf_metaanalysis \\
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

# Hypotenuse display names
HYPOTHESIS_NAMES = {
    "FEP_UNIVERSALITY": "FEP Universality",
    "AIF_OPTIMALITY": "Active Inference Optimality",
    "MARKOV_BLANKET_REALISM": "Markov Blanket Realism",
    "PREDICTIVE_CODING": "Predictive Coding",
    "SCALABILITY": "Scalability",
    "CLINICAL_UTILITY": "Clinical Utility",
    "MORPHOGENESIS": "Morphogenesis",
    "LANGUAGE_AIF": "Language & Active Inference",
}

SUBFIELD_NAMES = {
    "A1_formal": "Formal / Mathematical",
    "A2_philosophy": "Philosophy",
    "B_tools": "Tools & Methods",
    "C1_neuroscience": "Neuroscience",
    "C2_robotics": "Robotics & Agents",
    "C3_language": "Language",
    "C4_psychiatry": "Psychiatry / Clinical",
    "C5_biology": "Biology / Morphogenesis",
}


def parse_bibtex(text: str) -> list[dict]:
    """Parse BibTeX text into structured entry dicts."""
    entries = []
    current_section = "References"
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        section_match = re.match(r'^%\s*(.+)$', line)
        if section_match:
            title = section_match.group(1).strip()
            if title and not title.startswith('===') and 'NOTE:' not in title:
                current_section = title
            i += 1
            continue
        entry_match = re.match(r'@(\w+)\s*\{\s*(\w+)\s*,', line)
        if entry_match:
            entry_type, entry_key = entry_match.group(1), entry_match.group(2)
            body_lines = []
            depth = 1
            i += 1
            while i < len(lines) and depth > 0:
                for ch in lines[i]:
                    if ch == '{': depth += 1
                    elif ch == '}': depth -= 1
                if depth > 0:
                    body_lines.append(lines[i])
                i += 1
            body = '\n'.join(body_lines)
            fields = {}
            for fm in re.finditer(r'(\w+)\s*=\s*[{"](.+?)[}"],?\s*$', body, re.MULTILINE):
                key = fm.group(1).strip()
                val = fm.group(2).strip()
                val = val.replace("{\\'", "'")
                val = val.replace('\\"', '"')
                val = re.sub(r'\{([^}]*)\}', r'\1', val)
                val = re.sub(r'\\(url|texttt|textit|textbf)\{([^}]*)\}', r'\2', val)
                val = val.replace('\\&', '&').replace('\\_', '_').replace('~', ' ')
                val = ' '.join(val.split())
                fields[key] = val
            entries.append({
                'key': entry_key, 'type': entry_type,
                'section': current_section,
                'title': fields.get('title', ''),
                'authors': _format_authors(fields.get('author', fields.get('editor', ''))),
                'year': fields.get('year', ''),
                'journal': fields.get('journal', fields.get('booktitle', '')),
                'volume': fields.get('volume', ''), 'number': fields.get('number', ''),
                'pages': fields.get('pages', ''), 'publisher': fields.get('publisher', ''),
                'doi': fields.get('doi', ''), 'url': _entry_url(fields),
                'isbn': fields.get('isbn', ''),
                'citation': _format_citation(fields),
            })
        else:
            i += 1
    return entries


def _format_authors(authors_str: str) -> str:
    if not authors_str: return ''
    parts = [p.strip() for p in authors_str.split(' and ')]
    formatted = []
    for part in parts:
        if ',' in part:
            last, first = part.split(',', 1)
            formatted.append(f"{first.strip()} {last.strip()}")
        else:
            formatted.append(part)
    return ', '.join(formatted)


def _entry_url(fields: dict) -> str:
    doi = fields.get('doi', '')
    url = fields.get('url', '')
    if doi: return f"https://doi.org/{doi}"
    if url: return url
    return ''


def _format_citation(fields: dict) -> str:
    parts = []
    authors = _format_authors(fields.get('author', fields.get('editor', '')))
    year = fields.get('year', '')
    title = fields.get('title', '')
    journal = fields.get('journal', fields.get('booktitle', ''))
    volume = fields.get('volume', '')
    pages = fields.get('pages', '')
    publisher = fields.get('publisher', '')
    doi = fields.get('doi', '')
    if authors: parts.append(authors)
    if year: parts.append(f"({year})")
    if title: parts.append(f"{title}.")
    if journal:
        j = journal
        if volume:
            j += f", {volume}"
            if pages: j += f", {pages}"
        parts.append(f"{j}.")
    elif publisher:
        parts.append(f"{publisher}.")
    if doi: parts.append(f"DOI: {doi}")
    return ' '.join(parts)


def load_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding='utf-8'))


def build_bibliography(project_root: Path) -> dict:
    """Build the comprehensive bibliography JSON from all project outputs."""
    bib_path = project_root / "manuscript" / "references.bib"
    data_dir = project_root / "output" / "data"
    reports_dir = project_root / "output" / "reports"

    # 1. Parse references
    bib_entries = parse_bibtex(bib_path.read_text(encoding='utf-8')) if bib_path.is_file() else []
    sections = {}
    for e in bib_entries:
        s = e['section']
        if s not in sections:
            sections[s] = {'title': s, 'entries': []}
        sections[s]['entries'].append({
            'key': e['key'], 'type': e['type'],
            'title': e['title'], 'authors': e['authors'],
            'year': e['year'], 'journal': e['journal'],
            'volume': e['volume'], 'number': e['number'],
            'pages': e['pages'], 'publisher': e['publisher'],
            'doi': e['doi'], 'url': e['url'], 'isbn': e['isbn'],
            'citation': e['citation'],
        })

    # 2. Temporal analysis
    temporal = load_json(data_dir / "temporal_analysis.json")
    field_overview = {
        'total_papers': temporal.get('total_papers', 0),
        'first_year': temporal.get('first_year', ''),
        'last_year': temporal.get('last_year', ''),
        'peak_year': temporal.get('peak_year', ''),
        'peak_count': max(temporal.get('year_counts', {}).values()) if temporal.get('year_counts') else 0,
        'cagr': round(temporal.get('cagr', 0) * 100, 1),
        'doubling_time_years': round(temporal.get('doubling_time', 0), 1),
        'cumulative_2026': temporal.get('cumulative', {}).get('2026', 0),
        'year_counts': temporal.get('year_counts', {}),
    }

    # 3. Fulltext assessment
    ft = load_json(data_dir / "fulltext_assessment.json")
    corpus_assessment = {
        'total_papers': ft.get('total_papers', 0),
        'abstract_coverage_pct': ft.get('abstract_coverage', {}).get('percent_with_abstract', 0),
        'open_access_pct': ft.get('open_access', {}).get('percent_oa', 0),
        'pdf_availability_pct': ft.get('pdf_availability', {}).get('percent_with_pdf', 0),
        'fulltext_sources': ft.get('fulltext_source_breakdown', {}),
        'identifier_coverage': ft.get('identifier_coverage', {}),
    }

    # 4. Hypothesis evidence
    scores = load_json(data_dir / "hypothesis_scores.json")
    assertions = load_json(data_dir / "assertion_summary.json")
    per_hyp = assertions.get('per_hypothesis', {})
    hypotheses = []
    for key, name in HYPOTHESIS_NAMES.items():
        score = scores.get(key, 0)
        hyp_data = per_hyp.get(key, {})
        hypotheses.append({
            'id': key,
            'name': name,
            'score': round(score, 4),
            'pct': round(score * 100, 1),
            'supports': hyp_data.get('supports', 0),
            'neutral': hyp_data.get('neutral', 0),
            'contradicts': hyp_data.get('contradicts', 0),
            'total_assertions': sum(hyp_data.values()) if hyp_data else 0,
        })
    hypotheses.sort(key=lambda h: -h['score'])

    # 5. Citation network
    network = load_json(data_dir / "citation_network.json")
    top_pagerank = network.get('top_pagerank', {})
    # Just include the DOIs; full paper info is in the corpus
    citation_network = {
        'num_nodes': network.get('num_nodes', 0),
        'num_edges': network.get('num_edges', 0),
        'total_references': network.get('total_references', 0),
        'density': round(network.get('density', 0), 6),
        'avg_degree': round(network.get('avg_in_degree', 0), 1),
        'top_pagerank_dois': [{'doi': doi, 'score': round(score, 4)} for doi, score in sorted(top_pagerank.items(), key=lambda x: -x[1])[:10]],
    }

    # 6. Topic modeling
    topics_raw = load_json(data_dir / "topics.json")
    topics = []
    for t in (topics_raw if isinstance(topics_raw, list) else []):
        topics.append({
            'id': t.get('topic_id', 0),
            'top_words': t.get('top_words', [])[:5],
            'top_weights': [round(w, 3) for w in t.get('weights', [])[:5]],
        })

    # 7. Subfield classification
    subfields_raw = load_json(data_dir / "subfield_classification.json")
    total_subfield = sum(subfields_raw.values()) if subfields_raw else 1
    subfields = []
    for key, name in SUBFIELD_NAMES.items():
        count = subfields_raw.get(key, 0)
        subfields.append({
            'id': key, 'name': name, 'count': count,
            'pct': round(count / total_subfield * 100, 1) if total_subfield else 0,
        })
    subfields.sort(key=lambda s: -s['count'])

    # 8. Quality & reproducibility
    test_results = load_json(reports_dir / "test_results.json")
    validation = load_json(reports_dir / "validation_report.json")
    telemetry = load_json(reports_dir / "telemetry.json")
    quality = {
        'tests_passed': test_results.get('summary', {}).get('total_passed', 0),
        'tests_total': test_results.get('summary', {}).get('total_tests', 0),
        'coverage_pct': round(test_results.get('summary', {}).get('project_coverage', 0), 1),
        'all_validation_passed': validation.get('summary', {}).get('all_passed', False),
        'total_checks': validation.get('summary', {}).get('total_checks', 0),
        'pipeline_duration': telemetry.get('total_duration', ''),
        'pipeline_stages': telemetry.get('total_stages', 0),
    }

    return {
        'description': (
            'Comprehensive bibliography and structured outputs from the Active Inference Meta-Analysis project — '
            'a computational meta-analysis of 817 papers across the Active Inference and Free Energy Principle literature. '
            'Includes curated references, hypothesis evidence scores, citation network analysis, topic modeling, '
            'subfield classification, and corpus assessment statistics.'
        ),
        'source': 'act_inf_metaanalysis/',
        'github_url': 'https://github.com/ActiveInferenceInstitute/act_inf_metaanalysis',
        'total_references': len(bib_entries),
        'bibliography': list(sections.values()),
        'field_overview': field_overview,
        'corpus_assessment': corpus_assessment,
        'hypotheses': hypotheses,
        'citation_network': citation_network,
        'topics': topics,
        'subfields': subfields,
        'quality': quality,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate comprehensive bibliography JSON")
    parser.add_argument('--project-root', type=Path, required=True,
                        help='Path to act_inf_metaanalysis project')
    parser.add_argument('--out', type=Path, default=OUT_PATH, help='Output JSON path')
    args = parser.parse_args()

    if not args.project_root.is_dir():
        print(f"Error: project root not found: {args.project_root}", file=sys.stderr)
        sys.exit(1)

    data = build_bibliography(args.project_root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"Wrote bibliography with {data['total_references']} references, "
          f"{data['field_overview']['total_papers']} papers, "
          f"{len(data['hypotheses'])} hypotheses, "
          f"{len(data['topics'])} topics, "
          f"{len(data['subfields'])} subfields → {args.out}")


if __name__ == '__main__':
    main()
