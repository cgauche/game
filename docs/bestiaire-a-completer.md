# Bestiaire — créatures à compléter

Suivi des créatures du bestiaire dont le **rendu** n'est pas (encore) fidèle, pour traitement
ultérieur. Le reste du bestiaire est rendu par son gabarit corporel correct (cf.
`docs/creer-une-creature.md` pour la marche à suivre, et `src/gameIso/rig/creatures/defs/` pour les
defs existantes).

## Contexte

Une créature est rendue **bipède Humain par défaut** (`resolveRender`, `src/gameIso/rig/bodyPlan.ts`)
si elle ne déclare ni espèce mappée à un gabarit non-bipède (`appearance.species` → def avec `plan`
≠ `biped`), ni trait `Nuée`. Les créatures importées (frenchy.bzh, Zoo Impérial) arrivaient sans
`appearance.species` → toutes dessinées en humanoïdes. La passe de juin 2026 en a routé la majorité
vers les bons gabarits (quadruped / avian / winged / serpentine / amorphous) en **réutilisant les
pièces de catalogue existantes** (un def = `name` + `plan` + props ; cf. les defs ZI déjà en place :
`ChatSauvage`, `Stegadon`, `GrandAigle`, `Cockatrice`, etc.).

Restent ci-dessous les cas qui demandent un **nouveau gabarit**, une **nouvelle pièce de catalogue**,
ou une **désambiguïsation** de forme — pas traités pour ne rien **inventer** à l'aveugle.

## 1. Gabarit corporel absent (à créer)

Aucun squelette/plan ne correspond → il faut un nouveau `plan` (cf. les plans existants dans
`src/gameIso/rig/plans/defs/` + leur `compose<X>.ts`), puis router le record via `appearance.species`.

| Créature (`id`) | Forme | Gabarit à créer |
| --- | --- | --- |
| Brochet du Stir (`brochet-du-stir`) | Poisson (brochet géant) | **poisson** (corps fuselé, nageoires, pas de pattes) |
| Il Potente Granchio (`il-potente-granchio`) | Crabe géant | **crustacé** (carapace, pinces, pattes latérales) — `arachnid` est une araignée, pas réutilisable tel quel |

## 2. Forme ambiguë (à trancher avant de router)

Pas assez d'info de forme dans le record/source pour choisir un gabarit sans risque de contresens.
Vérifier la source (ZI / Compagnon) puis router (souvent un simple `appearance.species` vers un
gabarit existant suffira).

| Créature (`id`) | Hésitation |
| --- | --- |
| Léviathan (`leviathan`) | Monstre marin — serpent de mer (`serpentine`) ? baleine ? kraken (`cephalopod`) ? |
| Peau-de-Loup (`peau-de-loup`) | Loup-garou — bipède (humanoïde-loup) **ou** quadrupède (loup) selon l'interprétation |
| Trégara (`tregara`) | Bête grimpante de Taille Grande — forme non décrite clairement |
| La Bête de l'Oblast (`la-bete-de-l-oblast`) | Bête magique du Chaos — forme non décrite clairement |
| Choses du Bois Mort (`choses-du-bois-mort`) | Entités du bois mort corrompu — végétal/treant ? `amorphous` ? essaim ? |

## 3. Pièce de catalogue manquante : bois / cornes (quadruped + winged)

Le catalogue `quad` (`src/gameIso/rig/quadruped/quadParts.ts`) n'a **pas** de ramure/cornes. Les
créatures suivantes sont déjà routées vers le **bon gabarit** (silhouette correcte) mais rendues
**sans leur attribut de tête caractéristique** :

| Créature (`id`) | Manque |
| --- | --- |
| Grand Cerf (`grand-cerf`) | Andouillers (bois de cerf) |
| Cornu (`cornu`) | Cornes |
| Preyton (`preyton`) | Bois (cerf ailé) |

À faire : ajouter une feature `bois` / `cornes` au catalogue quad (clé optionnelle dans `QuadProps`,
rendue par `quadParts`), puis l'activer sur ces defs. Idéalement réutilisable par d'autres cornus.

## Comment traiter (rappel)

- **Router une créature vers un gabarit existant** : ajouter `"appearance": { "species": "<NomDef>" }`
  au record dans `src/data/creatures.json`, où `<NomDef>` est le `name` d'un def `plan` ≠ `biped`.
  (Si le **label** du record == un `name` de def, le routage est automatique — pas besoin d'éditer
  le JSON.)
- **Créer un gabarit/def** : suivre `docs/creer-une-creature.md`. Après ajout d'un def, lancer
  `npm run gen` (régénère `_registry.generated.ts`) puis vérifier le rendu (golden + QC visuel via un
  script `scripts/_qc-*.mts` à la `_qc-quad.mts` / `_qc-bird.mts`).
- **Vérifier** : `npx vitest run src/gameIso/rig/golden/` (render + resolution + combat). Toute
  reclassification change les snapshots des créatures concernées → régénérer (`-u`) après contrôle
  visuel, en confirmant que le diff est limité aux créatures voulues.
