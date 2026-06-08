# Apparence des créatures — Gabarits & Races en registre (Sous-projet 1 : bipèdes)

**Goal :** rendre l'apparence d'une créature entièrement exprimable dans des fichiers de registre
(1 fichier = 1 élément, ajoutable sans toucher au code central), pour que chaque créature porte
sa vraie identité (et non « humain + tête + couleur »). Pilote : l'**Ogre**.

**Architecture :** une créature = **Plan (rig)** × **Gabarit (carrure)** × **Race (peau/traits)** ×
**Perso**. Gabarit et Race deviennent deux nouvelles familles du registre codegen (comme les tenues).
Les tables centrales actuelles (`PROPS`, `SPECIES_PALETTES`, `SPECIES_POSE`, l'if-chain `baseSpeciesOf`)
sont **dissoutes** dans ces fichiers. Les parts de corps **s'échelonnent à l'os** qu'elles habillent.

**Tech :** TS pur + `gen-registry.mjs` (codegen existant) ; rendu via `composeRig` (inchangé en forme,
nourri différemment) ; QC headless `@resvg/resvg-js` + audit aveugle (workflow).

---

## 1. Problème (constaté + vérifié à l'œil)

La migration monolithique→rig a produit des créatures samey/cassées car l'apparence bipède est
**centralisée et rigide** :
- **Proportions** dans `PROPS` (`skeletons.ts`), clé = `baseSpeciesOf` (if-chain centrale). Pas dans le def.
- **Palette peau** dans `SPECIES_PALETTES` (généré, central). **Posture** dans `SPECIES_POSE` (`composeRig`, central, profil seul).
- **Vocabulaire d'attributs** (`tete/bras/jambes/cornes/queue/ventre/cape`) figé dans `monstrous.ts` (type `MonsterParts` + dispatch `if(m.x)` + constantes `OV_*`).
- **Défaut structurel** : les overlays (`OV_VENTRE`…) sont des SVG de taille fixe épinglés à un os → **ne s'échelonnent pas** (le gutplate reste un petit disque sur l'ogre géant → « disque flottant »).

Conséquence : ajouter une créature au look neuf force des éditions dans 3-4 fichiers partagés, et
certaines identités sont **inexprimables** (un plastron qui remplit le ventre). Cf. `game-rig-species-sameness`.

NB : pour les **quadrupèdes**, les proportions sont déjà dans le def (`quad:{girth,sl…}`) — c'est le
modèle à généraliser. Les quads ont leurs propres maux (corps + pattes partagés, tête de souris pour
le loup) → **Sous-projet 2**, hors de cette spec.

## 2. Les 4 axes

1. **Plan (rig)** — biped / quadruped / winged / … La machinerie squelette + anim. **Inchangé** (déjà
   un registre `plans/defs/`).
2. **Gabarit (carrure)** — preset de proportions **nommé et réutilisable** : `elance`, `moyen`,
   `courtaud` (nain), `gremlin` (gobelin/snotling : petit + grosse tête), `brute` (massif voûté :
   ogre/troll/rat-ogre/minotaure). C'est `PROPS` **découplé de l'espèce**.
3. **Race (peau/identité)** — tête + palette de peau + **traits caractéristiques** (barbe, défenses,
   gut+gutplate, queue) + un **gabarit par défaut** + posture de repos.
4. **Créature (perso)** — `race` + `gabarit?` (override, ex. rat-ogre) + tenue/career, couleurs,
   échelle, parts spécifiques, seed.

**Réutilisation :** quelques gabarits × des races (peaux) × perso → tout le bestiaire. La plupart des
créatures = `plan + race` (gabarit = défaut de la race, rien à préciser). Les exceptions/sous-espèces
ajoutent `gabarit:` (rat-ogre = `race:Skaven` + `gabarit:brute`).

## 3. Registres (codegen, comme les tenues)

Deux nouvelles familles dans `gen-registry.mjs` (champs `dir/out/exportName/arrayName/type/typeFrom`) :

### `rig/gabarits/defs/<id>.ts` → `GabaritDef`
```ts
export interface GabaritDef {
  id: string;            // 'brute', 'courtaud', 'gremlin', 'elance', 'moyen'…
  sl: number; st: number;          // longueur / épaisseur globales
  legs: number; arms?: number; head?: number;  // facteurs membres/tête (cf. PROPS actuel)
}
```
- Dérive `GABARITS: Record<string, GabaritDef>`. `baseSkeleton` lit le gabarit (plus `PROPS[baseSpeciesOf]`).
- Migration : les ~20 lignes de `PROPS` deviennent ~6-8 fichiers gabarit (les carrures distinctes ;
  plusieurs espèces actuelles partagent la même carrure → dédoublonnage).

