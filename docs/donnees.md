# Atlas des données — `src/data/*.json` (base app-owned)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-donnees.mjs` (`npm run docs:donnees`) — NE PAS ÉDITER À LA MAIN.
> Source éditoriale (rangement par rubrique, description, règle d'or, pièges d'homonymes) :
> `src/data/donnees.manifest.json`. La liste des fichiers, leur nombre d'entrées et la présence d'un
> schéma sont CALCULÉS de l'arbre réel — jamais périmés : re-générer après tout ajout/retrait de
> `src/data/*.json`.

> Réf VIVANTE. `src/data/*.json` est la **SOURCE app-owned** (commitée, éditable au Compendium). Cet
> atlas répond à trois questions AVANT d'ajouter/curer une donnée : **où vit chaque concept**, **quelles
> conventions de champs**, **qu'est-ce qui existe déjà**. Procédure pas-à-pas : `docs/ajouter-une-donnee.md`
> (skill `ajouter-une-donnee`). Complétude verrouillée par `src/data/data-atlas-complete.test.ts` (tout
> fichier doit être cartographié ici) ; chemins vérifiés par `npm run docs:check`.

**Périmètre mesuré et angles morts** — la carte §A vient du manifeste ÉDITORIAL
`src/data/donnees.manifest.json` (rangement par rubrique, description, homonymes) : rien de tout cela
ne se devine de l'arbre, un jugement humain reste nécessaire. Ce que ce générateur CALCULE et
réfute au besoin : (1) bijection stricte manifeste ⇄ `113` fichiers réels de
`src/data/*.json` (un `.json` neuf non cartographié, ou une entrée de manifeste pointant sur un
fichier disparu, casse la génération) ; (2) nombre d'entrées par fichier (comptage `Array.isArray`,
`objet à sous-catalogues` sinon — angle mort assumé : cette étiquette ne dit RIEN du contenu réel
d'un objet à sous-catalogues, juste qu'il n'est pas un tableau plat) ; (3) couverture du contrat de
schéma zod (`113/113`, cf. §E-bis) ; (4) présence effective sur disque de
chaque fichier cité par un cas d'homonyme de §D. Angle mort déclaré : les DESCRIPTIONS de rubrique,
de fichier et d'homonyme restent du texte manuscrit du manifeste — ce générateur ne les vérifie PAS
contre le contenu réel des `.json` (une description qui ment sur ce que porte un fichier ne casse
pas la génération) ; seule la complétude de la CARTE (quel fichier existe, où il est rangé) est
garantie, pas la justesse de sa glose.

## §A — Carte : où va chaque donnée

