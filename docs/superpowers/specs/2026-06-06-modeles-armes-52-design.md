# Modèles d'armes — 1 silhouette par arme (52) + QC aveugle + vérif sur modèle

> Spec de conception. Date : 2026-06-06. Branche : `feat/wfrp4-rpg-foundation`.
> Statut : approuvé en brainstorming, en attente de relecture utilisateur avant plan.

## 1. Contexte et problème

Le rendu iso dessine l'arme tenue par le rig via `weaponPart(w)` (`src/gameIso/rig/parts/equipment.ts`).
La donnée (`src/data/trappings.json`) contient **52 armes réparties sur 16 groupes canoniques WFRP4**,
mais seulement **~13 silhouettes distinctes** sont réellement rendues : beaucoup d'armes s'effondrent
sur une forme fausse.

Mesuré dans la donnée (mismatchs visibles) :

- **Fléaux** (Fléau, Fléau à grain, Fléau d'armes) → rendus comme une **masse**.
- **Deux-mains** : Zweihänder, Épée bâtarde → rendus comme une **épée à une main**.
- **Escrime** : Rapière, Fleuret → **épée** générique.
- **Hast** : Hallebarde, Pique → **lance** (fer de lance simple).
- **Poudre + Ingénierie** : 6 armes à feu (Arquebuse, Long fusil d'Hochland, Pistolet, Tromblon,
  Arquebus à répétition, Pistolet à répétition) → un **seul pistolet**.
- **Arts dessinés mais NON branchés** : `lasso`, `bolas`, `poing` existent dans
  `generated/weaponsArmour.ts` mais le routage les ignore (lasso→fouet, bolas→dague, coup-de-poing→rien).
- **Base** : Arme improvisée, Arme simple → **épée**.
- **Cavalerie** : Marteau à bec-de-corbin → **masse** (au lieu d'un bec-de-corbin).

## 2. Objectifs / non-objectifs

**Objectifs**

1. **Une silhouette propre, fidèle et reconnaissable par arme** — les 52 entrées de la donnée
   (granularité « 1 par 1 », choisie en brainstorming, quasi-doublons assumés).
2. Art produit par un **workflow multi-agent best-of-N + juge aveugle** (mirroir du pipeline
   créatures éprouvé), pas dessiné à la main.
3. **Vérification de qualité** : audit aveugle PNG (silhouette isolée, 1–5, « devine sans le nom »).
4. **Vérification sur modèle** : rig tenant chaque arme, juges vérifient orientation / prise /
   échelle / lisibilité une fois équipée.
5. Boucle de reprise jusqu'à ce que chaque arme passe les deux gates (ou budget atteint).

**Non-objectifs**

- Ne PAS toucher à l'**animation** : elle reste pilotée par le **groupe canonique** (règle WFRP4 —
  voir `weaponGroup.ts`). On n'ajoute que des *formes* (axe déjà séparé du *groupe*).
- Ne PAS inventer de règles/stats (règle projet #1). Seule la **silhouette** change.
- Pas de vues dos/profil par arme dans cette passe (front suffit, comme les formes générées
  actuelles) — exception possible pour épée/hache si le dos est trivial ; sinon ultérieur.

## 3. Architecture du rendu (existant à respecter)

- `weaponPart(w: Weapon): PartArt` → `weaponFamily(w)` choisit une **clé de FORME** :
  `ART_BY_LABEL[norm(label)]` (libellé exact) **puis** repli `ART_BY_GROUP[groupKey]`.
- `WEAPONS: Record<string, PartArt>` est le registre des arts ; alimenté par
  `Object.assign(WEAPONS, GENERATED_WEAPONS)` puis quelques overrides à la main.
- `PartArt = string | { front, back?, profile? }` ; `pickView` choisit la vue (repli `front`).
- **Convention de l'os `arme`** (`PART-CONTRACT.md`) : origine (0,0) = poignée dans la main,
  lame/tête vers **−y** (haut), pommeau vers +y, étendue `x ±15, y −50..+10`, **échelle uniforme**.
  En jeu l'os `arme` est tourné (~165°) → l'arme pend, poignée en main.
- Art généré écrit dans `src/gameIso/rig/parts/generated/weaponsArmour.ts`
  (`GENERATED_WEAPONS`, `GENERATED_ARMOUR`).
- **Boucliers** : rendus par `shieldPart(x)` (séparé de `WEAPONS`), aujourd'hui une seule ellipse
  générique ignorant l'item.

**Invariant clé** : *l'animation lit le groupe, la silhouette lit la forme*. Ajouter 52 formes ne
change pas le brin d'animation G. Le code distingue DÉJÀ épée/hache/masse (même groupe « Base »).

## 4. Contrat de données — les 52 armes

Source de vérité : `src/data/trappings.json` (filtré LDB/ADE). Chaque arme reçoit un **slug-forme**
et une **cible fidèle** (silhouette-first, FR). `mains_nues` = aucune arme (poings du corps).
Boucliers = `shieldPart` (3 variantes). Cibles fidèles à l'arme réelle — aucune invention.

| Libellé (data) | Groupe | Type | Slug-forme | Cible silhouette (fidèle) |
|---|---|---|---|---|
| Bâton de combat | Armes d'hast | melee | `baton` | long bâton/quarterstaff en bois, deux bouts |
| Hallebarde | Armes d'hast | melee | `hallebarde` | hampe + tête combinée : hache large + pointe + croc |
| Lance | Armes d'hast | melee | `lance` | hampe + fer de lance foliacé |
| Pique | Armes d'hast | melee | `pique` | hampe TRÈS longue, petite pointe d'infanterie |
| Mains nues | Bagarre | melee | *(aucune)* | poings — pas d'arme tenue |
| Coup-de-poing | Bagarre | melee | `poing` | coup-de-poing/cestes sur le poing fermé |
| Arme improvisée | Base | melee | `improvisee` | objet de fortune (planche/tabouret/bouteille) |
| Arme simple | Base | melee | `gourdin` | gourdin/trique de bois simple |
| Bouclier | Base | melee | `shield:rond` | rondache ronde à umbo (shieldPart) |
| Bouclier (Grand) | Base | melee | `shield:grand` | grand écu haut (kite/pavois) (shieldPart) |
| Bouclier (Targe) | Base | melee | `shield:targe` | petite targe ronde bombée (shieldPart) |
| Couteau | Base | melee | `couteau` | couteau à lame courte, rustique |
| Dague | Base | melee | `dague` | dague à garde croisée |
| Lance de cavalerie | Cavalerie | melee | `lance_cavalerie` | longue lance de charge, parfois fanion |
| Marteau à bec-de-corbin | Cavalerie | melee | `bec_de_corbin` | bec-de-corbin : pic recourbé + contre-marteau |
| Épée bâtarde | Deux-mains | melee | `epee_batarde` | épée longue à une main et demie |
| Grande hache | Deux-mains | melee | `grande_hache` | grande hache à 2 mains, large fer |
| Marteau de guerre | Deux-mains | melee | `marteau_guerre` | marteau de guerre 2 mains : tête massive + pic |
| Pioche à deux mains | Deux-mains | melee | `pioche_2m` | pic/pioche de guerre à 2 mains |
| Zweihänder | Deux-mains | melee | `zweihander` | espadon géant, longue lame, parierhaken |
| Fleuret | Escrime | melee | `fleuret` | lame très fine et droite, garde simple |
| Rapière | Escrime | melee | `rapiere` | rapière à garde en coquille/panier ouvragé |
| Fléau | Fléau | melee | `fleau` | manche + chaîne courte + tête/boule |
| Fléau à grain | Fléau | melee | `fleau_grain` | fléau agricole : battant de bois sur lanière |
| Fléau d'armes | Fléau | melee | `fleau_armes` | fléau militaire : chaîne + boule à pointes |
| Brise-épée | Parade | melee | `brise_epee` | lame courte à crans/dents (sword-breaker) |
| Main Gauche | Parade | melee | `main_gauche` | dague main-gauche : longs quillons, anneau de garde |
| Arbalète | Arbalète | ranged | `arbalete` | arbalète : arc transversal + fût + étrier |
| Arbalète de poing | Arbalète | ranged | `arbalete_poing` | petite arbalète à une main |
| Arbalète lourde | Arbalète | ranged | `arbalete_lourde` | grosse arbalète à treuil/cranequin |
| Arc | Arc | ranged | `arc` | arc simple |
| Arc court | Arc | ranged | `arc_court` | arc court (plus petit) |
| Arc elfique | Arc | ranged | `arc_elfique` | arc elfique gracile, double courbure, orné |
| Arc long | Arc | ranged | `arc_long` | grand arc long (≈ hauteur de l'archer) |
| Fouet | Entraves | ranged | `fouet` | manche court + longue lanière qui ondule |
| Lasso | Entraves | ranged | `lasso` | boucle de corde (art existant à brancher) |
| Bombe | Explosifs | ranged | `bombe` | sphère noire + mèche allumée |
| Bombe incendiaire | Explosifs | ranged | `bombe_incendiaire` | pot/bombe à feu, flamme + huile |
| Fronde | Fronde | ranged | `fronde` | 2 lanières + poche + galet |
| Fustibale | Fronde | ranged | `fustibale` | fronde à bâton : lanière au bout d'un manche |
| Bolas | Lancer | ranged | `bolas` | 3 lanières lestées (art existant à brancher) |
| Couteau de lancer | Lancer | ranged | `couteau_lancer` | couteau de jet fin et équilibré |
| Fléchette | Lancer | ranged | `flechette` | dard/fléchette empennée à lancer |
| Hache de lancer | Lancer | ranged | `hache_lancer` | hachette de jet (francisque) |
| Javelot | Lancer | ranged | `javelot` | javelot, lance légère de jet |
| Rocher | Lancer | ranged | `rocher` | grosse pierre / rocher à jeter |
| Arquebus à répétition | Ingénierie | ranged | `arquebus_rep` | long canon + magasin/mécanisme à répétition |
| Pistolet à répétition | Ingénierie | ranged | `pistolet_rep` | pistolet court + barillet/magasin |
| Arquebuse | Poudre noire | ranged | `arquebuse` | long canon + crosse + platine à mèche |
| Long fusil d'Hochland | Poudre noire | ranged | `hochland` | très long canon + lunette de visée |
| Pistolet | Poudre noire | ranged | `pistolet` | pistolet court à crosse recourbée |
| Tromblon | Poudre noire | ranged | `tromblon` | canon évasé en pavillon (blunderbuss) |

**Décompte** : 52 entrées → 1 « aucune arme » (mains nues) + 3 boucliers (`shieldPart`) +
**48 arts d'arme** dans `WEAPONS` + **3 arts de bouclier** dans `shieldPart`.

## 5. Le process (pipeline)

Mirroir du pipeline créatures (`scripts/qc/creatures-redo.workflow.js` + runbook
`docs/qc-reconnaissabilite-sprites.md`), **tout jugé sur PNG**.

### Phase 0 — Plumbing (déterministe, hors workflow)
- Module partagé `scripts/qc/weapon-catalog.mjs` : la liste des 52 (label, type, slug, groupe,
  cible), source unique pour render/ingest/workflows.
- `scripts/_qc-render-weapons.mts` : rend les 52 en **silhouette isolée** → `public/qc/w*.png`
  + `manifest.json` (1 PNG par arme, plus seulement 13). Data-driven depuis le catalog.
- `scripts/_qc-weapons-held.mts` : rendu **rig tenant l'arme**, rendu **data-driven sur les 52**
  (au lieu d'un échantillon de 16), Soldat humain M, → `public/qc/held-*.png` + montage.

### Phase 1 — Génération + sélection (workflow `scripts/qc/weapons-redo.workflow.js`)
- `pipeline` sur les 48 armes (hors boucliers/mains nues) :
  - **Stage Candidats** : `N=2–3` agents-artistes en `parallel`. Chacun :
    - dessine un fragment SVG `front` dans le repère os `arme` (origine poignée, lame vers −y,
      gradients `DEFS` partagés — aucun `<defs>` inventé) ;
    - écrit `art-ref/directional/weapons-redo/<slug>/cand<N>.json` ;
    - **rend son PNG** via `npx tsx scripts/_qc-render-weapon-cand.mts <candPath>` (helper trivial,
      idempotent) → `cand<N>.png`.
  - **Stage Juge aveugle** : 1 agent lit `cand*.png` **sans le nom** (repli sur le SVG-texte si un
    PNG manque), choisit le plus reconnaissable comme la cible, écrit `chosen.json`, renvoie
    `{ chosenFrom, guess, recognizable }`.
- Sortie : `chosen.json` par arme dans le staging (gitignoré).
- **Boucliers** (3) : **dessinés à la main** dans `shieldPart` (hors registre `WEAPONS`, formes
  triviales : rondache / grand écu / targe) ; pas de passage par le workflow d'art. Vérifiés
  quand même par le gate « sur modèle » (Phase 3b).

### Phase 2 — Intégration (déterministe)
- `scripts/_ingest-weapons-redo.mjs` : `chosen.json` → fusionne dans `GENERATED_WEAPONS`
  **en préservant `GENERATED_ARMOUR`** (réécrit `weaponsArmour.ts` à partir des deux objets
  existants + nouveaux). Décode les entités HTML (comme `_ingest-rig-art.mjs`).
- `equipment.ts` :
  - `ART_BY_LABEL` : map les 52 libellés normalisés → leur slug-forme (chaque arme sa forme) ;
    brancher `lasso`→`lasso`, `bolas`→`bolas`, `coup-de-poing`→`poing`.
  - `shieldPart(x)` : switch sur le nom → `shield:rond | shield:grand | shield:targe`.
  - Retirer/alléger les replis devenus inutiles ; garder `ART_BY_GROUP` comme filet pour libellés
    hors-catalogue.
- `npm run typecheck` + `npm test` (le moteur reste vert ; tests d'art si présents).

### Phase 3 — Vérification (workflow `scripts/qc/weapons-qc.workflow.js`)
- **3a — Qualité (barème)** : rendre les 52 isolées (Phase 0 render), audit **aveugle PNG**,
  2 juges/arme, `{ guess, score 1–5, sees }`. Échec = `avg<3` ou hypothèse fausse.
- **3b — Sur modèle** : rendre le rig tenant les 52, 1–2 juges/arme vérifient
  `{ readable, orientation_ok, grip_ok, scale_ok, note }`. Échec = mal orientée / flotte / hors
  échelle / illisible équipée.
- Sortie consolidée : liste `fails` (id, raison, feedback).

### Phase 4 — Boucle de reprise (déterministe + workflow)
- Les `fails` repassent **Phase 1** ciblée avec le feedback (« se lit comme X / mal tenue parce
  que Y, doit lire comme Z »), ré-ingest, ré-rendu, ré-audit. Répéter jusqu'à 0 fail (ou budget).
- `log()` explicite tout plafond/abandon (pas de troncage silencieux).

## 6. Gates d'acceptation

1. `npm run typecheck` et `npm test` verts.
2. **Qualité** : pour les 52, audit aveugle isolé `avg ≥ 3` ET hypothèse ≈ correcte
   (le juge nomme la bonne famille d'arme sans le nom).
3. **Sur modèle** : pour les 52, le rig tient l'arme avec orientation/prise/échelle correctes
   et lisibles (juge `readable && orientation_ok && grip_ok && scale_ok`).
4. Les 3 arts morts (lasso, bolas, poing) sont effectivement sélectionnés par le routage.
5. Les 6 armes à poudre, les 3 fléaux, les 2 escrimes, les 2 deux-mains épées, hallebarde/pique
   se distinguent visuellement les unes des autres (vérifié sur la planche montage).
6. Aucune régression d'animation (le brin G lit toujours le groupe canonique).

## 7. Fichiers

**Neufs**
- `scripts/qc/weapon-catalog.mjs` — les 52 (catalog partagé).
- `scripts/qc/weapons-redo.workflow.js` — génération + juge (phase 1).
- `scripts/qc/weapons-qc.workflow.js` — audit qualité + sur-modèle (phase 3).
- `scripts/_qc-render-weapon-cand.mts` — rend un PNG depuis un cand JSON (helper agent).
- `scripts/_qc-render-weapons.mts` — rend les 52 isolées + manifest.
- `scripts/_ingest-weapons-redo.mjs` — chosen.json → `GENERATED_WEAPONS` (préserve armour).

**Modifiés**
- `scripts/_qc-weapons-held.mts` — data-driven sur les 52.
- `src/gameIso/rig/parts/equipment.ts` — routage `ART_BY_LABEL` (52) + `shieldPart` (3).
- `src/gameIso/rig/parts/generated/weaponsArmour.ts` — régénéré (art des 48 armes).

**Commit** : art + scripts + routage. `art-ref/` reste gitignoré. Committer mes seuls fichiers
(WIP parallèle de l'utilisateur dans le même working tree).

## 8. Risques et mitigations

- **Render par agent fragile** (`npx tsx` cold start) → helper trivial idempotent ; le juge a un
  **repli SVG-texte** si un PNG manque ; on peut aussi pré-rendre en batch hors workflow si besoin.
- **Quasi-doublons** (4 arcs, 3 arbalètes, 2 bombes…) → distinctions **fidèles et subtiles**
  (taille, courbure, mécanisme, flamme), pas d'invention ; assumé par le choix « 1 par 1 ».
- **Écrasement de `GENERATED_ARMOUR`** par l'ingest → l'ingest lit l'existant et **fusionne**.
- **Coût (centaines d'agents)** → ultracode assumé ; boucle de reprise bornée + `log()` des plafonds.
- **Échelle des hampes** (pique/arc long dépassent la boîte) → respecter `y −50..+10`, échelle
  uniforme ; vérifié par le gate « sur modèle ».

## 9. Échelle estimée

~48 arts d'arme + 3 boucliers. Phase 1 ≈ ~150 appels d'agents (48×~3 artistes + 48 juges),
Phase 3 ≈ ~150 (52×2 isolé + 52×~1 sur-modèle), + boucles de reprise. Plusieurs centaines au total.
