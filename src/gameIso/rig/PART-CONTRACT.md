# Contrat de part du rig — repère et gabarit par slot

Spec à respecter pour dessiner une **part** SVG du rig (cosmétique, tenue, armure, arme).
Le § FORMAT ci-dessous ne couvre pas tous ces registres : il dit son périmètre exact.
Toute part est un fragment SVG (sans `<svg>` wrapper) attaché à un **os** ; le rendu la place
via la matrice monde de l'os puis l'échelonne par `(sx, sy) = thickness/réf, length/réf`.

## FORMAT — trois vues par slot (gardé)

Un slot de **corps** se fournit en **TROIS vues** : `{ front, profile, back }`. Une `string` vaut
« front seulement » et **n'est pas un format valide** : le rendu ne dessine alors pas la part, il
la **fabrique** — et de deux façons distinctes selon le slot :

| Slot fourni en `string` | Ce que `resolveParts` sert de profil/dos |
|---|---|
| `torse` / `jambes` / `tete` | une **silhouette générique inventée** (`PROFILE_TORSE`, `BACK_JAMBE`…) teintée par `dominantCloth` — **l'art de la part est ignoré** |
| `bras` | **rien n'est substitué** : `pickView` retombe sur `front` → l'art de FACE est servi **verbatim** de profil et de dos |

Une vue **recopiée** sur le front satisfait la lettre du format et produit **exactement** le défaut
qu'il vise à tuer : elle est refusée au même titre. Recopie ≠ chaîne identique — la garde compare
les **géométries**, donc l'espace ajouté, le commentaire, le `<g>` enveloppant et le simple
**recoloriage** du front sont refusés eux aussi.

### Périmètre GARDÉ (et ce qui ne l'est pas)

Le format est gardé sur les **deux** registres qui alimentent les slots de corps de `resolveParts` :

| Registre | Clé de stock | Gardé |
|---|---|---|
| **Tenues** (`parts/tenues/defs/`) | `<tenueId>:<slot>` | oui |
| **Armures** (`parts/armour/defs/`) | `armure:<materiau>:<slot>` | oui — elles **priment** sur la tenue (`resolve.ts`, `armed ?? tenuePart`) : hors garde, un bras de plaque front-only battait une tenue conforme |

Registres **hors** garde, à connaître avant de croire le format clos :

- **Armes** (`parts/weapons/defs/`) et **boucliers** (`parts/shields/defs/`) — slots `arme`/`bouclier`,
  qu'aucune substitution de `resolveParts` ne couvre : un art front-only y est **plaqué verbatim**
  de profil et de dos, exactement comme `bras`. Mesuré 2026-07-17 : **89 des 90** formes d'arme et
  **4 des 4** boucliers sont front-only. C'est le même défaut, non cliqueté — décision de périmètre à
  rendre, pas une propriété du format.
- **Visages** (`parts/heads/`) — non concernés : `cosmeticPart` (`parts/cosmetic.ts`) enveloppe
  TOUJOURS le visage en `{ front, back: BACK_NAPE, profile: PROFILE_FACE }` avant `resolveParts`.
  Un `visage` front-only en def ne peut donc pas être plaqué (il tombe dans la classe « silhouette
  générique »). Les chevelures portent leurs 3 vues par type (`HairArt`).

Garde : `parts/tenues/part-view-format.test.ts` — **cliquet** à deux stocks gelés dans
`scripts/guards/lib/rigPartViewStock.mjs` (`PART_VIEW_RATCHET` = slots front-only,
`PART_VIEW_ALIAS_RATCHET` = vues recopiées). Toute entrée NEUVE échoue ; une clé soldée qui y traîne
échoue aussi ; et la **taille** de chaque stock est plafonnée (`MAX_FORMAT`/`MAX_ALIAS`, gelés dans
la garde et non dans le stock — une donnée qui porte son propre plafond le relève d'une ligne), donc
un stock **ne peut que décroître**. La garde exerce le chemin RÉEL (`resolveParts` + le discriminant
`hasProfileView`/`hasBackView` de `parts/resolve.ts`), jamais une réplique, et ses propres évasions
connues sont testées (`describe('morsure')`). **Se solde en DESSINANT la vue, jamais en allongeant
la liste.**

## Règles générales

- **Boîte figure** : 120×150, pieds en (60,150), tête en haut. Mais une part se dessine dans
  le **repère LOCAL de son os** : **origine (0,0) au pivot (l'articulation)**.
- **Sens des axes** : +x = droite, **+y = vers le bas de l'écran** (SVG standard). Pour les
  membres, +y va du joint vers l'**extrémité distale** (épaule→main, hanche→pied).
- **Gradients partagés** (définis une fois dans `DEFS`, cf. sprites.ts) : `g_steel`, `g_steelD`,
  `g_flesh`, `g_cloak`, `g_robe`, `g_coat`, `g_axe`, `g_glow`, `g_eye`, `g_crest`, `g_hVest`.
  Sinon couleurs hex. Matériaux d'armure : cuir `#6a4a2a`, maille `url(#g_steelD)`,
  plaque `url(#g_steel)`, rembourré `#9a8a6a`.
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
