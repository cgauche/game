---
name: game-tenues-defs-source-unique
description: "Tenues = defs/ source UNIQUE (plus d'AUTO/MANUAL/merge) ; principe data-driven par famille de rig"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Les tenues de rig ont **une seule source : `src/gameIso/rig/parts/tenues/defs/*.ts`** (109 defs), comme toutes les autres familles de rig (weapons/shields/races/…). Fait 2026-07-04 (commit `dd23b9bf`).

**Contrat** : `defs/` EST la source — aucune couche générée, aucune table latérale, aucun merge par-dessus (le piège d'origine : le registre `defs/` n'était qu'1 source sur 4). `tenueFor`/`tenuePaletteFor` lisent UNE table.

**Règles de résolution** (dans `career.ts` + `tenues/index.ts`) :
- discrimination « archétype de CLASSE (repli) » vs « tenue SPÉCIFIQUE (par id) » = dérivée de la **taxonomie `careers.json`** (`CLASS_IDS`), **plus de flag** sur le def.
- **déchaussé = `tenue.pied == null`** — la tenue déclare ce qu'elle CHAUSSE, jamais un drapeau « pieds nus » ni un `tenueId === 'nu' || 'squelette'` en dur. Le repli est le Nu de l'ESPÈCE (`PIED_NU[extremites]`, `resolve.ts`) : une botte est toujours un HABIT porté, jamais un défaut.
- vues dos/profil : repliées DANS le def (`set.torse = {front, back, profile}`), plus de table latérale.

**Feedback user durable** : « **data driven est le maitre mot** » + « on ne devrait avoir ni Manual, ni auto, ni career tenue defs, **juste des tenues en def et basta** ». Chaque famille de rig = 1 dossier `defs/` auto-enregistré, zéro couche générée/manuelle/merge par-dessus. Voir [[credo-exemples-calibrants]], `docs/architecture.md` ; même esprit que [[game-namematch-deleted]].

**Même session, même pattern pour les ARMURES** (commit `70116385`) : `GENERATED_ARMOUR` (record front-only, têtes manquantes de profil/dos) → `src/gameIso/rig/parts/armour/defs/*.ts` (Rembourré/Cuir/Maille/Plaque, art directionnel `{front, profile, back}` tokenisé). Corrige « PNJ armurés sans tête selon l'angle ».

**Méthode de migration vérifiée** (réutilisable pour un fold « générés → defs ») : codemod déterministe (fold des valeurs RÉSOLUES au runtime, pas re-parse) + **empreinte comportementale** (dump `tenueFor`+`tenuePaletteFor` sur TOUS les ids atteignables — careers/creatures/classes) AVANT/APRÈS → diff vide = byte-identique. Ici 202 ids identiques ; goldens verts ; suite 8563.
