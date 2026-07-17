# Helper d'extraction texte page-a-page pour scripts/raw/anchor-fill.mjs (#522).
# Lit le PDF UNE SEULE FOIS (pypdf), extrait le texte des pages demandees (index pypdf 0-based,
# = id "page-K-0" pose par Marker), ecrit un JSON {K: texte} sur stdout.
# Usage : python pdf-extract.py <pdf-path> <K1,K2,...> <out-json-path>
# Ecrit en UTF-8 dans un FICHIER (jamais stdout : la console Windows par defaut est cp1252 et
# rejette les glyphes hors-table que pypdf peut produire sur du texte mal encode dans le PDF source).
import sys
import json
from pypdf import PdfReader

def main():
    pdf_path = sys.argv[1]
    indices = [int(x) for x in sys.argv[2].split(',') if x != '']
    out_path = sys.argv[3]
    reader = PdfReader(pdf_path)
    out = {}
    for k in indices:
        if k < 0 or k >= len(reader.pages):
            out[str(k)] = None
            continue
        text = reader.pages[k].extract_text() or ""
        out[str(k)] = text
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)

if __name__ == '__main__':
    main()
