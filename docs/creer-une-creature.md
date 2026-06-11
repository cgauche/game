# Créer une nouvelle créature (rig)

Tout passe par le **registre auto-collecté** : 1 créature = 1 fichier dans
`src/gameIso/rig/creatures/defs/<Nom>.ts`, ramassé par `npm run gen` (auto en dev/build).
**Aucune table centrale à éditer.** Ce guide couvre le choix du squelette, la séparation
corps nu / tenue, le calage sur l'illustration officielle et le QC.

## 0. D'abord : l'illustration officielle

`art-ref/ldb/mapping.json` (clé `creatures`) donne le chemin PNG de l'illustration LDB de
chaque créature (dossier gitignoré — droits Cubicle 7 — mais lisible localement ; un script
d'extraction l'alimente depuis les PDF). **L'illustration prime sur le texte** pour les
couleurs, la tenue et les accessoires (la Démonette « crémeuse » du texte est lilas à corset
doré dans l'art p.337). La lire AVANT de dessiner, et y revenir au QC.

## 1. Choisir le squelette (`plan`)

| plan | quand | props |
|---|---|---|
| `biped` | humanoïde (deux jambes, peut porter arme/tenue) | `race` + `perso` |
| `quadruped` / `winged` | bête à 4 pattes (± ailes) | `quad: QuadProps` |
| `serpentine`, `arachnid`, `avian`, `cephalopod`, `spectral`, `squig`, `amorphous`, `jabberslythe` | gabarits exotiques | le champ du même nom |

Pour les non-bipèdes : copier le def existant le plus proche (`Basilic`, `Araignee`,
`Squig`, `Fantome`…) et ajuster les props — ils sont auto-documentés dans
`src/gameIso/rig/<plan>/compose*.ts`.

## 2. Bipède — l'empilement d'apparence

```
Plan × Gabarit (carrure) × Race (peau/tête/traits) × Perso (surcharges du def) × Tenue (carrière)
```

```ts
// creatures/defs/Ma-creature.ts
export const creature: CreatureDef = {
  name: 'Ma créature',          // clé d'espèce canonique
  plan: 'biped',
  match: 'ma.?creature|alias',  // regex sur le nom normalisé (accents retirés)
  matchPriority: 12,            // plus BAS = testé AVANT (désambiguïse « rat ogre » vs « rat »)
  race: 'Skaven',               // race d'apparence imposée (sinon heuristique baseSpeciesOf)
  perso: { … },                 // surcharges propres à CETTE créature (voir §3)
};
```

- **`race`** (`races/defs/`) porte les défauts partagés : palette de peau, `gabarit` (carrure,
  `gabarits/defs/`), `head`/`legs` monstrueux (remplacent visage/jambes), `features` de corps
  (queue, fourrure, panse…), `pose` (voûté — PROFIL uniquement), `career` par défaut, `eyes`.
- **`perso`** (CreaturePerso) surcharge par-dessus : `career`, `sex`, `colors`
  (⚠ couleurs de BASE seulement : `peau`/`cheveux`… — les nuances O/H sont dérivées, tsc
  refuse `peauO`), `gabarit`, `scale` (toise : art ∈ [0.5, 1.35]), `parts` (coiffure/visage
  épinglés), `eyes` (clés du catalogue `EYE_OPTIONS` : noir, rouge, chat…), `monster`,
  `features`.

### `monster` vs `features` — le piège n°1

- **`perso.monster`** (MonsterParts : `tete`, `brasG/D`, `jambes`, `ailes`, `griffes`…) =
  **override COMPLET** : la structure de race (head/legs/features — queue comprise) est
  SAUTÉE. À réserver aux créatures qui redéfinissent tout (Démonette).
- **`perso.features`** (RaceFeature[]) = **ADDITIF** par-dessus la race : cornes du Prophète
  gris, griffes du Rat ogre, écailles de la Furie… C'est l'outil « race partagée + extra ».
  Champs : `bone`, `svg` (tokens `@peau`/`@cheveux`…), `layer` (négatif = derrière la part),
  `view` (limiter à une vue), `scale: 'bone'` (suit l'épaisseur de l'os).

## 3. La règle d'or : corps nu ≠ tenue

**Morphologie** (fourrure, cornes, queue, panse, musculature, cicatrices, épines) → `race.features`
ou `perso.features`. **Équipement** (pagne, corset, fétiches, plaque-bedaine, armure) →
**tenue de carrière au registre** : `tenues/defs/<Nom>.ts` avec `career: true`, et le def
pointe `perso.career: '<Nom>'`. Un monstre mis en career `'Nu'` doit être RÉELLEMENT nu.

```ts
// tenues/defs/Ma-tenue.ts
import { NU_TORSE_FRONT, NU_TORSE_BACK, NU_TORSE_PROFILE, NU_JAMBE } from '../nuViews';
export const tenue: TenueDef = {
  name: 'Ma créature',     // = la career pointée par le def
  career: true,
  bareFoot: true,          // MONSTRE : pied nu griffu + substitutions dos/profil en chair
  palette: { vet1: '#9a8a6a', cuir: '#4a3a28' },   // tokens recolorables par l'éditeur
  set: {
    // le slot REMPLACE le « Nu » : inclure la CHAIR (nuViews) sous l'équipement, par vue
    torse: { front: `<g>${NU_TORSE_FRONT}…pagne…</g>`, back: …, profile: … },
    jambes: NU_JAMBE,
  },
};
```

- Sans `bareFoot`, toute carrière ≠ Nu reçoit des **bottes** (voulu pour l'Ogre, pas pour un démon).
- Exception documentée : un équipement porté par un **membre monstrueux** (brassards de la
  Démonette sur ses bras-pinces) reste en `features` — le slot `bras` de la tenue serait
  écrasé par le remplacement monster.
- Dessiner l'équipement de la zone bassin (pagne, jupe) **sur l'os `torse` zone basse
  (y 8..28)** : l'os `bassin` est peint SOUS le torse.

## 4. Pièges de dessin codifiés (récidives connues)

- **Éléments latéraux pairs de PROFIL** (cornes, pointes d'épaule) : jamais l'art de face
  plaqué (→ « anses »). Cornes **par-vue** : paire front/back, et de profil UNE corne balayée
  en arrière + `lateralPair(art, {dx})` (`parts/parallax.ts`) pour l'exemplaire lointain.
- **Rien de décollé** : oreilles/cheveux/cornes ancrés DANS la silhouette du crâne (base qui
  rentre sous la part de tête, peinte derrière).
- **Tête de race + coiffe** : la tête (rat, orc…) passe SOUS le casque/capuche de la tenue —
  géré par composeRig, ne pas re-dessiner le crâne dans la coiffe.
- **Dents de face** : gueule AU BOUT du museau + crocs aux commissures (un rictus à
  mi-museau lit « dents de lapin »). Yeux : `goatEye` (caprin), `emberEye` (braise démon),
  `ratEye` (rouge skaven), `beastEye` (prédateur) — `parts/monster/eyes.ts`.
- **Pas de token vif dans un détail front-only** : `dominantCloth` prend le token le plus
  fréquent pour les silhouettes dos/profil substituées (des fioles `@metal` vertes ont déjà
  repeint un torse entier). Détails en couleurs littérales.
- Un bras monstrueux (pince/tentacule) efface son poing automatiquement.

## 5. Workflow complet

1. **Lire l'illustration** (`art-ref/ldb/mapping.json`) + le texte source (LDB/campagne FR).
2. Déposer `creatures/defs/<Nom>.ts` (+ `races/defs/` si nouvelle race partagée,
   + `tenues/defs/` si équipement, + `parts/monster/defs/` si nouvelle tête/membre).
3. `npm run gen` (vérifier le compteur de fichiers du registre).
4. **QC rendu** : script temporaire `scripts/_tmp-qc-*.mts` (pattern : `entityRigProfile(name,
   seed)` → `resolveRig` 3 vues → PNG resvg) — **zoom unitaire ~700px OBLIGATOIRE** (la
   planche cache les défauts), comparer à l'illustration, itérer. Supprimer le script après.
5. `npx vitest run src/gameIso` — mettre à jour les cas de routage de
   `creatures/creatures.test.ts` ; goldens (`-u`) APRÈS inspection visuelle uniquement.
6. `npx tsc --noEmit`, `npm run galleries` (la créature apparaît automatiquement dans les
   galeries rig/bestiaire/toise — `public/galeries.html`).
7. Stats : rien à faire si elle est dans `creatures.json` (LDB/ADE) ; créature d'aventure →
   **CustomStatblock dans la scène** (règle 1 : jamais de stats inventées).

## Exemples à copier

- Variante d'une race existante : `creatures/defs/Vermine-de-choc.ts` (+ sa tenue).
- Morpho lourde + tenue : `Rat-ogre.ts` (fourrure/épines/couture en features, pagne en tenue).
- Override complet : `Demonette.ts` (monster + tenue + yeux + cornes par-vue).
- Monstre ailé : `Furie-du-chaos.ts` (ailes de cuir, écailles, cornes par-vue).
- Nouvelle tête : `parts/monster/defs/horreur.ts` (3 vues, tokens @peau).
