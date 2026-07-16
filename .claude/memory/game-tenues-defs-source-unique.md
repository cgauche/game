---
name: game-tenues-defs-source-unique
description: "Tenues = defs/ source UNIQUE (plus d'AUTO/MANUAL/merge) ; principe data-driven par famille de rig"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Les tenues de rig sont désormais **une seule source : `src/gameIso/rig/parts/tenues/defs/*.ts`** (88 defs), comme toutes les autres familles de rig (weapons/shields/races/…). Fait 2026-07-04 (commit `dd23b9bf`).

**Ce qui a été supprimé** (le système n'avait migré qu'à moitié — le registre defs/ n'était qu'1 source sur 4) : `careerTenues.ts` (merge `TENUE_MODELS`), `careerTenuesAuto.ts` (64 carrières auto-ingérées), `careerPalettes.ts`, `tenueViews.json`, la fonction `withViews`, le flag `career` sur `TenueDef`, + 6 scripts one-shot d'ingestion/tokenisation. `tenueFor`/`tenuePaletteFor` lisent UNE table.

**Règles de résolution** (dans `career.ts` + `tenues/index.ts`) :
- discrimination « archétype de CLASSE (repli) » vs « tenue SPÉCIFIQUE (par id) » = dérivée de la **taxonomie `careers.json`** (`CLASS_IDS`), **plus de flag** sur le def.
- `bareFoot` = **SOURCE UNIQUE** = flag `bareFoot` du def (Nu + Squelette le portent) ; les hardcodes `tenueId === 'nu' || 'squelette'` retirés de `resolve.ts`.
- vues dos/profil : repliées DANS le def (`set.torse = {front, back, profile}`), plus de table latérale.

**Feedback user durable** : « **data driven est le maitre mot** » + « on ne devrait avoir ni Manual, ni auto, ni career tenue defs, **juste des tenues en def et basta** ». Chaque famille de rig = 1 dossier `defs/` auto-enregistré, zéro couche générée/manuelle/merge par-dessus. Voir [[feedback-contenu-donnee-editeur-pas-code]], [[feedback-appearance-svg-in-defs]], [[feedback-zero-retrocompat-briques-solides]] ; même esprit que [[game-namematch-deleted]] / [[game-monolithic-sprites-vestigial]].

**Même session, même pattern pour les ARMURES** (commit `70116385`) : `GENERATED_ARMOUR` (record front-only, têtes manquantes de profil/dos) → `src/gameIso/rig/parts/armour/defs/*.ts` (Rembourré/Cuir/Maille/Plaque, art directionnel `{front, profile, back}` tokenisé). Corrige « PNJ armurés sans tête selon l'angle ».

**Méthode de migration vérifiée** (réutilisable pour un fold « générés → defs ») : codemod déterministe (fold des valeurs RÉSOLUES au runtime, pas re-parse) + **empreinte comportementale** (dump `tenueFor`+`tenuePaletteFor` sur TOUS les ids atteignables — careers/creatures/classes) AVANT/APRÈS → diff vide = byte-identique. Ici 202 ids identiques ; goldens verts ; suite 8563.
