# Atlas des données — `src/data/*.json` (base app-owned)

> Réf VIVANTE. `src/data/*.json` est la **SOURCE app-owned** (commitée, éditable au Compendium). Cet
> atlas répond à trois questions AVANT d'ajouter/curer une donnée : **où vit chaque concept**, **quelles
> conventions de champs**, **qu'est-ce qui existe déjà**. Procédure pas-à-pas : `docs/ajouter-une-donnee.md`
> (skill `ajouter-une-donnee`). Complétude verrouillée par `src/data/data-atlas-complete.test.ts` (tout
> fichier doit être cartographié ici) ; chemins vérifiés par `npm run docs:check`.

## §A — Carte : où va chaque donnée

**Règle d'or** : une table que le livre range sous « **Machines de guerre / véhicules / navires** » n'est
JAMAIS un *trapping* (équipement porté). Elle va dans le fichier de son sous-système (`mass-battle.json`,
`vehicles.json`, `naval-traits.json`…). Corollaire : un même nom peut désigner plusieurs concepts
distincts dans plusieurs fichiers — voir §D (pièges d'homonymes).

### Personnage — fiche & progression
| Fichier | Contient |
|---|---|
| `characteristics.json` | Caractéristiques (CC, CT, F… + méta) |
| `skills.json` | Compétences (+ `specs` de spécialisation) |
| `talents.json` | Talents |
| `traits.json` | Traits (créature ET joueur ; `capabilities`/`passive`/`effects`) |
| `careers.json` | Carrières |
| `careerLevels.json` | Les 4 niveaux de chaque carrière (compétences/talents/possessions gagnés) |
| `classes.json` | Classes (regroupements de carrières) |
| `species.json` | Espèces jouables + variantes régionales |
| `speciesRace.json` | Mapping espèce → race de rig (`default` + `rules`) |
| `groups.json` | Groupes de races/familles (clé des `specs` de compétence/talent) |
| `advancementCosts.json` | Coût d'XP par palier (caractéristique/compétence) |
| `pregens.json` | Personnages prétirés |
| `names.json` | Générateur de noms par espèce |
| `details.json` | Détails physiques aléatoires (âge, taille, textes) |
| `eyes.json` · `hairs.json` | Couleurs d'yeux / de cheveux (tirage) |

### Magie & religion
| Fichier | Contient |
|---|---|
| `spells.json` | Sorts, bénédictions, miracles (`effects`) |
| `domains.json` | Domaines de magie (Vents) |
| `gods.json` | Dieux (bénédictions/miracles rattachés) |
| `miscast.json` | Tables d'Incident magique (`minor`/`major`/`wrath`) |
| `breath-types.json` | Types de Souffle (feu, froid, corrosif…) |

### Combat & résolution
| Fichier | Contient |
|---|---|
| `qualities.json` | Atouts/défauts d'arme & armure (`belier`, `siege`… = la QUALITÉ, pas l'arme) |
| `qualityTypes.json` · `qualitySubtypes.json` | atout/defaut · arme/armure/objet |
| `weaponGroups.json` | Groupes d'armes (Base, Escrime, Parade…) |
| `maneuvers.json` | Manœuvres (attaques spéciales : morsure, souffle…) |
| `criticals.json` · `aa-criticals.json` | Blessures critiques par localisation (base · variante *Aux Armes*) |
| `localisation.json` | Tables de localisation d100 (`personnage`/`navire`/`navire-fluvial`) |
| `grapple.json` | Lutte / empoignade |
| `damage-types.json` | Types de dégâts (poison, feu, électrique) |
| `sizes.json` · `encumbranceTiers.json` | Modif. de Taille au tir · paliers d'Encombrement |
| `etats.json` | États / Conditions (À terre, Aveuglé…) |
| `psychology.json` | États psychologiques (Peur, Terreur, Frénésie…) |
| `structures.json` · `structure-criticals.json` | Structures/portes (cibles de siège) · leurs critiques |
| `mass-battle.json` | ⚠ **Objet à sous-catalogues** (`powerEstimate`, `mightModifiers`, **`warMachines`** ← le Bélier de siège ICI, `structures`, `hazards`) : bataille de masse |

