---
name: game-named-flag-effective-psychtraits
description: "Flag `named` sur les créatures (remplace title!=null) + seam moteur `effectivePsychTraits` (maladie→psychTrait)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7fda4d63-abe3-41d4-9a6d-e37d4b955a9e
---

Deux acquis réutilisables de la curation #81 (PNJ/créatures manquants de Middenheim).

**1. Marqueur `named` data-driven** (commit `e0fec5ed`) : `CreatureData.named?: boolean` (`src/data/index.ts`)
+ helper **`isNamed(c) => c.named === true`** = SOURCE UNIQUE de la nommé-ité, **remplace l'heuristique
faible `title != null`** (title = surchargé « sous-titre de carrière » ; cassait pour les nommés sans carrière,
ex. uniques du Zoo Impérial). `title` redevient purement l'affichage. Éditable au Codex **automatiquement**
(l'éditeur INFÈRE le formulaire depuis la donnée — `editFields.ts kindOf` : `boolean→'checkbox'` ; aucun câblage).
Consommateur : pastille « Individu nommé » dans l'en-tête Codex (`registry.ts`, slot `meta`/`facts` existant).
Backfill : individu nommé = nom propre/épithète/unique (vérifié au `desc` verbatim : **singulier=individu**,
**pluriel « Les X sont… »=espèce/sous-espèce** → générique).

**2. Seam moteur `effectivePsychTraits`** (commit `3f45b1a3`) : une maladie/symptôme actif peut octroyer un
Trait psy (op `grantPsychTrait` en `passive`, comme les mutations) — mais `disease.ts` est **read-only by
design** (ne mute jamais `c.psychTraits`, n'importe pas `applyOps`). Donc DÉRIVATION, pas attache :
`diseasePsychTraits(c)` (`disease.ts`) filtre les `grantPsychTrait` des symptômes `phase==='active'` →
**`effectivePsychTraits(c)` (`psychology.ts`) = `c.psychTraits` ∪ dérivés-maladie = SEUL point de lecture**.
Consommé par `targetedTrigger` (Haine/Animosité), `containedSocialPenalty` (`skills.ts`), et **`isFrenzyCapable`**
(la Frénésie octroyée rend réellement frénésie-capable — sinon inerte au combat ; **corrige aussi les mutations**
qui octroyaient Frénésie). ⚠ Piège vérifié : « dans la liste effective » ≠ « effet réel » — toujours vérifier le
CONSOMMATEUR (le sous-système Frénésie lisait `c.traits`, pas les psychTraits → trou attrapé en orchestration).

Cf. [[game-symptoms-data-driven]], [[game-passifs-unifies-p0-p3]], [[game-codex-editable-json-free]],
[[game-no-mj-model-everything]]. **#81 CLOS** (2026-06-29) : les 36 profils manquants de Middenheim curés en
8 lots (Babrakkos+3 Skavens+humains/nains/casters/cultistes+2 archétypes named:false+4 prétirés+lutin), chaque
record comblant ses réfs manquantes DEPUIS LA SOURCE (no-debt). Méthode validée : agents curent par lot, je
vérifie chaque stat/tenue/ref contre le RAW (a sorti maints bugs : arg-libellé-vs-id, rig Pestilens≠Grey Seer,
sort type:"Sort"/cn-string, Frénésie inerte, possessions omises, goldens jamais régénérés). Tenue = carrière
résolue par `careerTenuesAuto` via slugId (accents normalisés). Goldens rig à régénérer (additif) après ajout
de créatures — `vitest src/data` NE couvre PAS `src/gameIso/rig` (golden de résolution).