### `rig/races/defs/<id>.ts` → `RaceDef`
```ts
export interface RaceDef {
  id: string;                 // 'Humain', 'Skaven', 'Ogre', 'Nain'…
  match: string;              // regex nom→race (remplace l'if-chain baseSpeciesOf)
  matchPriority?: number;
  gabarit: string;            // gabarit par défaut (id d'un GabaritDef)
  palette?: StoredPalette;    // peau/cheveux/yeux (remplace SPECIES_PALETTES)
  head?: string;              // part de tête monstrueuse (id du registre de parts), sinon visage humain
  features?: RaceFeature[];   // traits de corps échelonnés (gut+gutplate, barbe, queue, cornes…)
  pose?: Partial<Pose>;       // posture de repos (remplace SPECIES_POSE), appliquée front+profil
}
```
- Dérive `RACES` + le matcher `raceOf(name)`. `detectSpecies`/`baseSpeciesOf` se réduisent à `raceOf`.
- `RaceFeature` = part ancrée à un os **avec règle d'échelle** (cf. §4) : `{ bone, svg, anchor, scale }`.

### `creatures/defs/<Nom>.ts` (existant, évolué)
```ts
{ name:'Rat ogre', plan:'biped', match:'rat ogre', race:'Skaven', gabarit:'brute',
  perso:{ scale:1.3 } }
```
Champ `race` (obligatoire pour les bipèdes), `gabarit?` (override), `perso?`. Rétro-compat : un def
sans `race` retombe sur `raceOf(name)` (les defs actuels continuent de marcher pendant la migration).

## 4. Changement de rendu : parts échelonnées à l'os

Cœur du correctif. Aujourd'hui un overlay est un SVG dessiné dans le repère brut de l'os (échelle 1).
Nouveau : une `RaceFeature` déclare comment elle s'adapte à l'os résolu :
```ts
interface RaceFeature {
  bone: BoneId;
  svg: string;                       // tokens @peau/@metal… (palette partagée)
  layer?: number;                    // ordre peintre (behind/devant)
  scale?: 'bone' | 'fixed';          // 'bone' = suit (thickness,length) de l'os → remplit le corps
  anchor?: { x?: number; y?: number };
}
```
- `composeRig` applique `scaleOf[bone]` (déjà calculé pour les parts normales) **aussi aux features
  `scale:'bone'`** → le gutplate de l'ogre (os `torse`, st≈1.7) se rend gros, centré, et **remplit le
  ventre** au lieu de flotter.
- Les overlays booléens actuels (`OV_VENTRE`/`OV_CORNES`/`OV_QUEUE`…) sont **réexprimés en features de
  race** (déplacés de `monstrous.ts` vers les `RaceDef`/registre de parts). Le dispatch `if(m.x)` figé
  disparaît : une race liste ses features, point.

## 5. Flux de données

`creatureDef` → `raceOf`/`race` → `RaceDef` → `gabarit` (override ou défaut) → `GABARITS[gabarit]` →
`baseSkeleton(gabarit, sex)` → `applyBuild` → `groundSkeleton` → parts (tenue + tête de race) +
**features de race échelonnées** + perso → palette (race.palette + tenue + overrides) → `ResolvedBone[]`
→ SVG. **Même pipeline qu'aujourd'hui**, mais proportions et traits viennent des registres, pas des
tables centrales.

## 6. Pilote : l'Ogre

`race:Ogre` = `{ gabarit:'brute', head:'ogre' (mufle+défenses), palette: peau ogre,
features:[ gut+gutplate (os torse/bassin, scale:'bone', centré), heaume cornu (os tete, behind),
pauldrons (os epauleG/D) ], pose: voûté léger }`. Créature Ogre = `plan:biped, race:Ogre` (+ arme via
perso). **Corrige le bug** (la dalle/disque = OV_VENTRE non-échelonné + career Nu) : le gutplate
devient une feature échelonnée, les épaules portent des pauldrons au lieu d'un bras-dalle.
**Critère de succès** : audit aveugle (workflow) lit « ogre » avec confiance ≥ 3, et l'ogre **s'anime**
(idle/marche/attaque) comme tout bipède.

## 7. Périmètre (Sous-projet 1)