**Règle d'or** : Une table que le livre range sous « **Machines de guerre / véhicules / navires** » n'est JAMAIS un *trapping* (équipement porté). Elle va dans le fichier de son sous-système (`mass-battle.json`, `vehicles.json`, `naval-traits.json`…). Corollaire : un même nom peut désigner plusieurs concepts distincts dans plusieurs fichiers — voir §D (pièges d'homonymes).

### Personnage — fiche & progression
| Fichier | Contient |
|---|---|
| `characteristics.json` | Caractéristiques (CC, CT, F… + méta) (19 entrée(s)) |
| `skills.json` | Compétences (+ `specs` de spécialisation) (48 entrée(s)) |
| `talents.json` | Talents (187 entrée(s)) |
| `traits.json` | Traits (créature ET joueur ; `capabilities`/`passive`/`effects`) (130 entrée(s)) |
| `careers.json` | Carrières (108 entrée(s)) |
| `careerLevels.json` | Les 4 niveaux de chaque carrière (compétences/talents/possessions gagnés) (432 entrée(s)) |
| `progression-schemas.derived.json` | GÉNÉRÉ (`python scripts/data/gen-progression-schemas.py`) — le schéma de progression (marque → Caractéristique, par niveau) LU dans les PDF de `Source/` : vérité dérivée contre laquelle `scripts/guards/lib/progressionSchemas.mjs` confronte le `characteristics` de `careerLevels.json`. Ne pas éditer à la main. (objet à sous-catalogues) |
| `classes.json` | Classes (regroupements de carrières) (9 entrée(s)) |
| `species.json` | Espèces jouables + variantes régionales (27 entrée(s)) |
| `speciesRace.json` | Mapping espèce → race de rig (`default` + `rules`) (objet à sous-catalogues) |
| `groups.json` | Groupes de races/familles (clé des `specs` de compétence/talent) (38 entrée(s)) |
| `advancementCosts.json` | Coût d'XP par palier (caractéristique/compétence) (15 entrée(s)) |
| `pregens.json` | Personnages prétirés (8 entrée(s)) |
| `names.json` | Générateur de noms par espèce (objet à sous-catalogues) |
| `details.json` | Détails physiques aléatoires (âge, taille, textes) (objet à sous-catalogues) |
| `eyes.json` · `hairs.json` | Couleurs d'yeux / de cheveux (tirage) (10 entrée(s) · 10 entrée(s)) |
| `axes.json` | Axes de forces/faiblesses (#409, mécanique MAISON) — socle de base + exemples de scénario, `derivation` en ids de `skills.json`/`talents.json` ; moteur `src/engine/axes.ts` (9 entrée(s)) |

### Magie & religion
| Fichier | Contient |
|---|---|
| `spells.json` | Sorts, bénédictions, miracles (`effects`) (576 entrée(s)) |
| `domains.json` | Domaines de magie (Vents) (20 entrée(s)) |
| `gods.json` | Dieux (bénédictions/miracles rattachés) (41 entrée(s)) |
| `miscast.json` | Tables d'Incident magique (`minor`/`major`/`wrath`) (objet à sous-catalogues) |
| `breath-types.json` | Types de Souffle (feu, froid, corrosif…) (6 entrée(s)) |
| `vents-tourbillonnants.json` | Table d10 de force des Vents (option `vents-tourbillonnants`, LDB 46 l.179-190) (objet à sous-catalogues) |
| `arcane-phenomena.json` | Magie ENVIRONNEMENTALE (VDM 14, folios 189-199) : paliers de Saturation, Effets de Saturation par Vent, phénomènes arcaniques (lignes de force, pierres gardiennes, Grand Vortex, nexus, appuis arcaniques, Tempête de Magie, Corruption), tables de Corruption chaotique/nécromantique et de Flux magique — option `magic-vdm-environnementale` (objet à sous-catalogues) |

### Combat & résolution
| Fichier | Contient |
|---|---|
| `qualities.json` | Atouts/défauts d'arme & armure (`belier`, `siege`… = la QUALITÉ, pas l'arme) (59 entrée(s)) |
| `qualityTypes.json` · `qualitySubtypes.json` | atout/defaut · arme/armure/objet (2 entrée(s) · 3 entrée(s)) |
| `weaponGroups.json` | Groupes d'armes (Base, Escrime, Parade…) (38 entrée(s)) |
| `maneuvers.json` | Manœuvres (attaques spéciales : morsure, souffle…) (20 entrée(s)) |
| `criticals.json` · `aa-criticals.json` | Blessures critiques par localisation (base · variante *Aux Armes*) (objet à sous-catalogues · objet à sous-catalogues) |
| `localisation.json` | Tables de localisation d100 (`personnage`/`navire`/`navire-fluvial`) (objet à sous-catalogues) |
| `tables.json` | Tables d'effets `[min,max] → GameOp[]` référencées par l'op `rollTable` (`tableId`) — Tableau des aspects démoniaques (Allure démoniaque, EDOC 13) par Domaine du Chaos (20 entrée(s)) |
| `grapple.json` | Lutte / empoignade (objet à sous-catalogues) |
| `regles.json` | Procédures / options de jeu au texte VERBATIM (Sombre Pacte, modes d'attaque/défense, Empoignade, Focalisation étendue, Ragot au marché…) — routées en tooltip `CodexRef` (catégorie Codex `regles`), jamais une paraphrase de règle (#392) (67 entrée(s)) |
| `damage-types.json` | Types de dégâts (poison, feu, électrique) (4 entrée(s)) |
| `sizes.json` · `encumbranceTiers.json` | Modif. de Taille au tir · paliers d'Encombrement (objet à sous-catalogues · 4 entrée(s)) |
| `etats.json` | États / Conditions (À terre, Aveuglé…) (20 entrée(s)) |
| `psychology.json` | États psychologiques (Peur, Terreur, Frénésie…) (9 entrée(s)) |
| `structures.json` · `structure-criticals.json` | Structures/portes (cibles de siège) · leurs critiques (24 entrée(s) · objet à sous-catalogues) |
| `artillery-misfire.json` | Incidents de Tir d'Artillerie par Salve (AA 10 l.270-277) — arme d'équipe à Atout Salve qui subit un Incident de tir (objet à sous-catalogues) |
| `mass-battle.json` | **ATTENTION — Objet à sous-catalogues** (`powerEstimate`, `mightModifiers`, **`warMachines`** ← le Bélier de siège ICI, `structures`, `hazards`) : bataille de masse (objet à sous-catalogues) |

### Santé — blessures, maladies, corruption
| Fichier | Contient |
|---|---|
| `traumas.json` | Traumatismes / séquelles (`ops`) (29 entrée(s)) |
| `maladies.json` · `symptoms.json` | Maladies · leurs symptômes (16 entrée(s) · 18 entrée(s)) |
| `mutations.json` · `mutationTables.json` | Mutations du Chaos · tables d100 de mutation (116 entrée(s) · 17 entrée(s)) |
| `water-exposure.json` | Exposition à l'eau (noyade, maladies) (objet à sous-catalogues) |
| `obsessions.json` · `drunkenness.json` | Obsessions (table) · ivresse (table) (objet à sous-catalogues · objet à sous-catalogues) |
| `night-stakes.json` | Enjeu VERBATIM par `kind` d'étape de la cascade de nuit (#331) — ce que l'échec coûte, lu par `nightStake` (`src/state/restFlow.ts`) (15 entrée(s)) |
| `voyage-stakes.json` | Enjeu par `kind` d'étape de cascade de VOYAGE (#1117) — GABARIT de descripteur mécanique dont les trous `{nom}` reçoivent les valeurs calculées du flux, lu par `voyageStake` (`src/data/index.ts`) (33 entrée(s)) |
| `flow-stakes.json` | Enjeu d'un JET DE MODALE MONO (#1117), keyé par l'id de jet `{flow, phase}` — descripteur mécanique + foyer de règle (entité porteuse) ou catégorie de l'entrée jouée, lu par `flowStakeRef`/`resolveStake` (`src/data/index.ts`) (31 entrée(s)) |

### Objets & équipement
| Fichier | Contient |
|---|---|
| `trappings.json` | **Équipement PORTÉ** : armes, armures, objets tenus/portés. **ATTENTION — PAS** les machines de guerre. (440 entrée(s)) |
| `disponibilite.json` | Tables numériques de « Faire son marché » (LDB 59) : `dispoPct` (% de Disponibilité par taille de colonie) + `barterRatios` (RATIOS DE TROC) — consommées par `src/engine/disponibilite.ts` (`DISPO_PCT`/`BARTER_RATIOS`) (objet à sous-catalogues) |

### Bestiaire
| Fichier | Contient |
|---|---|
| `creatures.json` | Bestiaire / PNJ (statblocs : `char`, `traits`, `skills`, `spells`, `trappings`…) (490 entrée(s)) |

### Monde, voyage terrestre & temps
| Fichier | Contient |
|---|---|
| `locations.json` | Lieux / régions (hiérarchie `parent`) (55 entrée(s)) |
| `weather.json` | Saisons / météo terrestre (objet à sous-catalogues) |
| `calendarMonths.json` · `calendarWeekdays.json` · `calendarIntercalary.json` · `calendarPhases.json` | Calendrier impérial (12 entrée(s) · 8 entrée(s) · 6 entrée(s) · 7 entrée(s)) |
| `stars.json` · `astrology.json` | Signes astraux · Demeures astrologiques (23 entrée(s) · 5 entrée(s)) |
| `montures.json` · `incidents-monture.json` | Montures · incidents de monture (objet à sous-catalogues · objet à sous-catalogues) |
| `vehicles.json` | Véhicules (diligence, barge, **navires** — porte des réfs de `naval-traits` par id) (31 entrée(s)) |
| `problemes-vehicule.json` · `driving-mishap.json` | Pannes de véhicule · maladresse de conduite (objet à sous-catalogues · objet à sous-catalogues) |
| `land-cargo.json` | Cargaison terrestre (commerce) (objet à sous-catalogues) |
| `tavernGames.json` | Jeux de taverne (11 entrée(s)) |
| `merchants.json` | Archétypes de marchand (#2) — catalogue par familles `category.types`/`subTypes`, Disponibilité/Statut/`unitKinds` (bêtes/véhicules vendus, dérivés de `creatures`/`vehicles` à facette `purchase`) ; aucun archétype en dur dans le code, `MERCHANTS`/`MERCHANT_ARCHETYPES` (`state/merchants/index.ts`) réexportent ce registre (6 entrée(s)) |
| `merchantFamilies.json` | Familles de PRÉSENTATION du stock marchand (onglets `ui/MerchantPanel.tsx`) — ordre d'affichage, règle de classement `match` (unit/shield/trappingType/fallback) et `columns` de stats à afficher, résolues contre le registre fixe `MERCHANT_COL_RENDERERS` (7 entrée(s)) |

### Naval & fluvial (*Mer des Griffes* · *Mort sur le Reik*)
| Fichier | Contient |
|---|---|
| `naval-traits.json` | **ATTENTION — Tableau mixte** (`kind`: trait/amelioration) des Traits & Améliorations de navire — le **Bélier de proue** (`ram`) ICI (26 entrée(s)) |
| `naval-ports.json` | Index des ports de la Mer des Griffes (MDG 15 l.439-506) — catalogue par id, consommé PAR RÉFÉRENCE (`MapPlace.port.ref`) depuis la carte du monde (39 entrée(s)) |
| `lieux-services.json` | Vocabulaire des SERVICES de lieu EXTENSIBLES (#343 — auberge/temple/forgeron/guilde…) au-delà du port/marché, consommé PAR RÉFÉRENCE (`MapPlace.services[].kind`) et résolu par `placeServices` — id/label/icône de routage du hub de lieu, app-owned (7 entrée(s)) |
| `naval-progression.json` | Progression navale (modes/vitesse) (objet à sous-catalogues) |
| `ship-construction.json` · `ship-criticals.json` | Construction de navire · critiques de navire (objet à sous-catalogues · objet à sous-catalogues) |
| `crew-roles.json` · `crew-morale.json` · `crew-test-types.json` | Rôles d'équipage · moral · types de Test d'équipage (9 entrée(s) · objet à sous-catalogues · objet à sous-catalogues) |
| `sea-navigation.json` · `sea-perils.json` · `sea-events.json` · `sea-weather.json` · `sea-cargo.json` | Navigation · périls · événements · météo · cargaison maritimes (objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues) |
| `sea-shanties.json` | Chants de marins (`crewOps`) (7 entrée(s)) |
| `steam-breakdown.json` | Pannes de navire à vapeur (6 entrée(s)) |
| `river-navigation.json` · `river-perils.json` · `river-criticals.json` | Navigation · périls · critiques fluviaux (objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues) |

### Contenu de campagne / interlude / rencontres
| Fichier | Contient |
|---|---|
| `activities.json` | Activités d'interlude / entre-aventures (62 entrée(s)) |
| `interludeEvents.json` | Événements d'interlude (fourchettes d100) (31 entrée(s)) |
| `rencontres-edoc.json` | Rencontres EDOC (tables) (objet à sous-catalogues) |
| `peripeties.json` · `oups.json` | Péripéties de voyage · « Oups ! » (fourchettes) (10 entrée(s) · 8 entrée(s)) |

Le **bloc `narratif`** d'un paquet de campagne schema 3 (`NarratifBlock`, `src/state/campaignNarratif.ts`, #765) est EMBARQUÉ dans le JSON du projet, jamais dans `src/data` global : ses `narratif.objets` réutilisent le schéma `TrappingData` global (`src/data/index.ts`), et ses `presetsPnj.base` RÉFÉRENCENT une créature globale par id (`findCreatureById`) — jamais une copie.

### Rendu / apparence / décor (NON-règles)
| Fichier | Contient |
|---|---|
| `raceAppearance.json` | Apparence par race (gabarit, palette, tenue) — rig (21 entrée(s)) |
| `structureAppearance.json` | Apparence de structure (murs, portes) (17 entrée(s)) |
| `props.json` | Props de décor (feu de camp, brasero…) (59 entrée(s)) |
| `decorPalette.json` | Palette de couleurs de décor (objet à sous-catalogues) |
| `reliefMaterials.json` · `roofMaterials.json` | Matériaux de relief · de toit (6 entrée(s) · 4 entrée(s)) |
| `ambiance.json` · `lightLevels.json` | Ambiance lumineuse (`iso`/`pov`) · niveaux de lumière (objet à sous-catalogues · 5 entrée(s)) |

### Méta
| Fichier | Contient |
|---|---|
| `books.json` | **Registre des livres sources** — le champ `abr` est l'abréviation CANONIQUE (voir §B) (29 entrée(s)) |
| `primitives.manifest.json` · `systemes.manifest.json` | Manifestes TOOLING (#298, vocabulaire app-interne, pas RAW) — sources de `docs/systemes.md` (`npm run docs:systemes`, `scripts/docs/build-systemes.mjs`) (28 entrée(s) · 16 entrée(s)) |
| `raw.manifest.json` | Manifeste éditorial du champ Implémente de l'Atlas RAW (généré par `scripts/raw/build-implemente.mjs`, #487) : par topic, ticket de dette ou raison de blocage — la SEULE surface écrite à la main du champ (8 entrée(s)) |
| `donnees.manifest.json` | Manifeste éditorial de cet atlas (#903, rangement par rubrique, description, règle d'or, pièges d'homonymes) — source de `docs/donnees.md` (`npm run docs:donnees`, `scripts/docs/build-donnees.mjs`) (objet à sous-catalogues) |

## §B — Conventions de champs (à respecter à l'ajout)

- **`source.book`** = l'`id` STABLE d'un livre de `src/data/books.json` (slug neutre, ex.
  `livre-de-base`, `archives-de-l-empire-2`, `mer-des-griffes`) — **jamais** l'abréviation d'affichage ni
  le libellé. Relation **id-pure** (i18n-safe) : `books.json` est la source de vérité, **enforced** par
  `src/data/book-source-integrity.test.ts` (tout `source.book` ∈ ids de livres). L'affichage résout
  id→`abr` via `bookAbr` (choke-point `registry.ts` `src()`). Pour un ajout : copier l'`id` d'une entrée
  voisine du même livre (`grep '"book"' <fichier>`), ou le lire dans `books.json`. Contenu fan
  communautaire = livre `frenchy-bzh`.
- **`source.page`** = la **page IMPRIMÉE du livre** (le folio), comme la donnée existante (ex. LDB « À
  Enroulement » = folio 297, AA « Cimeterre » = folio 90 — sa `desc`, règle 5 ; la ligne de stats
  du Cimeterre, folio 91, va en `alsoIn`, cf. plus bas). Pour l'obtenir : trouve ton contenu dans le
  `.md` du livre (`docs/sources-vf.md` → dossier `Source/`), puis lis le **`data-folio="N"`** de l'ancre
  `<span id="page-… data-folio="N">` la plus proche AU-DESSUS de ton contenu — **`N` = la valeur de
  `source.page`**. ⚠ Le NUMÉRO du span-id seul (`page-89`) est l'**index PDF**, PAS le folio (c'est le
  piège de #148) — toujours lire `data-folio`. **Tous les livres de règles autorisés** ont `data-folio`
  baké et les ancres nues (sans folio) retirées — étiquetés (LDB, ADE I/II, EDOC, Middenheim, NADJ, ACE,
  PDT) comme scans (AA, ZI, MDG, EDO, MSR, MSRC) ; le `00 - Index.md` de chaque livre liste ses chapitres
  avec leur folio de début.
  **Enforced** (#536) par `src/data/book-source-integrity.test.ts`, volet « intégrité du folio », par DEUX
  voies : (A) **hors-livre** — le folio dépasse le dernier folio ATTESTÉ du livre (`bookMaxFolio` : dernier
  marqueur `data-folio` et dernière page citée par `00 - Index.md`), réfutation qui se passe de la `desc`
  ; (B) **encadrement** — la `desc` étant verbatim (règle 5), elle LOCALISE l'entrée dans le `Source/` du livre
  déclaré, et l'encadrement `data-folio` de l'occurrence réfute le folio qui ment. Défauts fondateurs :
  `redoutable` (ZI) déclarait `page: 11` pour un texte en folio 134 ; `activities.json:duel` déclarait
  `page: 223` dans un ADE II qui compte 98 pages. Mécanique : `scripts/guards/lib/folioIntegrity.mjs` ;
  rapport de solde (donne le folio RÉEL) : `node scripts/data/audit-folios.mjs`.
  ⚠ **Ce que la garde NE voit PAS** — elle ne réfute que ce qu'elle PROUVE et se tait sur le reste : sur les
  2082 entrées citées scannées, 1135 échappent à tout verdict d'encadrement (desc reformulée donc
  introuvable, desc trop courte pour localiser, chapitre sans marqueur, livre sans extraction FR). Une entrée
  neuve à desc NON verbatim et à folio faux mais PLAUSIBLE passe encore : seule la règle 5 la rattrape. Le
  stock n'est donc pas « les défauts du dépôt », c'est « les défauts que ces deux voies prouvent ».
  Si une desc se retrouve sur PLUSIEURS folios (définition ET récapitulatif d'annexe), cite la **DÉFINITION** ;
  le rapport les signale (rubrique « À ARBITRER ») car la garde ne les départage pas.
  **Mode CLIQUET** : le stock de 140 entrées déjà fausses est gelé dans `scripts/guards/lib/folioRatchetStock.mjs`
  et ne peut que DÉCROÎTRE — toute entrée NEUVE au folio réfuté échoue la CI, toute clé soldée qui y traîne
  aussi, et sa TAILLE est plafonnée par la garde (`FOLIO_RATCHET_MAX`) pour qu'« ajouter une ligne au stock »
  ne soit jamais le chemin le plus court. `node scripts/data/audit-folios.mjs --stock` re-rend le stock et
  REFUSE de l'agrandir : l'outil ne sait que solder.
- **`alsoIn?: SecondaryRef[]`** (#563, doctrine user 2026-07-17 : « jamais 2 talents différents ») —
  un même Talent/Trait/Qualité/objet **réimprimé** dans un AUTRE livre (ou un autre folio du même
  livre) reste **UNE entrée** : l'ANCRE (`source`, scalaire, porte la `desc`, règle 5, STRUCTURELLE —
  jamais un tableau positionnel) + `alsoIn` porte les emplacements SECONDAIRES, chacun une paire
  `(book, page)` pleine + un `quote?` authoré (auto-attestation verbatim, pour le cas où le `label`
  n'apparaît pas tel quel au folio déclaré — ex. une TABLE imprime un nom différent). Accessors SOURCE
  UNIQUE : `allLocations(entry)`/`sourceBooks(entry)` (`src/data/sourceRefs.ts`) — aucun futur lecteur
  n'inline `alsoIn`. **Enforced** par `src/data/secondary-ref-integrity.test.ts` : chaque `alsoIn[i]`
  doit être **auto-attesté** (le `label` du porteur OU son `quote` retrouvé dans le SPAN du folio
  déclaré — charge de la preuve sur l'auteur, jamais une réfutation par absence). Champ posé sur
  `traits.json`/`qualities.json`/`trappings.json`/`spells.json`/`naval-traits.json`
  (`traits.ts`/`qualities.ts`/`trappings.ts`/`spells.ts`/`naval-traits.ts`). Exemple réel — le
  Cimeterre (AA) a sa `desc` en prose folio 90 et sa ligne de stats (tableau des armes) folio 91,
  où le `label` seul ne suffirait pas à distinguer la ligne dans le span sans un `quote` :
  ```json
  {
    "id": "cimeterre",
    "label": "Cimeterre",
    "source": { "book": "aux-armes", "page": 90 },
    "alsoIn": [{ "book": "aux-armes", "page": 91, "quote": "Cimeterre" }]
  }
  ```
  (Lot 2, #563 : 15 entrées migrées — republications identiques et scissions prose/ligne-de-stats.)
- **`variants?: Variant[]`** (#563/#564) — variante RÉGLÉE d'une entrée sous une **règle optionnelle**
  du registre `OPTIONAL_RULES` (`src/engine/policy.ts:43`, lue par `rule(id)`) : `when.rule` DOIT être
  un id du registre (jamais un label, gate fantôme sinon — **enforced** par
  `src/data/variants-integrity.test.ts`), `when.equals` défaut `true` ; `desc`/`source` PROPRES
  portent la règle 5 **par variante** (le walk `citedEntriesOf` de `folioIntegrity.mjs` la découvre
  déjà, structurellement identique à une entrée) ; `combat` réutilise `CombatFeature` tel quel.
  Résolution : `effectiveEntry(entry)` (`src/engine/variants.ts`) — PRIMITIVE UNIQUE, applique la
  première variante active (`activeVariant`) en REPLACE par champ DÉCLARÉ au premier niveau, sinon
  rend la forme LDB de base. Une variante ne peut republier QUE les champs que son dataset **résout**
  effectivement (liste blanche `VARIANT_RESOLVED_FIELDS` de la def, passée à `variantOf` — schéma
  `strictObject`, donc tout autre champ est rejeté au parse ; **enforced** aussi côté donnée par
  `src/data/variants-integrity.test.ts`) : `talents.json` résout `desc`/`source` (Codex
  `src/ui/compendium/registry.ts:1133`), `test` (`talentTestSLBonus`, `src/engine/magic.ts:314`),
  `max` (`talentMaxById`, `src/engine/careerSlots.ts:324`) et `combat` (`featuresOf`/`castingKindOf`,
  `src/engine/combatFeatures/dispatch.ts:59`/`:17`) ; `traits.json` ne résout que `desc`/`source`
  (`src/ui/compendium/registry.ts:483`). `passive` et `effects` en sont EXCLUS — le moteur les lit sur
  l'entrée brute (`src/engine/talentEffects.ts`, `src/engine/traits/dispatch.ts`) ; un champ n'entre
  dans la liste qu'une fois son consommateur routé par `effectiveEntry`. `careers`/`skills`/`spells`
  n'admettent aucune variante (aucun consommateur `effectiveEntry`). Champ posé sur `talents.json` —
  11 talents d'Aux Armes Annexe III.
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

Les lookups sont **scopés par catalogue** (`findQualityById`/`findSpellById`/…), donc des homonymes coexistent LÉGITIMEMENT. `src/data/id-collisions.test.ts` verrouille l'ensemble connu (`KNOWN_CROSS`). Cas travaillé — **« Bélier »** = 6 concepts DISTINCTS :

| Fichier | Ce que « Bélier » y est |
|---|---|
| `qualities.json` | Qualité d'arme brise-porte (ADE II) — lue par `capabilities.ram` (dégâts aux portes) |
| `mass-battle.json` | Machine de guerre de siège (crew 6, Siège) |
| `naval-traits.json` | Amélioration « Bélier de proue » (`ram{ic,ap}`, MDG) — lue par `belierRam`, collision navale |
| `spells.json` | Sort « Bélier » |
| `vehicles.json` | **Référence** par id au trait naval (pas une redéfinition) |
| `creatures.json` | Réfs de qualité/manœuvre sur des créatures |

Deux mécaniques « ram » homonymes (brise-porte ADE II ↔ collision MDG) sont du **code séparé, sourcé, testé** — pas un doublon. Un nom partagé n'autorise JAMAIS à fusionner ni à dupliquer : vérifier le CONCEPT (§C), pas le mot.

## §E-bis — Contrat de schéma (`src/data/schemas/`)

Chaque `src/data/*.json` valide contre un schéma zod **STRICT** — le contrat de donnée (Lot 1,
**113/113** datasets sous contrat, décompte CALCULÉ des defs présentes dans
`src/data/schemas/defs/`). Trois pièces :

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
