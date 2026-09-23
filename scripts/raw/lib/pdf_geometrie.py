# LECTEUR GÉOMÉTRIQUE de page de livre (#1739) : ce que la page IMPRIME et OÙ — caractères avec police,
# taille et bbox, aplats (`LTRect`), spans, folio imprimé. pdfminer.six, mesuré en 20251107.
# `scripts/raw/lib/pdf-extract.py` ne rend que du texte (pypdf) : toute lecture qui a besoin de la
# police, de la taille ou de la position passe ICI.
# Le chemin du PDF ne se construit pas ici : `pdfs_de` le demande à la CLI de la couture `pdfDe`
# (`scripts/raw/pdf-de.mjs`).
# Import depuis un script du dépôt : `sys.path` posé depuis `__file__` sur `scripts/raw/lib/`, puis
# `import pdf_geometrie`.
import os
import subprocess
from collections import namedtuple

from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTChar, LTRect

PDF_DE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pdf-de.mjs")

# Police du folio imprimé, en minuscules et sans préfixe de sous-ensemble (LDB, CRB : `DwarvenAxeBB`).
POLICE_FOLIO = "dwarvenaxe"

Page = namedtuple("Page", "numero largeur hauteur chars rects")
Span = namedtuple("Span", "texte police taille x0 y0 x1 y1")


def pdfs_de(ids):
    """Chemins absolus des PDF de `ids`, dans l'ordre ; lève avec le refus de la CLI."""
    vu = subprocess.run(["node", PDF_DE, *ids], capture_output=True, text=True, encoding="utf-8")
    if vu.returncode != 0:
        raise SystemExit(f"pdf-de : {vu.stderr.strip()}")
    return vu.stdout.splitlines()


def walk(o):
    yield o
    if hasattr(o, "_objs"):
        for c in o._objs:
            yield from walk(c)


def police_de(c):
    """Nom de police d'un `LTChar`, sans le préfixe de sous-ensemble (`ABCDEF+`)."""
    return (c.fontname or "").split("+")[-1]


def lire_pages(pdf_path, pages=None):
    """Les pages du PDF, dans l'ordre : `Page(numero, largeur, hauteur, chars, rects)`.

    `pages` : index PDF 0-based à lire (défaut : toutes). `numero` est l'index PDF 1-based.
    `chars` et `rects` sont TOUS les `LTChar` et `LTRect` de la page, dans l'ordre de l'analyse de mise
    en page (`LAParams()`), aplats vides compris : le filtre est au consommateur.
    """
    for i, page in enumerate(extract_pages(pdf_path, page_numbers=pages, laparams=LAParams())):
        objs = list(walk(page))
        yield Page(
            (pages[i] if pages else i) + 1,
            page.width,
            page.height,
            [o for o in objs if isinstance(o, LTChar)],
            [o for o in objs if isinstance(o, LTRect)],
        )


def spans(chars):
    """Spans de la page : suites de caractères CONSÉCUTIFS de même police, même taille et même ligne.

    Un span se coupe au changement de police ou de taille, au saut de ligne (écart de `y0` > 1 pt) et
    à l'écart horizontal supérieur à la taille du corps. Un glyphe SURIMPRIMÉ (même texte à moins de
    0,5 pt d'un glyphe du span) n'est lu qu'une fois : CRB p.339 imprime l'onglet `XII` deux fois au même
    endroit. Texte débarrassé de ses blancs de bord ; un span vide n'est pas rendu.
    """
    out, cur = [], []

    def clore():
        if cur:
            t = "".join(c.get_text() for c in cur).strip()
            if t:
                out.append(
                    Span(
                        t,
                        police_de(cur[0]),
                        round(cur[0].size, 1),
                        min(c.x0 for c in cur),
                        min(c.y0 for c in cur),
                        max(c.x1 for c in cur),
                        max(c.y1 for c in cur),
                    )
                )

    for c in chars:
        p = cur[-1] if cur else None
        if p is not None and not (
            police_de(c) == police_de(p)
            and abs(c.size - p.size) < 0.05
            and abs(c.y0 - p.y0) <= 1.0
            and -p.size <= c.x0 - p.x1 <= p.size
        ):
            clore()
            cur = []
        if any(d.get_text() == c.get_text() and abs(d.x0 - c.x0) < 0.5 and abs(d.y0 - c.y0) < 0.5 for d in cur):
            continue
        cur.append(c)
    clore()
    return out


def printed_folio(chars, police=POLICE_FOLIO):
    """Folio IMPRIMÉ en pied de page (police `police`) — l'ancre, jamais l'index PDF."""
    cand = [c for c in chars if c.y0 < 45 and police in (c.fontname or "").lower()]
    runs = {}
    for c in cand:
        runs.setdefault(round(c.y0, 0), []).append(c)
    for y in sorted(runs, reverse=True):
        s = "".join(x.get_text() for x in sorted(runs[y], key=lambda c: c.x0)).strip()
        if s.isdigit():
            return int(s)
    return None
