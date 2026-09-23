# SONDE des ONGLETS DE CHAPITRE (#1739) : lit au PDF, par le lecteur géométrique
# `scripts/raw/lib/pdf_geometrie.py`, le chiffre romain d'onglet de chaque page d'un livre, et en tire
# la donnée `onglets` de sa liste de découpe (`scripts/raw/decoupes/<id>.json`) :
# `[{ "chiffre": "V", "pages": [a, b] }]`, une entrée par SUITE de pages qui portent le même chiffre,
# `pages` = pages PDF 1-based de la première à la dernière page qui l'impriment. Le GABARIT lu est
# la donnée `gabaritOnglet` de la même liste (`{ police, taille, bandeHaute }`, mesuré au PDF) ; un
# gabarit `null` déclare un livre sans onglet et donne `onglets: null`.
# Les pages impaires sans onglet sont RAPPORTÉES (stderr), jamais écrites dans la donnée.
# Jamais jouée en CI (pas de PDF) : la donnée committée est la vérité, `--check` la relit.
# Usage :
#   python scripts/raw/onglets.py <id>...           écrit `onglets` dans la découpe de chaque livre
#   python scripts/raw/onglets.py --check <id>...   n'écrit rien ; exit 1 si la donnée committée diverge
import argparse
import io
import json
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
from pdf_geometrie import lire_pages, pdfs_de, spans  # noqa: E402

DECOUPES = os.path.join(ICI, "decoupes")

# Même motif que `scripts/raw/decoupes.test.mjs` (garde JS de la donnée) : deux langages, une définition.
ROMAIN = re.compile(r"^(?=[IVXLC])C{0,3}(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$")


def lire_onglets(pdf_path, gabarit):
    """`(onglets, sans_onglet, fautes)` : la donnée, les pages impaires sans onglet, les pages ambiguës."""
    par_page, sans, fautes = [], [], []
    for page in lire_pages(pdf_path):
        vus = {
            s.texte
            for s in spans(page.chars)
            if s.police == gabarit["police"]
            and abs(s.taille - gabarit["taille"]) < 0.5
            and s.y1 >= page.hauteur - gabarit["bandeHaute"]
            and 0 <= s.x0
            and s.x1 <= page.largeur
            and ROMAIN.match(s.texte)
        }
        if len(vus) > 1:
            fautes.append(f"p.{page.numero} : plusieurs onglets {sorted(vus)}")
        elif vus:
            par_page.append((page.numero, vus.pop()))
        elif page.numero % 2:
            sans.append(page.numero)
    onglets = []
    for n, chiffre in par_page:
        if onglets and onglets[-1]["chiffre"] == chiffre:
            onglets[-1]["pages"][1] = n
        else:
            onglets.append({"chiffre": chiffre, "pages": [n, n]})
    return onglets, sans, fautes


def plages(ns):
    """`[1, 9, 11, 13]` -> `1, 9-13` (pas de 2 : pages impaires)."""
    out = []
    for n in ns:
        if out and n == out[-1][1] + 2:
            out[-1][1] = n
        else:
            out.append([n, n])
    return ", ".join(str(a) if a == b else f"{a}-{b}" for a, b in out)


def texte_onglets(onglets):
    """Le bloc `"onglets": …,` au format de la liste de découpe (une entrée par ligne)."""
    if onglets is None:
        return '"onglets": null,'
    lignes = [json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in onglets]
    return '"onglets": [\n    ' + ",\n    ".join(lignes) + "\n  ],"


BLOC = re.compile(r'"onglets": (?:null|\[.*?\n  \]),', re.S)
APRES_GABARIT = re.compile(r'("gabaritOnglet": (?:null|\{[^\n]*\}),\n)')


def ecrire(chemin, texte, onglets):
    bloc = texte_onglets(onglets)
    neuf = BLOC.sub(lambda _: bloc, texte, count=1) if BLOC.search(texte) else APRES_GABARIT.sub(lambda m: f"{m.group(1)}  {bloc}\n", texte, count=1)
    if json.loads(neuf).get("onglets") != onglets:
        raise SystemExit(f"{chemin} : réécriture de `onglets` non relue à l'identique")
    with io.open(chemin, "w", encoding="utf-8", newline="") as f:
        f.write(neuf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+", help="id(s) STABLE(s) de livre")
    ap.add_argument("--check", action="store_true", help="n'écrit rien ; exit 1 si la donnée committée diverge")
    args = ap.parse_args()

    textes, gabarits = {}, {}
    for id_ in args.ids:
        chemin = os.path.join(DECOUPES, f"{id_}.json")
        with io.open(chemin, "r", encoding="utf-8", newline="") as f:
            textes[id_] = f.read()
        liste = json.loads(textes[id_])
        if "gabaritOnglet" not in liste:
            print(f"onglets : {id_} ne déclare pas `gabaritOnglet` dans {os.path.relpath(chemin)} — le mesurer au PDF et l'écrire (ou `null` sans onglet)", file=sys.stderr)
            return 2
        gabarits[id_] = liste["gabaritOnglet"]

    avec_pdf = [i for i in args.ids if gabarits[i] is not None]
    pdfs = dict(zip(avec_pdf, pdfs_de(avec_pdf))) if avec_pdf else {}
    code = 0
    for id_ in args.ids:
        chemin = os.path.join(DECOUPES, f"{id_}.json")
        texte = textes[id_]
        if gabarits[id_] is None:
            onglets = None
        else:
            onglets, sans, fautes = lire_onglets(pdfs[id_], gabarits[id_])
            print(f"{id_} : {len(onglets)} étendues ; pages impaires sans onglet : {plages(sans) or 'aucune'}", file=sys.stderr)
            for f_ in fautes:
                print(f"ANOMALIE {id_} {f_}", file=sys.stderr)
            if fautes:
                code = 1
                continue
        if args.check:
            if json.loads(texte).get("onglets", "ABSENT") != onglets:
                print(f"{id_} : `onglets` committé DIVERGE de la lecture du PDF — relancer sans --check et relire le diff", file=sys.stderr)
                code = 1
            else:
                print(f"{id_} : onglets --check — OK", file=sys.stderr)
        else:
            ecrire(chemin, texte, onglets)
            print(f"{id_} : `onglets` -> {os.path.relpath(chemin, os.path.dirname(os.path.dirname(ICI)))}", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
