# Contrat de part du rig — repère et gabarit par slot

Spec à respecter pour dessiner une **part** SVG du rig (cosmétique, tenue, armure, arme).
Le § FORMAT ci-dessous ne couvre pas tous ces registres : il dit son périmètre exact.
Toute part est un fragment SVG (sans `<svg>` wrapper) attaché à un **os** ; le rendu la place
via la matrice monde de l'os puis l'échelonne par `(sx, sy) = thickness/réf, length/réf`.

## FORMAT — `ViewSet` TOTAL par slot de corps (contrat cible)

Un slot de **corps** (`tete` / `torse` / `jambes` / `bras`) se résout, au runtime, en un
**`ViewSet` TOTAL** (`parts/types.ts`) : `{ front, back, profile }` — les trois vues sont
**GARANTIES**. L'accès se fait par `pickBodyView(art, view)` = `art[view]`, **sans repli** : une vue
manquante est une **erreur de compile**, plus jamais un `?? art.front` silencieux. (La forme
`PartArt` = `string | { front, back?, profile? }` survit pour les registres à **repli DÉCLARÉ** —
armes, boucliers, appendices, têtes de race, injections monstrueuses — servis par `pickView` ;
elle n'est **plus** la porte de sortie des slots de corps.)

Les **defs** (tenues/armures) portent encore un `PartArt` legacy (souvent une `string` front-only,
ou un objet à vues partielles). Un **shim P1** — `toViewSet(slot, art, opts)` (`parts/derive.ts`,
**retiré en P3**) — les enrobe en `ViewSet` total **au point d'ingestion** par `resolveParts` :

| Vue du slot | Source |
|---|---|
| `front` | l'art fourni (string, ou `art.front`) |
| `profile` / `back` | la vue **DÉCLARÉE** du def si présente ; **sinon DÉRIVÉE** du front (`deriveViews`) |

La **dérivation** (`parts/derive.ts`, décision **D3** : ces helpers sont destinés à être
**matérialisés dans les defs** — un def porte à terme ses 3 vraies vues, plus de dérivation runtime) :

| Slot dérivé | Helper | Sortie |
|---|---|---|
| `torse` / `jambes` / `tete` | `deriveViews` (`PROFILE_TORSE`/`BACK_JAMBE`…) | silhouette générique en TOKENS du tissu dominant (`dominantCloth`) — **le front n'est jamais plaqué** |
| `bras` | `deriveProfileBras` / `deriveBackBras` (**neufs**) | vraie silhouette de profil/dos du bras (fin du **front plaqué** : le défaut historique du slot `bras`) |

> Les helpers peignent en **tokens existants** (`@vet1`/`@cuir`/`@peau`…) — jamais un hex neuf.

### Décisions cadrant les phases suivantes

- **D1** — le bras sera **scindé au coude** (bras + avant-bras) : *à venir* (phase ultérieure) ; en P1
  le bras reste une part unique épaule→poignet.
- **D2** — les **armes** porteront **3 vraies vues** : *à venir* (P4) ; aujourd'hui `arme`/`bouclier`
  sont front-only, plaqués verbatim de profil/dos (hors périmètre P1, cf. ci-dessous).
- **D3** — les helpers `derive*` sont **matérialisés dans les defs** : le shim P1 est l'étape de
  transition ; en P3 les defs portent leurs vues et `toViewSet` disparaît.
- **D4** — **pas de visage de dos** : *à venir* (P2) ; aujourd'hui `cosmeticPart` sert `BACK_NAPE`
  (nuque) et `PROFILE_FACE`. Le **corps de base garanti crâne+cou** est également P2.

### Des 3 vues aux 8 directions

Une part n'est dessinée qu'en **3 vues** (`front` / `profile` / `back`) ; le **profil est tourné vers
la droite**, le profil gauche s'obtient par **MIROIR** dans la machinerie de rendu (jamais dans l'art).
La sélection vue+miroir pour une orientation monde `Dir8` et un cran caméra vient de l'unique
résolveur `project(dir8, camRot)` (`facing.ts`, **inchangé**) → 8 directions couvertes par 3 vues + un
flip horizontal.

### Périmètre GARDÉ (et ce qui ne l'est pas)

Le **cliquet de format** (`parts/tenues/part-view-format.test.ts`) mesure, sur les **defs bruts**,
lesquels ne portent **pas encore** leurs 3 vraies vues (dette à solder en dessinant) :

| Registre | Clé de stock | Gardé |
|---|---|---|
| **Tenues** (`parts/tenues/defs/`) | `<tenueId>:<slot>` | oui |
| **Armures** (`parts/armour/defs/`) | `armure:<materiau>:<slot>` | oui — elles **priment** sur la tenue (`resolve.ts`, `armed ?? tenuePart`) |

