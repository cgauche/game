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

## Livré — apparence d'élément data-driven (mutations / traits portent leur visuel)

`MUTATION_VISUALS` + `mutationAppearance` / `mutationOverlaysFor` + l'adapter `mutationElements()` sont
**supprimés** (registre keyé par label = mort). Les 17 difformités (LDB 19) sont désormais des éléments
de catalogue `parts/elements/defs/<slug>.ts` (calques + morpho `build`/`legs`/`faceFlip`), comme les
features de race.

- **Donnée** : `Mutation.appearance` / `TraitData.appearance` = `Partial<EntityAppearance>` (`features`
  clés du catalogue + `colors` + `eyes`). Édité par `AppearanceField` / `MonsterPartsFields` dans le
  Compendium (créatures + traits + mutations). `mutations.json` est la SEULE énumération des mutations ;
  elle référence les slugs du catalogue.
- **Résolution** : `combatantVisuals` re-source depuis les fragments + le catalogue — `combatantOverlays`
  = `feat(...features)` (param `overlays`), `combatantAppearance` fusionne `colors`/`eyes` (via
  `eyesArtFromKeys`) et applique `featureMorpho(features)` (carrure/jambes/visage). `resolveRig`
  INCHANGÉ → rendu byte-identique (golden + mutations + elements).

### Ajouter un primitif visuel manquant (ex. « peau de plumes »)

1. Déposer UN fichier `parts/elements/defs/<key>.ts` exportant `element: AppearanceElement` (calques SVG
   paramétrés par `textures.ts`, teinte via tokens `@peau`/`@peauO`/`@peauH` → suit `colors.peau`).
   Pilote : `defs/plumage.ts`.
2. `npm run gen` régénère `_registry.generated.ts` (auto en dev via le plugin Vite).
3. Le primitif est LIBRE en donnée : `appearance.features: ['<key>']` sur n'importe quelle mutation /
   trait / créature, plus aucune touche au code. « peau de plumes rouge sang » =
   `{ colors: { peau: '#8b0000' }, features: ['plumage'] }`.
