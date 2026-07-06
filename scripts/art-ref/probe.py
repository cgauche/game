# -*- coding: utf-8 -*-
"""Affiche le sommaire (TOC) d'un PDF source — repérage rapide des chapitres/pages
avant d'écrire des mots-clés pour `extract.py`. Reprend `art-ref/_probe.py`.

Prérequis : Python 3 + PyMuPDF (`pip install pymupdf`, module `fitz`).

Usage :
    python scripts/art-ref/probe.py --pdf <chemin PDF>

Exemple :
    python scripts/art-ref/probe.py --pdf "Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre.pdf"
"""
import argparse
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]


def resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (ROOT / p)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", required=True)
    args = ap.parse_args()

    doc = fitz.open(str(resolve(args.pdf)))
    print("pages:", doc.page_count)
    print("--- TOC ---")
    for lvl, title, page in doc.get_toc():
        print(lvl, page, title)


if __name__ == "__main__":
    main()
