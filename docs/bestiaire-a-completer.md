# Bestiaire — créatures à compléter

Suivi des créatures du bestiaire dont le **rendu** n'est pas (encore) fidèle. Cf.
`docs/creer-une-creature.md` pour la marche à suivre, `src/gameIso/rig/creatures/defs/` pour les defs.

Une créature est rendue **bipède Humain par défaut** (`resolveRender`, `src/gameIso/rig/bodyPlan.ts`)
si elle ne déclare ni espèce mappée à un gabarit non-bipède (`appearance.species` → def `plan` ≠ `biped`,
OU un def homonyme de son label), ni trait `Nuée`. Les créatures importées (frenchy / Zoo Impérial)
arrivaient sans cela → toutes dessinées en humanoïdes.

> **Réfs d'art** : illustrations officielles extraites du Zoo Impérial dans `art-ref/zi/`
> (gitignoré, droits Cubicle 7). Script : `python art-ref/_extract_zi.py` (scan par mot-clé →
> `pageNNN_full.png` + `pageNNN_imgK.png`). QC d'un rendu : `npx tsx scripts/_qc-zoo.mts <id,id,…>`
> → `public/qc/zoo.png`.

## Reste à faire

### 1. Gabarit POISSON (nouveau plan `fish`) — Brochet du Stir

`brochet-du-stir` = **brochet géant** (vrai poisson fusiforme, ~3,5 m, jusqu'à 6 m+), nageant à
l'horizontale, mû par une grosse **queue/nageoire caudale** (« Queue mortelle » + Attaque caudale),
gueule à dents (Morsure). Dos gris-verdâtre, ventre clair. Réf art : `art-ref/zi/page039_full.png`
(ZI p.36-38). Aucun des 13 plans n'est un poisson.

À créer (calqué sur la MÉCANIQUE de `serpentine/composeSerpent.ts` — FK/palette/facing — PAS son
art lové) : `src/gameIso/rig/fish/composeFish.ts` (squelette HORIZONTAL : corps fusiforme + pédoncule
+ grande caudale verticale ; nageoires dorsale/pectorales en art ; gueule dentée ; poses godille /
coup de queue / mort sur le flanc), `plans/defs/fish.ts` (1 ligne), champ `fish?: FishProps` dans
`creatures/types.ts` + `FISH_SPECIES` dans `creatures/index.ts` (+ `?? d.fish` dans `speciesScale`),
def `creatures/defs/BrochetDuStir.ts` (`plan:'fish'`). Le label « Brochet du Stir » == nom de def →
auto-routage (pas d'`appearance.species` à poser). `npm run gen` puis QC + goldens `-u`.

### 2. Pièce de catalogue BOIS / CORNES (quadruped + winged)

Le catalogue `quad` (`src/gameIso/rig/quadruped/quadParts.ts`) n'a pas de ramure/cornes. Ces trois
créatures sont déjà routées vers le **bon gabarit** mais rendues **sans leur attribut de tête** :

| Créature (`id`) | Manque | Réf art |
| --- | --- | --- |
| Grand Cerf (`grand-cerf`) | Bois (« 6 à 14 ramifications, perce l'armure », ZI) | `art-ref/zi/page014_full.png` |
| Cornu (`cornu`) | Cornes | `art-ref/zi/page021_full.png` |
| Preyton (`preyton`) | Bois (cerf ailé) | `art-ref/zi/page046_full.png` |

À faire : ajouter une clé optionnelle (`headgear?: 'bois' | 'cornes'`) à `QuadProps`, rendue par
`quadParts` près de l'os tête, puis l'activer sur ces trois defs.

## Résolu (passe juin 2026, source + art ZI)

- **Gabarit CRUSTACÉ** (`src/gameIso/rig/crustace/composeCrab.ts`, plan `crustace`) : carapace large +
  pattes radiales + 2 grosses pinces + yeux pédonculés. Crée pour **Léviathan** (`art-ref/zi/page088`),
  **Il Potente Granchio** (`page088`), **Trégara** (arthropode à pinces, approximé). Les images ont
  tranché : le Léviathan est un **crabe géant**, PAS un serpent de mer.
- **La Bête de l'Oblast** → variante de **Chimère** (ZI p.69-70) → `appearance.species:"Chimère"` (winged).
- **Peau-de-Loup** → **loup-garou** : def biped `perso.head:'chien'` + nu (pelage gris-brun).
- **Choses du Bois Mort** → **humains mutés** (bûcherons, Mutation 3) → reste bipède (correct ; pourrait
  recevoir des features de mutation plus tard).
- **Bugfix** `entityRigProfile` : la résolution d'espèce est désormais **label-aware** (id→label→def,
  comme `resolveByName`) → un record dont l'id (kebab) ≠ le nom de def (libellé) résout enfin vers son
  def (sinon repli Humain → `perso.head`/race perdus). Sans ça, Peau-de-Loup restait un humain.

## Comment traiter (rappel)

- **Router vers un gabarit existant** : `"appearance": { "species": "<NomDef>" }` dans le record
  (`src/data/creatures.json`), `<NomDef>` = `name` d'un def `plan` ≠ `biped`. (Label == nom de def →
  auto-routage, pas d'édition JSON.)
- **Créer un gabarit/def** : `docs/creer-une-creature.md`, puis `npm run gen` + QC (`scripts/_qc-zoo.mts`).
- **Vérifier** : `npx vitest run src/gameIso/rig/golden/` (render + resolution + combat). Toute
  reclassification change les snapshots des créatures concernées → `-u` après contrôle VISUEL, en
  confirmant que le diff est limité aux créatures voulues. Ajouter un nouveau `plan` = l'inscrire aussi
  dans la liste `PLANS`/`PROPS` de `creatures.test.ts` (garde-fou de bonne formation).
