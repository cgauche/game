# -*- coding: utf-8 -*-
"""Extract illustration images from the WFRP4 French core book (Livre de base)
and map career/creature labels to the per-entry illustration on each page.

Logique propre au LDB (pas une simple extraction par mot-clé, cf. `extract.py`) :
labels de `src/data/careers.json`/`creatures.json` mappés à LEUR illustration par
proximité de page + heading, avec une liste noire des dimensions d'image répétées
(bordures/parchemin). `ldb_map.py` raffine ce premier passage (heuristique d'encre +
position verticale du heading). Toujours lancer `ldb_extract.py` avant `ldb_map.py`
(ce dernier réutilise les fichiers déjà exportés page{P}_img{XREF}.png).

Prérequis : Python 3 + PyMuPDF (`pip install pymupdf`, module `fitz`).

Usage (chemins par défaut = livre de base + art-ref/ldb, override possible) :
    python scripts/art-ref/ldb_extract.py [--pdf PATH] [--out PATH]

Strategy
--------
* A genuine illustration appears exactly once in the book. Parchment backgrounds,
  column frames, filets and decorative motifs are the SAME embedded image repeated
  on many pages. So we blacklist any (w,h) dimension that occurs more than
  REPEAT_MAX times across the book.
* Careers/creatures are laid out one entry per page (or per text block) with the
  entry NAME printed as a heading at the top of the page. We match a label to the
  page whose heading (first ~350 chars of text) contains the label, preferring the
  page closest to the printed page cited in the JSON (offset auto-detected).
* The chosen illustration for a page is its largest NON-blacklisted image.
"""
import argparse
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = ROOT / "Source" / "Warhammer v4 - Livre de base version corrigée.pdf"
DEFAULT_OUT = ROOT / "art-ref" / "ldb"

MIN_SIDE = 200   # px: illustration threshold (>=200 on at least one side)
MIN_SHORT = 60   # px: drop thin filets/borders
REPEAT_MAX = 4   # a (w,h) seen more than this many times == template/decoration

# JSON label -> printed spelling in the PDF when they differ
ALIASES = {
    "Hyppogriffe": "hippogriffe",
    "Chamane-Brey": "chamane-bray",
    "Elfe (haut et sylvain)": "elfe",
}


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", default=str(DEFAULT_PDF))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    pdf_path, out_dir = Path(args.pdf), Path(args.out)

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    print(f"PDF: {pdf_path}")
    print(f"PDF pages: {doc.page_count}")

    # ---- pass 1: catalogue every large image, count dimensions ------------------
    raw = {}  # pidx -> list of (xref, w, h)
    dimcount = Counter()
    for pidx in range(doc.page_count):
        lst = []
        for info in doc[pidx].get_images(full=True):
            xref = info[0]
            try:
                pix = fitz.Pixmap(doc, xref)
            except Exception:
                continue
            w, h = pix.width, pix.height
            pix = None
            if max(w, h) < MIN_SIDE or min(w, h) < MIN_SHORT:
                continue
            lst.append((xref, w, h))
            dimcount[(w, h)] += 1
        raw[pidx] = lst

    blacklist = {d for d, c in dimcount.items() if c > REPEAT_MAX}
    print(f"Blacklisted {len(blacklist)} repeated template/background dimensions "
          f"(e.g. {sorted(blacklist, key=lambda d: -dimcount[d])[:4]})")

    # ---- pass 2: export non-template illustrations + capture text ---------------
    page_images = {}  # pidx -> list of (filename, area)
    page_text = {}
    total = 0
    for pidx in range(doc.page_count):
        page_text[pidx] = norm(doc[pidx].get_text())
        imgs = []
        for (xref, w, h) in raw[pidx]:
            if (w, h) in blacklist:
                continue
            fname = f"page{pidx + 1:03d}_img{xref}.png"
            fpath = os.path.join(str(out_dir), fname)
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                pix.save(fpath)
                pix = None
            except Exception:
                continue
            imgs.append((fname, w * h))
            total += 1
        if imgs:
            page_images[pidx] = imgs
    print(f"Total illustration images extracted: {total}")

    def biggest_img(pidx):
        return max(page_images[pidx], key=lambda im: im[1])[0]

    # ---- load targets -----------------------------------------------------------
    careers = json.load(open(ROOT / "src" / "data" / "careers.json", encoding="utf-8"))
    creatures = json.load(open(ROOT / "src" / "data" / "creatures.json", encoding="utf-8"))

    # ---- auto-detect printed->pdf offset using confident career headings --------
    offsets = []
    for c in careers:
        nl = norm(c["label"])
        cited = c.get("source", {}).get("page")
        if cited is None:
            continue
        for pidx in page_images:
            if nl in page_text[pidx][:350]:
                offsets.append(pidx - cited)
                break
    off = Counter(offsets).most_common(1)[0][0] if offsets else 0
    print(f"Estimated PDF-vs-printed page offset: {off} (from {len(offsets)} samples)")

    # ---- map a set --------------------------------------------------------------
    def map_set(items, key, mapping, unmapped):
        for it in items:
            label = it["label"]
            cited = it.get("source", {}).get("page")
            search = ALIASES.get(label, label)
            nlabel = norm(search)
            base = re.split(r"[\(/]", search)[0].strip()
            nbase = norm(base)
            target = (cited + off) if cited is not None else None
            cands = []
            for pidx in page_images:
                txt = page_text[pidx]
                head = txt[:350]
                in_head = nlabel in head or (len(nbase) >= 5 and nbase in head)
                in_body = nlabel in txt or (len(nbase) >= 5 and nbase in txt)
                if not in_body:
                    continue
                sc = 0.0
                if in_head:
                    sc += 100
                if target is not None:
                    d = abs(pidx - target)
                    sc -= d * 3.0
                    if d <= 2:
                        sc += 80
                sc += max(im[1] for im in page_images[pidx]) / 1_000_000.0
                cands.append((sc, pidx))
            if cands:
                cands.sort(reverse=True)
                best_sc, pidx = cands[0]
                # require either a heading hit or close-to-cited page to trust it
                if best_sc >= 50:
                    mapping[key][label] = f"art-ref/ldb/{biggest_img(pidx)}"
                    continue
            unmapped[key].append(label)

    mapping = {"careers": {}, "creatures": {}}
    unmapped = {"careers": [], "creatures": []}
    map_set(careers, "careers", mapping, unmapped)
    map_set(creatures, "creatures", mapping, unmapped)

    json.dump(mapping, open(out_dir / "mapping.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    print("\n=== RESULTS ===")
    print(f"Careers mapped:   {len(mapping['careers'])}/{len(careers)}")
    print(f"Creatures mapped: {len(mapping['creatures'])}/{len(creatures)}")
    print("Unmapped careers:  ", unmapped["careers"])
    print("Unmapped creatures:", unmapped["creatures"])
    print("\nSample careers:")
    for k, v in list(mapping["careers"].items())[:4]:
        print(f"  {k} -> {v}")
    print("Sample creatures:")
    for k, v in list(mapping["creatures"].items())[:4]:
        print(f"  {k} -> {v}")


if __name__ == "__main__":
    main()