### Santé — blessures, maladies, corruption
| Fichier | Contient |
|---|---|
| `traumas.json` | Traumatismes / séquelles (`ops`) |
| `maladies.json` · `symptoms.json` | Maladies · leurs symptômes |
| `mutations.json` · `mutationTables.json` | Mutations du Chaos · tables d100 de mutation |
| `water-exposure.json` | Exposition à l'eau (noyade, maladies) |
| `obsessions.json` · `drunkenness.json` | Obsessions (table) · ivresse (table) |
| `night-stakes.json` | Enjeu VERBATIM par `kind` d'étape de la cascade de nuit (#331) — ce que l'échec coûte, lu par `nightStake` (`src/state/restFlow.ts`) |

### Objets & équipement
| Fichier | Contient |
|---|---|
| `trappings.json` | **Équipement PORTÉ** : armes, armures, objets tenus/portés. ⚠ **PAS** les machines de guerre. |
| `disponibilite.json` | Tables numériques de « Faire son marché » (LDB 59) : `dispoPct` (% de Disponibilité par taille de colonie) + `barterRatios` (RATIOS DE TROC) — consommées par `src/engine/disponibilite.ts` (`DISPO_PCT`/`BARTER_RATIOS`) |

### Bestiaire
| Fichier | Contient |
|---|---|
| `creatures.json` | Bestiaire / PNJ (statblocs : `char`, `traits`, `skills`, `spells`, `trappings`…) |

### Monde, voyage terrestre & temps
| Fichier | Contient |
|---|---|
| `locations.json` | Lieux / régions (hiérarchie `parent`) |
| `weather.json` | Saisons / météo terrestre |
| `calendarMonths.json` · `calendarWeekdays.json` · `calendarIntercalary.json` · `calendarPhases.json` | Calendrier impérial |
| `stars.json` · `astrology.json` | Signes astraux · Demeures astrologiques |
| `montures.json` · `incidents-monture.json` | Montures · incidents de monture |
| `vehicles.json` | Véhicules (diligence, barge, **navires** — porte des réfs de `naval-traits` par id) |
| `problemes-vehicule.json` · `driving-mishap.json` | Pannes de véhicule · maladresse de conduite |
| `land-cargo.json` | Cargaison terrestre (commerce) |
| `tavernGames.json` | Jeux de taverne |

