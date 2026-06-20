# Bestiaire — rendu des créatures (suivi)

Suivi des créatures dont le **rendu** demandait un gabarit/une pièce dédiés. Cf.
`docs/creer-une-creature.md` pour la marche à suivre, `src/gameIso/rig/creatures/defs/` pour les defs.

Une créature est rendue **bipède Humain par défaut** (`resolveRender`, `src/gameIso/rig/bodyPlan.ts`)
si elle ne déclare ni espèce mappée à un gabarit non-bipède (`appearance.species` → def `plan` ≠ `biped`,
OU un def homonyme de son label), ni trait `Nuée`.

> **Réfs d'art** : illustrations officielles du Zoo Impérial extraites dans `art-ref/zi/` (gitignoré,
> droits Cubicle 7). Script : `python art-ref/_extract_zi.py`. QC d'un rendu :
> `npx tsx scripts/_qc-zoo.mts <id,id,…>` → `public/qc/zoo.png`.

## ✅ File d'attente VIDÉE (passe « images » juin 2026)

Les 10 créatures importées (Zoo Impérial) qui retombaient sur le bipède Humain sont toutes traitées,
forme tranchée sur l'**art officiel** (plus de devinette) :

| Créature | Forme (art + source) | Rendu |
| --- | --- | --- |
| Léviathan | crabe/homard géant (`Pinces`, `Crustacé`, p.88) — PAS un serpent de mer | gabarit **`crustace`** |
| Il Potente Granchio | crabe géant de Tilée (p.87-88) | gabarit `crustace` |
| Trégara | arthropode à pinces antérieures (p.79) | gabarit `crustace` (approx.) |
| Brochet du Stir | brochet géant, vrai poisson (p.36-38, `art-ref/zi/page039`) | gabarit **`fish`** |
| Grand Cerf | cervidé à grande ramure (p.10-11, `page014`) | quadruped + pièce **`headgear:'bois'`** |
| Preyton | cervidé ailé (p.46) | winged + `headgear:'bois'` |
| Cornu | reptile cornu à sang froid | quadruped tête 'dragon' + `headgear:'cornes'` |
| La Bête de l'Oblast | variante de Chimère (p.69-70) | `appearance.species:"Chimère"` (winged) |
| Peau-de-Loup | loup-garou anthropomorphe | def biped `perso.head:'chien'` + nu |
| Choses du Bois Mort | humains mutés (bûcherons, Mutation 3) | reste bipède (correct) |

Gabarits créés : `src/gameIso/rig/crustace/composeCrab.ts` (plan `crustace`),
`src/gameIso/rig/fish/composeFish.ts` (plan `fish`). Pièce de catalogue : `QuadProps.headgear`
('bois'/'cornes') rendue par `quadParts.headgear()` près de l'os tete (vaut pour quad ET winged).

Bugfix en cours de route : `entityRigProfile` résout désormais l'espèce **label-aware** (id→label→def,
comme `resolveByName`) → un record dont l'id (kebab) ≠ le nom de def (libellé) résout enfin vers son def.

## Pistes ultérieures (pas bloquantes)

- **Reste du lot frenchy.bzh** : d'autres créatures importées sans `appearance.species` peuvent encore
  retomber sur le bipède Humain (cf. le chantier frenchy d'origine). Les router au fil de l'eau : la
  plupart mappent à un gabarit EXISTANT (avian/quadruped/winged/serpentine) — un simple
  `appearance.species` suffit ; vérifier au QC.
- **Choses du Bois Mort** pourrait recevoir des features de mutation visibles (cornes/tentacules) — cosmétique.
- **Trégara** est approximé par le crabe (faute de gabarit insecte/mante dédié) — acceptable.

## Comment traiter (rappel)

- **Router vers un gabarit existant** : `"appearance": { "species": "<NomDef>" }` dans le record
  (`src/data/creatures.json`), `<NomDef>` = `name` d'un def `plan` ≠ `biped`. (Label == nom de def →
  auto-routage, pas d'édition JSON.)
- **Créer un gabarit/def** : `docs/creer-une-creature.md`, puis `npm run gen` + QC (`scripts/_qc-zoo.mts`).
- **Vérifier** : `npx vitest run src/gameIso/rig/golden/` (render + resolution + combat). Toute
  reclassification change les snapshots des créatures concernées → `-u` après contrôle VISUEL, en
  confirmant que le diff est limité aux créatures voulues. Ajouter un nouveau `plan` = l'inscrire aussi
  dans la liste `PLANS`/`PROPS` de `creatures.test.ts` (garde-fou de bonne formation).