Registres **hors** garde :

- **Armes** (`parts/weapons/defs/`) et **boucliers** (`parts/shields/defs/`) — slots `arme`/`bouclier`,
  qu'aucun `ViewSet` ne couvre en P1 : un art front-only y est **plaqué verbatim** de profil et de dos
  (via `pickView`). Mesuré 2026-07-17 : **89 des 90** formes d'arme et **4 des 4** boucliers sont
  front-only — c'est la **décision D2** (P4), pas une propriété du format.
- **Visages** (`parts/heads/`) — `cosmeticPart` (`parts/cosmetic.ts`) enveloppe TOUJOURS le visage en
  `{ front, back: BACK_NAPE, profile: PROFILE_FACE }` avant `resolveParts`. Les chevelures portent
  leurs 3 vues par type (`HairArt`).

Une vue **recopiée** sur le front satisfait la lettre du format mais produit le défaut qu'il vise à
tuer : refusée au même titre (**anti-alias**). La garde compare des **géométries**, donc l'espace
ajouté, le commentaire, le `<g>` enveloppant et le simple **recoloriage** du front sont refusés eux
aussi. Deux stocks gelés dans `scripts/guards/lib/rigPartViewStock.mjs` (`PART_VIEW_RATCHET` =
slots front-only, `PART_VIEW_ALIAS_RATCHET` = vues recopiées) ; toute entrée NEUVE échoue, une clé
soldée qui y traîne échoue aussi, et la **taille** de chaque stock est plafonnée (`MAX_FORMAT`/
`MAX_ALIAS`, dans la garde) — un stock **ne peut que décroître**. La garde exerce le chemin RÉEL
(`resolveParts` + le discriminant de format `hasProfileView`/`hasBackView`, `parts/types.ts`), jamais
une réplique, et ses évasions connues sont testées (`describe('morsure')`). **Se solde en DESSINANT
la vue, jamais en allongeant la liste.**

## Règles générales

- **Boîte figure** : 120×150, pieds en (60,150), tête en haut. Mais une part se dessine dans
  le **repère LOCAL de son os** : **origine (0,0) au pivot (l'articulation)**.
- **Sens des axes** : +x = droite, **+y = vers le bas de l'écran** (SVG standard). Pour les
  membres, +y va du joint vers l'**extrémité distale** (épaule→main, hanche→pied).
- **Gradients partagés** (définis une fois dans `DEFS`, cf. sprites.ts) : `g_steel`, `g_steelD`,
  `g_flesh`, `g_cloak`, `g_robe`, `g_coat`, `g_axe`, `g_glow`, `g_eye`, `g_crest`, `g_hVest`.
  Sinon couleurs hex — MAIS **jamais pour la CHAIR** (voir ci-dessous). Matériaux d'armure : cuir
  `#6a4a2a`, maille `url(#g_steelD)`, plaque `url(#g_steel)`, rembourré `#9a8a6a`.
- **MATIÈRE vs PORTEUR — distinction obligatoire (#583 chair, #599 flanc jumeau cheveux).** Une
  couleur en dur est légitime pour la **matière propre à la tenue** (le cuir de CETTE veste, son
  acier — une couleur qui lui appartient, à elle, pas au porteur). Elle est **INTERDITE pour les
  jetons du PORTEUR** — chair (`@peau`/`@peauO`/`@peauH`) ET chevelure
  (`@cheveux`/`@cheveuxO`/`@cheveuxH`) — qui appartiennent au PERSONNAGE et doivent TOUJOURS
  suivre les jetons résolus par `raceAppearance.json` au moment du rendu, jamais `url(#g_flesh)`,
  jamais un littéral hex. `g_flesh` est désormais DÉRIVÉ dynamiquement de la peau résolue du
  personnage à la composition (`composeRig.tsx`, `palette.ts::fleshGradientId`/
  `fleshGradientDefs`) : toute part qui le référence encore obtient la bonne teinte SANS ÊTRE
  MIGRÉE, mais une part NEUVE doit peindre directement `@peau`/`@peauO`/`@peauH` — ne plus graver
  `url(#g_flesh)`. Plus largement : tout littéral hex qui vaudrait EXACTEMENT une valeur déjà
  déclarée dans la `palette` du def (chair, cheveux, cuir, tissu, plume…) est une faute — c'était
  le jeton `@<clé>` qu'il fallait peindre (gardé, `parts/tenues/palette-literal.test.ts`,
  cliquet). Piège symétrique côté cheveux : un jeton `@cheveux*` DANS l'art d'une tenue n'est
  légitime que s'il peint RÉELLEMENT la chevelure du porteur (dans ce cas, la `palette` ne le
  déclare PAS, cf. règle suivante — l'art suit l'espèce). S'il peint une AUTRE matière (guimpe,
  capuche, coiffe) qui ressemble à s'y méprendre à des cheveux, c'est le jeton qui est FAUX :
  renommer l'usage vers un jeton de vêtement dédié (ex. `Nonne.ts`, guimpe → `@voile*`), jamais
  laisser `@cheveux*` peindre du tissu.
