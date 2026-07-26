---
name: game-mutation-appearance-data-driven
description: "Apparence mutation/trait data-driven (le visuel est EN DONNÉE, catalogue d'éléments) + Codex riche (preview + describe) ; + conventions rig durables (dorsal/yeux/textures/injuries/calque unique) héritées du chantier pré-catalogue"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

Chantier LIVRÉ (2026-06-16). Mutation/trait portent leur visuel EN DONNÉE.

**Aucun registre de visuels par mutation** : les 17 difformités (LDB 19) sont des éléments de catalogue `rig/parts/elements/defs/<slug>.ts` (`category:'mutation'`, calques et/ou morpho `build`/`legs`/`faceFlip`). `mutations.json` est la SEULE énumération ; chaque mutation porte `appearance: Partial<EntityAppearance>` (`features` clés catalogue + `colors` + `eyes`). `Mutation`/`TraitData` ont `appearance?`.

**Résolution** : `combatantVisuals` re-source depuis fragments + catalogue (`feat()` overlays via param, `featureMorpho()` carrure/jambes/visage). `resolveRig` applique AUSSI `featureMorpho(appearance.features)` (commit 21e6bea) → l'aperçu éditeur et les PNJ authorés montrent la morpho ; combattant = morpho repliée par `combatantAppearance` via clés HORS appearance.features → pas de double. Byte-identique (golden render+combat verts).

**Ajouter un primitif visuel** = 1 fichier `defs/<key>.ts` (ex. `plumage.ts`, plumes teintées `@peau`) → `npm run gen` (auto en dev) → libre en donnée. NE PAS relancer `npm run gen` global pendant une session // (clobber les autres registres).

**Codex enrichi** : `CodexItem.appearance` → `CodexEntry` rend un `CreaturePreview` générique (créature/mutation/trait, plus le cas spécial créature). Couche `ui/compendium/describe.ts` (passiveSection/maneuverSection/effectsSection) câblée dans registry pour traits/mutations/qualités, réutilise `opSummary` (complété skillMod/moveMod/testMod-char, commit 7e4cd35). Éditeur : `CodexEdit` `hasAppearance` = créatures+traits+mutations. Reste : Flow→prose des effets déclenchés (léger = déclencheur→cible).

Prolonge [[game-apparence-catalogue-convergence]], [[game-codex-compendium]].

## Conventions rig durables héritées du chantier pré-catalogue (toujours valides, ⊥ de la source de données)

Ces règles de rendu du **rig** (pas de la source de données) restent vraies après la bascule vers le
catalogue d'éléments — elles décrivent COMMENT un calque s'affiche, indépendamment d'où sa définition vit :
- **Règle peau vs excroissance** : une marque DE PEAU plate (bouche parasite, pus, éclats de lustre) ne se
  dessine JAMAIS par-dessus les vêtements (visage/mains seulement, le RAW tire des Localisations mais ne
  perce pas l'habit) ; les EXCROISSANCES 3D (cornes, épines, plumes, tentacule, pattes) PEUVENT percer
  habits/armure. Une mutation CORPS ENTIER (Peau d'acier/Écailles/Brillante) = recolorisation PALETTE
  (`colors.peau`, ombres dérivées, visage+mains compris), jamais un patch de torse ; un MEMBRE muté
  (Tentacule épais) = REMPLACEMENT du membre, pas un calque plaqué.
- **Règles dorsales codifiées** (`rig/parts/dorsal.ts`, `dorsalOverlays(bone, {front,back,profile})`) :
  face = plan fond, dos = plan avant, profil = calque d'os normal ancré au bord arrière (−x) — sinon la
  racine de l'appendice (aile/queue/cape/aura) est occultée ou semble flotter. Tout futur appendice DOIT
  l'utiliser.
- **Un seul traitement des calques** : les overlays de `monsterInjection` (éditeur), mutations, blessures
  et traits passent tous par LA MÊME file de composition (`composeRig`) — `plane`/`view`/`behind`/`replace`
  n'ont qu'une implémentation ; l'éditeur ne peut plus diverger du jeu.
- **Système d'yeux adressable** (paquet `rig/parts/eyes/`, API en `eyes/index.ts`) : l'œil peint est un élément adressable
  (`<g data-eye="G/D">`) sur les têtes générées, `swapEye`/`applyEyes` le remplacent EN PLACE (verre,
  perdu, cache-œil, chat, caprin, reptilien, noir, rouge, énorme) ; `RaceDef.eyes` fournit le défaut,
  surchargé par `Appearance.eyes`.
- **Textures paramétriques** (`rig/parts/textures.ts` : `plume()/plumeFan()/scalesPath()/scalesPatch()/
  furPath/furPatch`) génèrent des motifs en tokens de palette (pas des `<pattern>` SVG, qui cassent la
  dérivation d'ombres) — réutilisées par tout le bestiaire (harpie, homme-lézard, Dragon écailles de
  flanc, Griffon/Hippogriffe collerette emplumée).
- **Amputations/prothèses** (`rig/parts/injuries.ts`) suivent la MÊME architecture que les mutations
  (trauma + prothèse portée → calques/replace), consommées avec l'apparence de mutation par une source
  unique `combatantVisuals.ts` (`combatantOverlays`/`combatantAppearance`) — un futur visuel d'état s'y
  branche.
- **Piège `perso.monster`** : le champ `monster`/`monsterInjection` d'une créature COURT-CIRCUITE
  entièrement les `race.features` (`hasPersoMonster` skip) — un perso.monster non vide doit migrer
  tête/queue/couleur vers la RACE (head/palette/features), pas rester en override caché.
