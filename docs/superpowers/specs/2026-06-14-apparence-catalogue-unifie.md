# Catalogue d'apparence unifié (convergence B)

## Intention

Objectif produit : **personnalisation maximale pour créer des PNJ**. L'apparence d'un PNJ /
créature / race = une **combinaison d'éléments réutilisables** piochés dans un catalogue. Le code
fournit les catalogues (« comment dessiner l'élément X »), la donnée fournit les sélections (« quels
éléments »). Rien n'est verrouillé à une créature (ex. yeux rougeoyants ≠ réservés au Vampire).

## Constat (vérifié)

4 registres d'éléments coexistent, dont 3 déjà partagés + keyés mais hétérogènes, + 1 orphelin :
- `EYE_OPTIONS` (parts/eyes.ts) — yeux (chat/caprin/reptilien/noir/**rouge**/verre). Partagé. Type =
  *remplacement d'œil en place* (`swapEye`).
- `MONSTER_HEAD/ARM/LEG_OPTIONS` (parts/monstrous.ts) — tête/membres monstrueux. Type = *remplacement de membre*.
- `MUTATION_VISUALS` (parts/mutations.ts) — `{overlays?, build?, legs?, skin?, faceFlip?, eyeG?}`. Le
  plus proche du vocabulaire cible (cumule overlay + morpho + recolor + flip + œil).
- **Features de race** (`RaceDef.features` inline, 14/21 defs) — queue, cornes, oreilles, barbe,
  panse, écailles, pelage, griffes, crocs, verrues, plaie. **Orphelin, non réutilisable.**
- Accroc : `Vampire.eyes = { G: OEIL_ROUGE }` référence l'ART en dur au lieu de la CLÉ `rouge`.

## Cible — vocabulaire `AppearanceElement`

`MutationVisual` généralisé : `{ key, label, category, overlays?, eye?{G,D}, build?, legs?, skin?, faceFlip? }`.
Catalogue unique `APPEARANCE_ELEMENTS`. `RigOverlay.replace` couvre déjà le remplacement de membre.

Sélection (donnée) hybride : slots `head/armG/armD/legs/eyeG/eyeD` (1 chacun) + `features: string[]`
(additif). Empilement : défaut race ⊕ surcharge créature ⊕ instance scène. Composition : `applyElements`
unique (remplace mutationOverlaysFor/mutationAppearance/résolution monster/applyEyes).

## Chemin (chaque étape golden-gated, committable)

- **B1** — module catalogue + type ; extraire les features de race en éléments `trait` keyés ;
  `RaceDef.features: string[]` (clés) ; Vampire `eyes` art→clé. Dédup byte-identique (OV_QUEUE → `queue`) ;
  features tunées par race → clés distinctes OU canonique `scale:'bone'` (golden assumé) au cas par cas.
  Donnée d'apparence gagne `features?: string[]` → tout PNJ ajoute des traits du catalogue.
- **B2** — fondre yeux + membres monstrueux + mutations dans `APPEARANCE_ELEMENTS` ; `applyElements` unique.
- **B3** — éditeur : pickers par catégorie (unique tête/yeux/bras/jambes, multi traits) sur créature/PNJ.
- **B4** — supprimer les 4 anciens registres.

## Garde-fous

- Golden master du bestiaire (`creature-*-golden`, `biped-golden`) byte-identique à chaque étape sauf
  changements de partage ASSUMÉS (loggés).
- `RaceDef.features` → clés : seul `races/index.ts`/composeRig consomment → contenu.
- Empilement d'apparence déjà livré (record créature → scène) : les `features` suivent le même.