- **`TenueDef.palette` n'a PAS le droit de déclarer `peau`/`peauO`/`peauH`/`cheveux`/`cheveuxO`/
  `cheveuxH`** — une TENUE n'a ni peau ni chevelure (gardé,
  `parts/tenues/no-flesh-in-tenue-palette.test.ts`, #583, #599). Le piège vécu : l'ART peignait
  correctement `@peau`/`@peauO` (règle ci-dessus respectée), mais la `palette` du def déclarait
  AUSSI ces clés avec une teinte figée — `tenuePaletteFor` prime sur l'espèce dans l'empilage
  (`rigStoredPalette`), donc ce jeton se résolvait à la couleur de la TENUE, pas à celle du
  porteur (17 tenues sur 117 pour la chair, dont `Chansonnier` en commentaire « avant-bras nu
  (g_flesh) » — le nom trahissait déjà le défaut ; 5 tenues sur 117 pour les cheveux — la palette
  merge étant UNIQUE pour tout le rig, la fuite recolorait aussi le bone `cheveux` cosmétique
  SÉPARÉ, layer 1 sous la tenue, cf. `bones.ts::SLOT_LAYER`). Une tenue déclare cuir/tissu/métal ;
  jamais chair ni chevelure.
- **Échelle** : NE PAS compenser la morphologie — dessiner au gabarit de référence (humain M).
  Le moteur scale la part par l'os. Les armes/boucliers sont scalés **uniformément**.
- **Miroir** : les slots `bras`/`jambes` sont dessinés UNE fois (côté gauche) ; le côté droit
  est rendu en miroir automatiquement. Dessiner pour le côté gauche/neutre.

## Gabarit par slot (repère local de l'os, échelle de référence)

| Slot | Os porteur | Origine (0,0) | Étendue attendue | Notes |
|---|---|---|---|---|
| `visage` | tete | base/centre tête | x −9..9, y −2..16 | cercle ~r9 cy7 + yeux ; toujours présent |
| `cheveux` | tete | idem | x −10..10, y −8..22 | F peut descendre plus bas ; masqué sous heaume fermé |
| `tete` (coiffe/casque) | tete | idem | x −10..10, y −16..6 | bandeau/heaume ; vide = tête nue |
| `torse` | torse | jonction taille | x −16..16, **y −32..+50** | couvre épaules (−28/−32) → hanches (+34) ; robe jusqu'à +50 |
| `bras` | epauleG/D | épaule | x −4..4, **y −2..+34** | bras ENTIER épaule→poignet (epaule+avantBras ≈ 36) |
| `jambes` | cuisseG/D | **hanche** | x −5..5, **y 0..+50** | **y=0 = hanche**, +y descend vers la cheville (cuisse+tibia ≈ 50) |
| `arme` | arme (main D) | poignée dans la main | x ±15, **y −50..+10** | lame/tête vers −y (haut), pommeau vers +y ; échelle uniforme |
| `bouclier` | bouclier (main G) | centre dans la main | x −12..12, y −10..+22 | échelle uniforme |

> Attention : le slot `jambes` se dessine **du haut (hanche, y=0) vers le bas (cheville, y≈50)** —
> c'est la convention réelle du code (cf. generic/career/armour jambes : `<rect y="0" height="50">`).

## Ordre de calque

- **Inter-os** : `bone.z` (jambes 3..6 < bras 4..8 < torse 5 < tête 7 < arme 9).
- **Intra-os** (`SLOT_LAYER`) : sur la tête `visage(0) < cheveux(1) < coiffe(2)` ;
  sur le torse `jambes(0) < torse(1) < bras(2)`.

## Slots pilotés par quoi

- `arme`/`bouclier` ← équipement porté (famille d'arme / bouclier).
- `tete`/`bras`/`torse`/`jambes` ← **armure équipée couvrant l'emplacement** (matériau) →
  sinon **tenue de la classe de carrière** → sinon générique.
- `visage`/`cheveux` ← toujours, par espèce × sexe.
- Override éditeur (`appearance.parts[slot]`) prime sur tout.

## Contrat de sortie pour un agent-artiste

Renvoyer, par part demandée : `{ slot, svg }` où `svg` est le fragment respectant le repère
ci-dessus (origine au pivot, +y distal, étendue dans le gabarit, gradients partagés). Pas de
`<svg>`, pas de `transform` racine (le moteur s'en charge). Tester par rendu dans la galerie QC
(`scripts/gen-rig-gallery.mts`) avant d'intégrer.
