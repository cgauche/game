#!/usr/bin/env bash
# Ré-extrait les 13 suppléments à Marker (--disable_ocr, paginé) puis découpe en chapitres NN-Titre.md
# vers un STAGING (Source/_marker/split/<dir>/). NE promeut PAS (revue manuelle avant d'écraser Source/).
# Le LDB est déjà fait. Lancer en arrière-plan : bash scripts/raw/reextract-all.sh
cd "$(dirname "$0")/../.." || exit 1
CFG="scripts/raw/marker-paginate.json"
PDFS=(
"WH - V4 - Aux Armes.pdf"
"WH - V4 - Le zoo impérial.pdf"
"Warhammer v4 - Les archives de l'Empire volume 1.pdf"
"Warhammer v4 - Les archives de l'Empire volume 2.pdf"
"Warhammer v4 - Middenheim la cité du Loup Blanc.pdf"
"Warhammer v4 - 1.0 L'ennemi dans l'Ombre.pdf"
"Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon.pdf"
"Warhammer v4 - 2.0 Mort sur le Reik.pdf"
"Warhammer v4 - 2.0 Mort sur le Reik Compagnon.pdf"
"Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone.pdf"
"Warhammer v4 - Aldorf la Couronne de l'Empire.pdf"
"Warhammer v4 - Aventures a Ubersreik.pdf"
"Warhammer v4 - Nuits agitees & dures journées.pdf"
)
i=0
for pdf in "${PDFS[@]}"; do
  i=$((i+1))
  dir="${pdf%.pdf}"
  echo "######## [$i/13] $dir ########"
  if [ ! -d "Source/$dir" ]; then echo "DIR MANQUANT: Source/$dir"; continue; fi
  out="Source/_marker/full/$dir"
  rm -rf "$out"
  marker_single "Source/$pdf" --output_format markdown --config_json "$CFG" --disable_ocr --output_dir "$out" --disable_image_extraction 2>&1 | tail -1
  md=$(find "$out" -name "*.md" | head -1)
  if [ -z "$md" ]; then echo "ÉCHEC EXTRACTION: $dir"; continue; fi
  node scripts/raw/marker-split.mjs "Source/$dir" "$md" "Source/_marker/split/$dir" 2>&1 | tail -3
  echo "OK $dir"
done
echo "######## DRIVER TERMINÉ ########"
