#!/usr/bin/env bash
# Ré-extrait à Marker (--disable_ocr, paginé) les livres dont l'id (`src/data/books.json`) est passé en
# argument, puis découpe en chapitres NN-Titre.md vers un STAGING (Source/_marker/split/<id>/ de l'arbre
# principal). NE promeut PAS (revue manuelle avant d'écraser Source/). Chemins : CLI
# `scripts/raw/pdf-de.mjs` (#1739). Lancer en arrière-plan : bash scripts/raw/reextract-all.sh <id>...
cd "$(dirname "$0")/../.." || exit 1
CFG="scripts/raw/marker-paginate.json"
if [ "$#" -eq 0 ]; then echo "usage : bash scripts/raw/reextract-all.sh <id du livre>..."; exit 1; fi
i=0
for id in "$@"; do
  i=$((i+1))
  echo "######## [$i/$#] $id ########"
  pdf=$(node scripts/raw/pdf-de.mjs --copie-marker "$id") || { echo "PDF INDISPONIBLE: $id"; continue; }
  out=$(node scripts/raw/pdf-de.mjs --sortie-marker "$id") || exit 1
  split=$(node scripts/raw/pdf-de.mjs --marker "split/$id") || exit 1
  rm -rf "$out"
  marker_single "$pdf" --output_format markdown --config_json "$CFG" --disable_ocr --output_dir "$out" --disable_image_extraction 2>&1 | tail -1
  md=$(find "$out" -name "*.md" | head -1)
  if [ -z "$md" ]; then echo "ÉCHEC EXTRACTION: $id"; continue; fi
  node scripts/raw/marker-split.mjs "$id" "$md" "$split" 2>&1 | tail -3
  echo "OK $id"
done
echo "######## DRIVER TERMINÉ ########"
