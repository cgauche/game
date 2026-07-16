---
name: game-edo-edoc-sourcing-fix
description: "L'import Chaos « EDO p.7X-8X » était mal sourcé — EDO principal n'a aucun sort/talent/créature ; vrai contenu = EDOC. Vérifier book+page par desc-match PDF."
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

L'import « Tome 1 Chaos/Tzeentch » (2026-06-11) avait tout taggé **EDO p.7X-8X** alors que **EDO principal (`Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre`) ne contient AUCUN bloc de stats de sort/talent/créature** — il ne fait que LISTER les noms du culte (~p.110) ; son APPENDICE 2 (p.144-160) n'a que PNJ/maladies/quelques traits+mutations « nouveaux ». Les vrais blocs (NI/Portée/desc) sont dans **EDOC ch.9 « La Main pourpre »** (p.79-85).

Corrigé (commits 4c4294f0, a384f5c1, 2e2f5f95, d85817f3) :
- **EDOC-exclusif** (vérifié absent d'EDO ET de LDB) → book EDOC, pages réelles : 22 sorts (p.79-83) + **Transformation de Tzeentch** ajouté (seul manquant) ; 3 talents (p.75) ; 3 créatures Furie/Horreurs (p.84-85) ; 2 traits Marque/Feu de Tzeentch (p.83-84).
- **EDO APPENDICE 2** (vrais « nouveaux » EDO, pas LDB) → book EDO, page p.147-148 (était p.83/84 = pages EDOC) : 6 traits (Amorphe/Contagieux/Absorption/Dédoublement/Voleur de chair/Décérébré) + 5 mutations (Chair nécrosée/Crétin/Pattes (Chèvre)/Tête bestiale (Chien)/Tête pointue).
- **LDB ch.19** : 40 mutations de la table de Corruption avaient `source: undefined` → LDB p.184 (physiques) / p.185 (Dérangements). Écailles épineuses = paire LDB(p.184)+EDOC(p.68), 2 entités (cf. [[game-collisions-variantes-livres-deferred]]).

**Méthode (réutiliser pour tout audit de source)** — ne jamais deviner (cf. [[game-sources-pdf-errors-verify-case-by-case]]) : pinner book+page par **correspondance d'une phrase distinctive de la desc** dans le PDF via `fitz` (pymupdf). **Offset page** : EDO `printed = pdf_index + 1` (pas de page labels) ; EDOC `printed = pdf_index` (page labels définis). Croiser EDO vs EDOC vs LDB pour trancher le book. Garde-fou byte-fidèle : réécrire en `JSON.stringify(v,null,2)` (node), pas python.
