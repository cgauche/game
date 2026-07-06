# -*- coding: utf-8 -*-
"""Refined mapping pass: place each career/creature illustration by geometry.

Reuses the images already exported by `ldb_extract.py` (filenames page{P}_img{XREF}.png)
— LANCER `ldb_extract.py` D'ABORD. For each label we locate its HEADING block on the
candidate page (a large-font text run that spells the label) and pick the
non-template illustration image whose vertical centre is closest to that heading,
filtered by an "ink ratio" heuristic (cutout character/creature art has heavy black
outlines/backdrop; parchment/texture/empty panels are near-blank). Falls back to
largest image on page.

Prérequis : Python 3 + PyMuPDF (`pip install pymupdf`, module `fitz`).

Usage (chemins par défaut = livre de base + art-ref/ldb, override possible) :
    python scripts/art-ref/ldb_extract.py   # d'abord
    python scripts/art-ref/ldb_map.py [--pdf PATH] [--out PATH]
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

MIN_SIDE, MIN_SHORT, REPEAT_MAX = 200, 60, 4

ALIASES = {
    "Hyppogriffe": "hippogriffe",
    "Chamane-Brey": "chamane-bray",
    "Elfe (haut et sylvain)": "elfe",
}


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", default=str(DEFAULT_PDF))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    pdf_path, out_dir = Path(args.pdf), Path(args.out)

    doc = fitz.open(str(pdf_path))

    # ---- rebuild blacklist (must match ldb_extract.py) --------------------------
    dimcount = Counter()
    for p in range(doc.page_count):
        for info in doc[p].get_images(full=True):
            try:
                pix = fitz.Pixmap(doc, info[0])
            except Exception:
                continue
            w, h = pix.width, pix.height
            pix = None
            if max(w, h) >= MIN_SIDE and min(w, h) >= MIN_SHORT:
                dimcount[(w, h)] += 1
    blacklist = {d for d, c in dimcount.items() if c > REPEAT_MAX}

    # existing exported files -> set of (page, xref)
    have = set()
    for fn in os.listdir(out_dir):
        m = re.match(r"page(\d+)_img(\d+)\.png$", fn)
        if m:
            have.add((int(m.group(1)), int(m.group(2))))

    _ink_cache = {}

    def ink_ratio(xref):
        """Fraction of genuinely dark pixels (luminance < 110). Cutout character/creature
        art has black outlines + black backdrop => high; parchment/texture/empty panels
        are light => near zero. Robust discriminator between real art and decoration."""
        if xref in _ink_cache:
            return _ink_cache[xref]
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            if pix.alpha:
                pix = fitz.Pixmap(pix, 0)  # drop alpha
            scale = max(1, max(pix.width, pix.height) // 120)
            s = pix.samples
            n = pix.n
            W, H = pix.width, pix.height
            dark = tot = 0
            for y in range(0, H, scale):
                row = y * W * n
                for x in range(0, W, scale):
                    i = row + x * n
                    lum = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
                    if lum < 110:
                        dark += 1
                    tot += 1
            pix = None
            ratio = dark / tot if tot else 0.0
        except Exception:
            ratio = 0.0
        _ink_cache[xref] = ratio
        return ratio

    def page_illustrations(pidx):
        """list of dicts for kept, non-blank images on the page."""
        out = []
        for info in doc[pidx].get_image_info(xrefs=True):
            xref = info.get("xref", 0)
            bb = info["bbox"]
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            if max(w, h) < MIN_SIDE or min(w, h) < MIN_SHORT:
                continue
            try:
                pix = fitz.Pixmap(doc, xref)
                pw, ph = pix.width, pix.height
                pix = None
            except Exception:
                continue
            if (pw, ph) in blacklist:
                continue
            if (pidx + 1, xref) not in have:
                continue
            ir = ink_ratio(xref)
            if ir < 0.30:   # not a real cutout illustration (parchment/texture/panel)
                continue
            out.append({
                "xref": xref, "yc": (bb[1] + bb[3]) / 2, "area": (bb[2] - bb[0]) * (bb[3] - bb[1]),
                "ink": ir, "fname": f"page{pidx + 1:03d}_img{xref}.png",
            })
        return out

    def heading_y(pidx, nlabel, nbase):
        """return y of a large-font heading on the page that spells the label, else None."""
        d = doc[pidx].get_text("dict")
        best = None
        for b in d["blocks"]:
            if "lines" not in b:
                continue
            # concat spans of the block; headings have size>=12 and a big drop-cap
            text = norm("".join(s["text"] for l in b["lines"] for s in l["spans"]))
            maxsize = max((s["size"] for l in b["lines"] for s in l["spans"]), default=0)
            if maxsize < 12:
                continue
            if nlabel in text or (len(nbase) >= 5 and nbase in text):
                y = b["bbox"][1]
                if best is None or y < best:  # prefer the topmost matching heading
                    best = y
        return best

    careers = json.load(open(ROOT / "src" / "data" / "careers.json", encoding="utf-8"))
    creatures = json.load(open(ROOT / "src" / "data" / "creatures.json", encoding="utf-8"))

    # offset detection (printed page -> pdf index)
    page_text = {p: norm(doc[p].get_text()) for p in range(doc.page_count)}
    offs = []
    for c in careers:
        nl = norm(c["label"])
        cp = c.get("source", {}).get("page")
        if cp is None:
            continue
        for p in range(doc.page_count):
            if nl in page_text[p][:400]:
                offs.append(p - cp)
                break
    off = Counter(offs).most_common(1)[0][0] if offs else 1

    def choose(items, key, mapping, unmapped):
        for it in items:
            label = it["label"]
            cited = it.get("source", {}).get("page")
            search = ALIASES.get(label, label)
            nlabel = norm(search)
            nbase = norm(re.split(r"[\(/]", search)[0].strip())
            target = (cited + off) if cited is not None else None
            # candidate pages: any page whose text contains label, scored by proximity
            cand_pages = []
            for p in range(doc.page_count):
                if nlabel in page_text[p] or (len(nbase) >= 5 and nbase in page_text[p]):
                    sc = 0.0
                    hy = heading_y(p, nlabel, nbase)
                    if hy is not None:
                        sc += 100
                    if target is not None:
                        sc -= abs(p - target) * 3
                    cand_pages.append((sc, p, hy))
            if not cand_pages:
                unmapped[key].append(label)
                continue
            cand_pages.sort(key=lambda t: -t[0])
            best_sc, pidx, hy = cand_pages[0]
            imgs = page_illustrations(pidx)
            if not imgs:
                # try next candidate page that has images
                placed = False
                for sc, p2, hy2 in cand_pages[1:]:
                    im2 = page_illustrations(p2)
                    if im2:
                        pidx, hy, imgs, placed = p2, hy2, im2, True
                        break
                if not placed:
                    unmapped[key].append(label)
                    continue
            if hy is not None:
                # restrict to images vertically overlapping the entry (heading .. +330pt),
                # then prefer the densest (most illustration-like), tie-break by proximity.
                band = [im for im in imgs if hy - 220 <= im["yc"] <= hy + 380]
                pool = band if band else imgs
                pick = max(pool, key=lambda im: (round(im["ink"], 2), -abs(im["yc"] - hy)))
            else:
                pick = max(imgs, key=lambda im: (round(im["ink"], 2), im["area"]))
            mapping[key][label] = f"art-ref/ldb/{pick['fname']}"

    mapping = {"careers": {}, "creatures": {}}
    unmapped = {"careers": [], "creatures": []}
    choose(careers, "careers", mapping, unmapped)
    choose(creatures, "creatures", mapping, unmapped)

    json.dump(mapping, open(out_dir / "mapping.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    # ---- purge blank exported PNGs from disk ------------------------------------
    removed = 0
    for fn in list(os.listdir(out_dir)):
        m = re.match(r"page(\d+)_img(\d+)\.png$", fn)
        if not m:
            continue
        if ink_ratio(int(m.group(2))) < 0.30:
            try:
                os.remove(out_dir / fn)
                removed += 1
            except OSError:
                pass
    print(f"Purged {removed} blank images from disk")

    print(f"offset={off}")
    print(f"Careers mapped:   {len(mapping['careers'])}/{len(careers)}")
    print(f"Creatures mapped: {len(mapping['creatures'])}/{len(creatures)}")
    print("Unmapped careers:  ", unmapped["careers"])
    print("Unmapped creatures:", unmapped["creatures"])
    # dump full for audit
    for k in ["careers", "creatures"]:
        print(f"\n--- {k} ---")
        for lab, v in mapping[k].items():
            print(f"  {lab} -> {v}")


if __name__ == "__main__":
    main()