### Naval & fluvial (*Mer des Griffes* · *Mort sur le Reik*)
| Fichier | Contient |
|---|---|
| `naval-traits.json` | ⚠ **Tableau mixte** (`kind`: trait/amelioration) des Traits & Améliorations de navire — le **Bélier de proue** (`ram`) ICI |
| `naval-ports.json` | Index des ports de la Mer des Griffes (MDG ch.15 l.439-506) — catalogue par id, consommé PAR RÉFÉRENCE (`MapPlace.port.ref`) depuis la carte du monde |
| `lieux-services.json` | Vocabulaire des SERVICES de lieu EXTENSIBLES (#343 — auberge/temple/forgeron/guilde…) au-delà du port/marché, consommé PAR RÉFÉRENCE (`MapPlace.services[].kind`) et résolu par `placeServices` — id/label/icône de routage du hub de lieu, app-owned |
| `naval-progression.json` | Progression navale (modes/vitesse) |
| `ship-construction.json` · `ship-criticals.json` | Construction de navire · critiques de navire |
| `crew-roles.json` · `crew-morale.json` · `crew-test-types.json` | Rôles d'équipage · moral · types de Test d'équipage |
| `sea-navigation.json` · `sea-perils.json` · `sea-events.json` · `sea-weather.json` · `sea-cargo.json` | Navigation · périls · événements · météo · cargaison maritimes |
| `sea-shanties.json` | Chants de marins (`crewOps`) |
| `steam-breakdown.json` | Pannes de navire à vapeur |
| `river-navigation.json` · `river-perils.json` · `river-criticals.json` | Navigation · périls · critiques fluviaux |

### Contenu de campagne / interlude / rencontres
| Fichier | Contient |
|---|---|
| `activities.json` | Activités d'interlude / entre-aventures |
| `interludeEvents.json` | Événements d'interlude (fourchettes d100) |
| `rencontres-edoc.json` | Rencontres EDOC (tables) |
| `peripeties.json` · `oups.json` | Péripéties de voyage · « Oups ! » (fourchettes) |

### Rendu / apparence / décor (NON-règles)
| Fichier | Contient |
|---|---|
| `raceAppearance.json` | Apparence par race (gabarit, palette, tenue) — rig |
| `structureAppearance.json` | Apparence de structure (murs, portes) |
| `props.json` | Props de décor (feu de camp, brasero…) |
| `decorPalette.json` | Palette de couleurs de décor |
| `reliefMaterials.json` · `roofMaterials.json` | Matériaux de relief · de toit |
| `ambiance.json` · `lightLevels.json` | Ambiance lumineuse (`iso`/`pov`) · niveaux de lumière |

### Méta
| Fichier | Contient |
|---|---|
| `books.json` | **Registre des livres sources** — le champ `abr` est l'abréviation CANONIQUE (voir §B) |
| `primitives.manifest.json` · `systemes.manifest.json` | Manifestes TOOLING (#298, vocabulaire app-interne, pas RAW) — sources de `docs/systemes.md` (`npm run docs:systemes`, `scripts/docs/build-systemes.mjs`) |

## §B — Conventions de champs (à respecter à l'ajout)

- **`source.book`** = l'`id` STABLE d'un livre de `src/data/books.json` (slug neutre, ex.
  `livre-de-base`, `archives-de-l-empire-2`, `mer-des-griffes`) — **jamais** l'abréviation d'affichage ni
  le libellé. Relation **id-pure** (i18n-safe) : `books.json` est la source de vérité, **enforced** par
  `src/data/book-source-integrity.test.ts` (tout `source.book` ∈ ids de livres). L'affichage résout
  id→`abr` via `bookAbr` (choke-point `registry.ts` `src()`). Pour un ajout : copier l'`id` d'une entrée
  voisine du même livre (`grep '"book"' <fichier>`), ou le lire dans `books.json`. Contenu fan
  communautaire = livre `frenchy-bzh`.
- **`source.page`** = la **page IMPRIMÉE du livre** (le folio), comme la donnée existante (ex. LDB « À
  Enroulement » = folio 297, AA « Cimeterre » = folio 91). Pour l'obtenir : trouve ton contenu dans le
  `.md` du livre (`docs/sources-vf.md` → dossier `Source/`), puis lis le **`data-folio="N"`** de l'ancre
  `<span id="page-… data-folio="N">` la plus proche AU-DESSUS de ton contenu — **`N` = la valeur de
  `source.page`**. ⚠ Le NUMÉRO du span-id seul (`page-89`) est l'**index PDF**, PAS le folio (c'est le
  piège de #148) — toujours lire `data-folio`. **Tous les livres de règles autorisés** ont `data-folio`
  baké et les ancres nues (sans folio) retirées — étiquetés (LDB, ADE I/II, EDOC, Middenheim, NADJ, ACE,
  PDT) comme scans (AA, ZI, MDG, EDO, MSR, MSRC) ; le `00 - Index.md` de chaque livre liste ses chapitres
  avec leur folio de début.
- **`desc`** et tout champ de prose (effet, règles) = **copié/collé VERBATIM** de la source, en **Markdown**
  (`**gras**`, `*ital*`, listes `-`), jamais en HTML, jamais reformulé (règle stricte 5 ; garde
  `src/data/no-html-in-prose.test.ts`).
- **Formes de champ** = copiées des entrées voisines (`damage:{plusBF,flat}`, `qualities:[{id}]`,
  `passive: GameOp[]`…). Toute logique est keyée par **id stable** ; le `label` est de l'affichage.
- **Forme du fichier** : la plupart sont des tableaux plats d'entrées `{id,label,…}`, mais certains sont des
  **objets à sous-catalogues** (`mass-battle.json`, `sea-*.json`, `criticals.json`…) ou des **tables d100
  par fourchette** — lire la structure existante avant d'ajouter (cf. §A).
- **Canonicalisation** : après édition manuelle, le fichier doit être **byte-identique** au round-trip de
  `serializeDataset` (`src/data/serialize.ts`), verrouillé par `src/data/serialize.test.ts` (2 espaces,
  **aucun** newline final). L'éditeur Codex l'applique à la sauvegarde ; en édition manuelle, ne **jamais**
  reformater à la main ni via un `JSON.stringify` maison — passer par `serializeDataset`.

## §C — CHECK-FIRST (avant tout ajout — anti-doublon)

Le concept existe peut-être **déjà**, dans un AUTRE sous-système (incident #148 : le Bélier vit dans 6
fichiers). Avant d'ajouter :

```
grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json
```

Si l'élément (ou un synonyme) existe → NE PAS dupliquer : l'étendre là où il vit, ou re-scoper la tâche.
Puis choisir le fichier via §A. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats.

## §D — Pièges d'homonymes (un mot ≠ un concept)

Les lookups sont **scopés par catalogue** (`findQualityById`/`findSpellById`/…), donc des homonymes
coexistent LÉGITIMEMENT. `src/data/id-collisions.test.ts` verrouille l'ensemble connu (`KNOWN_CROSS`). Cas
travaillé — **« Bélier »** = 6 concepts DISTINCTS :

| Fichier | Ce que « Bélier » y est |
|---|---|
| `qualities.json` | Qualité d'arme brise-porte (ADE II) — lue par `capabilities.ram` (dégâts aux portes) |
| `mass-battle.json` (`warMachines`) | Machine de guerre de siège (crew 6, Siège) |
| `naval-traits.json` | Amélioration « Bélier de proue » (`ram{ic,ap}`, MDG) — lue par `belierRam`, collision navale |
| `spells.json` | Sort « Bélier » |
| `vehicles.json` | **Référence** par id au trait naval (pas une redéfinition) |
| `creatures.json` | Réfs de qualité/manœuvre sur des créatures |

Leçon : deux mécaniques « ram » homonymes (brise-porte ADE II ↔ collision MDG) sont du **code séparé,
sourcé, testé** — pas un doublon. Un nom partagé n'autorise JAMAIS à fusionner ni à dupliquer : vérifier
le CONCEPT (§C), pas le mot.

## §E-bis — Contrat de schéma (`src/data/schemas/`)

Chaque `src/data/*.json` valide contre un schéma zod **STRICT** — le contrat de donnée (Lot 1,
94/94 datasets sous contrat). Trois pièces :

- **`src/data/schemas/defs/<nom>.ts`** — 1 def PAR dataset (même basename que le `.json`), exporte
  `file` (le nom de fichier) et `schema` (`z.ZodTypeAny`, racine = la forme EXACTE du JSON — tableau
  ou objet à sous-catalogues). `characteristics.ts` est l'EXEMPLAIRE de la convention. Champs de
  référence commun (`source.book`/`source.page`) : `sourceRefSchema` (`src/data/schemas/common.ts`).
- **`src/data/schemas/_registry.generated.ts`** — GÉNÉRÉ par `node scripts/gen-registry.mjs`
  (`npm run gen`), scanne `defs/` et exporte `SCHEMA_DEFS: SchemaDef[]`. Ne JAMAIS éditer à la main.
- **`PENDING`** dans `src/data/schema-contract.test.ts` — la liste des `.json` encore sans schéma.
  **Vide** depuis la fin de la migration : tout nouveau dataset naît AVEC son def, jamais en PENDING
  transitoire.

**Portes qui font respecter le contrat :**
- `src/data/schema-contract.test.ts` (CI/`npm test`) : (a) chaque dataset de `SCHEMA_DEFS` valide
  son JSON réel, (b) EXHAUSTIVITÉ (tout `.json` est registré ou dans `PENDING`), (c) CLIQUET
  (`PENDING` ne peut pas contenir un fichier déjà schématisé).
- `scripts/guards/validate-data.mts` (pre-commit, `scripts/git-hooks/pre-commit.mjs`) : sur les
  `.json` STAGÉS, reparse et revalide contre `SCHEMA_DEFS` (Node/tsx, hors Vitest) ; un fichier sans
  schéma enregistré est ignoré silencieusement (ne peut pas arriver hors PENDING, cf. ci-dessus).

**Geste « ajouter un dataset »** : créer le `.json` **et** `src/data/schemas/defs/<nom>.ts` dans le
même commit, puis `npm run gen` (régénère `_registry.generated.ts`) — sinon la garde EXHAUSTIVITÉ
échoue (orphelin ni registré ni PENDING).

## §E-ter — Les deux espaces de clés « race » (species ⇄ rig)

Deux conventions de nommage de race coexistent, **par dessein**, DÉCOUPLÉES :

- **espace « données de personnage »** (`species.refChar`/`species.refCareer`, ex. `Haut Elfe`, `Elfe
  Sylvain`) — clé de `names.json`, `careers.json`, `eyes.json`, `hairs.json`, `details.json`.
- **espace « rig »** (id d'apparence, sûr pour nom de fichier, ex. `Haut-Elfe`, `Elfe sylvain`) — id
  de `raceAppearance.json` et des defs de `src/gameIso/rig/`.

`speciesRace.json` (consommé via `baseSpeciesOf`) est le **pont UNIQUE** species→rig — 5 des 7 races
jouables sont identiques d'un espace à l'autre, seuls les elfes divergent par tiret/casse ; ce
découplage est **intentionnel** (unifier les deux espaces casserait l'un des deux clans, chacun avec
ses dizaines de fichiers). Garde : `src/data/names-species-keyspaces.test.ts` — échoue si `names.json`
dérive hors de l'espace `refChar`, si le pont species→rig cesse d'être 1:1, ou si une clé d'un espace
se met à ressembler à une clé de l'autre sans être le couple ponté sanctionné.

## §F — À COLLER DANS UN BRIEF D'AGENT « DONNÉE »

> Tu vas ajouter/curer une entrée dans `src/data/*.json`. Discipline OBLIGATOIRE :
> 1. **CHECK-FIRST** : `grep -rniE '<id>|<label>|<concept>' src/data/*.json`. Le concept vit peut-être
>    déjà dans un autre sous-système (ex. #148 : le Bélier est dans 6 fichiers). S'il existe → ne duplique
>    pas, étends-le ou re-scope.
> 2. **Bon fichier** via `docs/donnees.md` §A. Une « machine de guerre / véhicule / navire » n'est pas un
>    `trappings`. Si c'est un **sort / une créature / un effet mécanique / une icône / un livre** → utilise
>    le skill de domaine dédié (`ajouter-un-sort`/`creer-une-creature`/`ajouter-une-mecanique`/…).
> 3. **Chaque champ = Source RAW ⊕ voisins** : lis le **tableau ET son en-tête** au `Source/` (FR only ;
>    ne confonds pas une colonne « Équipe » avec « Encombrement »). `book` = `abr` de `books.json` ;
>    `page` = vraie page ; `desc` = verbatim Markdown ; formes copiées des voisins.
> 4. **Zéro invention, zéro inflexion RAW silencieuse** : un champ introuvable → omission assumée ; une
>    mécanique RAW non modélisable → **issue au gabarit #101+** ou valeur `maison` taguée, JAMAIS « hors
>    scope ».
> 5. **Vérifie** : canonicaliser via `serializeDataset`, puis `npm test` + `npm run typecheck` verts ;
>    recette navigateur si l'élément est visible au Codex/éditeur.