DANS : les 2 registres (gabarits, races) + le rendu features-échelonnées + **migration de TOUS les
bipèdes** vers gabarit/race (sinon `PROPS`/`SPECIES_*` ne peuvent pas être dissoutes) + pilote Ogre +
2-3 races « tells » rejouées proprement (Nain=barbe ancrée mâchoire, Elfe=oreilles, Guerrier du
Chaos=heaume cornu+armure sombre, Mutant=mutations visibles).
HORS (sous-projets suivants) : **SP2 quadrupèdes** (longueur de pattes + corps par espèce + vue profil
+ tête de loup) ; **SP3 sous-espèces** rollout (skaven clanrat/stormvermin, hommes-bêtes gor/ungor).

## 8. Tests & non-régression

- **Golden master** : snapshot du SVG résolu de chaque bipède AVANT migration. La migration
  proportions→gabarit/race doit être **iso-rendu** pour les créatures non ciblées (héros inclus :
  `composeRig` est partagé). Seul l'Ogre (et les 2-3 races rejouées) changent **intentionnellement** —
  golden mis à jour + audit aveugle pour valider l'amélioration.
- **Parité** : un test échoue si un def bipède référence une `race`/`gabarit` non enregistrée.
- **Garde-fou registre** : `gen-registry` régénère les index ; `npm run gen` + `typecheck` verts.
- **QC aveugle** : `_qc-creatures-rig.mts` (front) + workflow d'agents aveugles ; viser ≥3 sur les races rejouées.

## 9. Risques

- `composeRig` est partagé par **tous** les bipèdes ET les héros → le golden master est obligatoire
  avant tout changement. Risque principal = régression silencieuse sur les héros.
- Dédoublonnage des carrures : certaines espèces ont des proportions uniques (Troll bras 1.6) → un
  gabarit `brute` + override fin par race si besoin (`RaceDef` peut surcharger 1-2 facteurs).
- Volume d'art : rejouer proprement gut/barbe/pauldrons = travail SVG (workflow best-of-N + juge,
  comme les armes — cf. `game-qc-reconnaissabilite`).

## 10. Décisions / défauts assumés

- **Couche race explicite** (vs bespoke par créature) : DRY sur les peaux/têtes partagées.
- **Gabarit comme axe séparé** (vs lié à la race) : nécessaire pour skaven-vs-rat-ogre, et réutilise
  « brute » sur ogre/troll/minotaure.
- **Override fin par la race** autorisé (1-2 facteurs de gabarit) pour les cas uniques, sans créer un
  gabarit par espèce.

## 11. Correspondance « existant → axes » (on RANGE, on n'ajoute pas)

Les mécanismes actuels ne disparaissent pas : ils se rangent dans les axes. Le nombre de concepts ne
gonfle pas — ce sont les **tables centrales** qui disparaissent (dans les fichiers gabarit/race).

| Existant aujourd'hui | Devient (axe) |
|---|---|
| Couleurs (`appearance.colors`) | **Perso** — override de la palette de la race |
| Tenue / armure (`career`) | **Perso** — tenue (équipement visible) |
| Membres alternatifs (`monster.jambes`/`bras` : chevre, tentacule, griffe) | **Race-feature** (signature d'espèce) OU **Perso-part** (one-off) — même registre de parts |
| Tête monstrueuse (`monster.tete`) | **Race** (tête caractéristique) |
| Overlays figés `ventre/cornes/queue` (`OV_*`, `monstrous.ts`) | **Race-features échelonnées** |
| Proportions (`PROPS`) | **Gabarit** |
| `build` (0..1) | reste **Perso** (variation fine sur le gabarit) |
| Peau (`SPECIES_PALETTES`) | **Race** (palette) |
| Posture (`SPECIES_POSE`) | **Race** (pose) |
| sex / seed | restent **Perso** |

Règle : *défaut d'espèce* → Race ; *carrure* → Gabarit ; *tweak de CETTE créature* → Perso (Perso
**surcharge** Race). Une part (sabot, tentacule, gutplate) est le **MÊME objet**, déclaré soit dans une
Race (signature) soit en Perso (exception) — jamais deux systèmes.

⚠️ Piège : garder l'ancien chemin (`monster.tete` dans le def créature) ET la Race = deux systèmes. La
migration tranche — tête/features caractéristiques **quittent** le def créature pour la **Race** ; le
def créature ne garde que `race + gabarit? + perso`.

## 12. Principe : composition À PLAT (pas d'héritage)

Tout se compose **par référence d'id, à plat** : une Créature cite une Race (id) + un Gabarit (id) ;
une Race cite son gabarit par défaut (id) + des parts (id). **Aucune hiérarchie de classes, aucun
héritage profond** — juste des fichiers de registre qui se composent par id. Lire/ajouter un élément =
ouvrir **un** fichier. C'est la contrainte directrice : si une décision d'implémentation introduit de
l'imbrication ou un couplage entre fichiers, c'est le signal qu'elle est mauvaise.
