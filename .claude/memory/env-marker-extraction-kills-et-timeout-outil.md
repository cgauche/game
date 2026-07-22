---
name: env-marker-extraction-kills-et-timeout-outil
description: "Extraction Marker (PDF→md) — diagnostiquer les kills sans se tromper (SIGTERM 143 = timeout OUTIL, pas tueur externe ; sortie de fond bufferisée)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7589f79f-ac8f-465b-a31d-eaa189991f04
  modified: 2026-07-22T04:59:34.051Z
---

Extraction Marker d'un gros PDF source (`marker_single`, cf. [[game-mdg-new-book-pipeline]] /
skill `ajouter-un-livre-source`) sur cette machine : ~1h30-2h pour ~228 p. (reconnaissance de
layout seule ~1h). Pièges de diagnostic rencontrés le 2026-07-22 (Les Vents de Magie) :

- **`exit 143` (SIGTERM) en avant-plan = le timeout de l'OUTIL Bash (120 s par défaut, 600 s max),
  PAS un tueur externe.** Ne PAS conclure « un watchdog/hook tue marker » : marker tourne >2 min sain,
  il bute juste sur le plafond de l'outil. Test décisif = mesurer le temps écoulé réel (`S=$(date +%s)…`).
- **La sortie d'une tâche de FOND reste VIDE plusieurs minutes même quand marker est sain** (buffering
  du chargement des modèles ~10 Go). La vraie preuve de vie = **RAM/CPU du process python** (`Get-Process
  python* | … WS,CPU`), jamais la taille du fichier de sortie de la tâche.
- Un vrai kill de tâche de fond peut arriver (vécu : 1 run tuée à 54 min) — relancer UNE fois ; si ça
  se reproduit, diagnostiquer (RAM, process), ne pas boucler. Plan B si le fond meurt : extraction par
  tranches (`--page_range`) en fenêtres < 10 min d'avant-plan (`timeout: 600000`), immunes.
- Commande : `--config_json scripts/raw/marker-paginate.json --disable_ocr --disable_image_extraction`.
  Vérifier la taille du `.md` après coup (perte OCR sur livre illustré, cf. Zoo Impérial -70 %).
