# Spec — Table « Difficultés de Combat » complète (Ligne de Vue, Couvert, Combiner, Taille T0/T1)

*2026-06-07. Clôt le reliquat du **Jalon 1** (« distance fine : ligne de vue, couvert ») en
implémentant la table **Difficultés de Combat** (`14 - _GoBack.md` l.72-131) de façon fidèle, plus
la **fondation Taille** (T0) et le **modificateur d'à-toucher de Taille** (T1). Analyse Taille
complète : `2026-06-07-taille-analyse-reference.md`.*

## 1. But & principe

Rendre le **terrain, le couvert et la taille tactiquement réels** au tir et à la mêlée — un PJ se
met à couvert derrière un muret, casse la ligne de vue derrière un mur, un géant est plus facile à
toucher, un halfling plus dur. **Aucune invention** : chaque valeur vient de la table Difficultés de
Combat du Livre de base FR ; les rares choix de design (géométrie, classification des décors) sont
**marqués `[DESIGN]`** et dérivés des exemplaires canon.

## 2. Source de vérité (citations)

- **Ligne de Vue obligatoire au tir** : `13 - Combat.md` l.123 — « votre cible doit être dans votre Ligne de Vue ».
- **Table Difficultés de Combat** : `14 - _GoBack.md` l.77-120.
  - Couverture **imparfaite** (haie) → Complexe **−10** (l.103).
  - Couverture **moyenne** (barrière en bois) → Difficile **−20** (l.114).
  - Couverture **totale** (mur de pierre) → Très Difficile **−30** (l.120) — *pénalité, pas impossibilité*.
  - Cible **dissimulée** par brouillard/brume/obscurité → Difficile **−20** (l.107).
  - **Tir en bougeant** (Mouvement + tir au même Round) → Complexe **−10** (l.101).
  - **Météo** : pluie battante / boue → Intermédiaire **+0** (l.94-98) ; mousson / ouragan / blizzard /
    condition extrême → Difficile **−20** (l.108-109) ; haute neige / dans l'eau → Difficile **−20**
    sur **l'attaque ET l'esquive** (l.115-116) ; brouillard / brume (= obscurité) → **−20** au tir (l.107).
  - **Taille de la cible** au tir : Monstrueuse +60 … Minuscule −30 (l.79-118 + table l.151-170).
- **Combiner les Difficultés** : `14` l.126-131 — somme des malus **plafonnée à −30**, somme des bonus
  **plafonnée à +60** ; un mélange malus+bonus se somme.
- **Tir dans un combat de mêlée** : `14` l.133-136 — tir sur une cible Engagée avec un allié →
  **−20** ; si ce −20 fait rater un Test qui aurait touché, on **touche un allié intercalé** au hasard.
- **Extrapolation autorisée** : `14` l.75 — « Si vous vous retrouvez dans une situation qui n'apparaît
  pas ici, servez-vous de ces exemples comme guide » (fonde la classification décor + créature-couvert).
- **Taille** : `85 - Traits de créature.md` l.279-280 (7 catégories), l.301-303 (+10 au plus petit) ;
  `14` l.151-170 (table + mods de tir). Cf. analyse de référence.

## 3. Périmètre

### Dans ce lot
- **A. Ligne de Vue** : gate dur au tir (arme **et** projectile magique) — cible hors LdV = pas de tir.
- **B. Couvert** : 3 niveaux canon (−10/−20/−30) issus du terrain, des bâtiments, des décors **et** des créatures sur la ligne.
- **C. Combiner les Difficultés** : plafonds −30 / +60 sur les modificateurs de difficulté de combat.
- **D. Environnement** : obscurité −20 (`ambiance:'nuit'`) ; tir-en-bougeant −10.
- **E. Tir dans la mêlée** : −20 + redirection vers un allié intercalé sur échec-qui-aurait-touché.
- **F. Taille T0** : champ `size`, enum, `SIZE_ORDER`, `SIZE_RANGED_MOD`, parser `sizeFromTraits`, dérivation espèce/statblock.
- **G. Taille T1** : à-toucher au tir selon la Taille de la cible ; +10 au plus petit *(scope/stacking à vérifier verbatim, cf. §6)*.
- **H. Météo** : champ `scene.weather` + mods de combat canon (brouillard/tempête/neige −20, neige −20 *aussi en esquive*) + **sélecteur éditeur**. L'obscurité (`ambiance:'nuit'`) et le brouillard convergent sur le même « cible dissimulée −20 ».
- **I. Gabarits d'objets (statiques)** : empreinte multi-cases optionnelle sur les décors (patron `foot {w,h}` des bâtiments) — **exposée éditeur**, lue par walkability + Couvert/LdV (un objet couvre/bloque **toutes** ses cases). Rendu multi-cases du sprite = cosmétique, laissé au rig.

### Hors de ce lot (futur jalon Taille — cf. analyse de référence)
T2 Dégâts ×N + Dévastatrice/Percutante + Frappe Mortelle · T3 défense −2 DR parade + désengagement
gratuit + Force opposée + Piétinement · T4 Blessures par catégorie · T5 Peur/Terreur (sous-système
Psychologie) · **T6 footprint des créatures qui se DÉPLACENT** (pathing multi-cases — le point dur).
Aussi hors-lot : surnombre mêlée +20/+40, flanc/dos +20, localisation par forme de corps, monture.

## 4. Architecture

Tout en **moteur pur** (`src/engine`) + **registres state** (`src/state`), testé en isolation. **Aucun
fichier `gameIso/rig/*` édité** (session parallèle) — lecture seule de la scène.

| Module | Statut | Rôle |
|---|---|---|
| `src/engine/size.ts` | **NEW** | `SizeCategory`, `SIZE_ORDER`, `SIZE_RANGED_MOD`, `sizeLabel`, `sizeGap`. Pur. |
| `src/engine/lineOfSight.ts` | **NEW** | `tilesBetween`, `CoverClass`, `coverModifier`, classification décor/créature, `lineOfSightCover(scene, from, to, occupants)`. Pur. |
| `src/state/terrain.ts` | EDIT | `TerrainMeta.sight?: 'clear'\|'cover'\|'block'` (+ classe de couvert). `mur`→block, `bois`→cover-imparfaite, `porte`→block, eau/sols→clear. *(Mon couloir — la présentation reste `gameIso/catalog/terrain.ts`.)* |
| `src/engine/combat.ts` | EDIT | `combineMods` (plafonds) ; `attackModifiers` reçoit `cover`/`obscured`/`movedThisRound` + lit `target.size` ; gate LdV dans `resolveRangedAttack`. |
| `src/engine/types.ts` | EDIT | `Combatant.size?: SizeCategory` ; `ModLine.uncapped?` (Avantage hors plafond). |
| `src/state/scene.ts` | EDIT ⚠️ | `CustomStatblock.size?` ; `Scene.weather?` ; `SceneEntity.foot?: {w,h}`. **Fichier partagé rig** → commit hunks sélectifs. |
| `src/state/sceneRules.ts` *(ou helper existant)* | **NEW/EDIT** | `sceneCombatModifiers(scene)` ; `entityBlockedAt(scene,x,y)` (empreinte décor). Pur côté state. |
| `src/state/spawn.ts` | EDIT | dérive `size` (statblock.size → `sizeFromTraits(traits)` → espèce → 'moyenne'). |
| `src/state/combatFlow.ts` | EDIT | calcule distance/LdV/couvert/obscured/météo/movedThisRound, passe à `attackModifiers`/`defenseModifiers` ; gate LdV à la sélection de cible ; redirection « tir dans la mêlée ». |
| `src/state/ai.ts` | EDIT | l'IA respecte la LdV pour choisir une cible de tir. |
| `src/ui/RollModal.tsx` (+ ciblage) | EDIT | lignes Couvert/Taille/obscurité/météo dans le détail du jet opposé ; cibles hors-LdV grisées/refusées. |
| `src/ui/editor/*` (réglages scène + inspecteur décor) | EDIT ⚠️ | `<select>` météo ; champs empreinte `w/h`. **Possiblement partagé rig** (`Editor.tsx`) → hunks sélectifs / sous-composant dédié. |

## 5. Détail des composants

### A. Ligne de Vue (`lineOfSight.ts`)
`tilesBetween(from, to)` = tracé supercover des cases **strictement** traversées (hors extrémités).
`lineOfSightCover(scene, from, to, occupants)` parcourt ces cases et agrège les obstacles :
- **bloqueur de vue** (`sight:'block'` : `mur`, mur de bâtiment, `statue`) :
  - s'il est **adjacent à la cible** le long de la ligne → la cible se colle au couvert → `cover:'totale'` (−30), **tir possible** `[DESIGN]` (réalisation de « derrière un mur de pierre = −30 »).
  - sinon (bloqueur à distance de la cible) → cible entièrement masquée → `blocked:true` (**pas de tir**, `13` l.123).
- **couvert partiel** (terrain `bois`, décors, créatures) : contribue une `CoverClass` ; on retient la **pire** (la plus négative). Pas de cumul de couverts (le RAW ne cumule pas ; Combiner plafonne de toute façon).
Retour : `{ blocked: boolean, cover: CoverClass }` où `CoverClass = 'none'|'imparfaite'|'moyenne'|'totale'` et `coverModifier` = `0/−10/−20/−30`.

**Projectile magique vs arme à distance** : le **gate LdV** s'applique aux **deux** (il faut voir la
cible, `13` l.123). En revanche **Couvert + Taille** sont des modificateurs d'un **Test de Projectiles**
— or, dans notre modèle magique (`engine/magic.ts`), le projectile magique n'a **pas** de Test de
Projectiles (il s'applique sur la réussite de l'incantation, DR ≥ NI). Donc Couvert/Taille **ne
modifient pas** le projectile magique ; seule la LdV le conditionne.

**Classification des décors** `[DESIGN]` (dans `lineOfSight.ts`, par id de catalogue, via exemplaires canon) :
- moyenne −20 : `cloture` *(= exemplaire canon « barrière en bois »)*, `charrette`, `tonneau`, `caisse`, `etal-marche`, `epave-carrosse`.
- totale/block −30 : `statue`.
- imparfaite −10 : `arbre`, `tas-foin`, `cheval-mort`.
- moyenne −20 : aussi `puits`, `fontaine` (pierre solide à hauteur de taille, cohérent avec tonneau/caisse).
- aucun : `lampadaire`, `panneau`, `feu-camp`, `cadavre`, `mare-sang` (minces / au sol).
- **Créature** (`personnage`) sur la ligne → imparfaite −10 `[DESIGN, extrapolation `14` l.75]`.

### B/C. Couvert + Combiner (`combat.ts`)
`attackModifiers` pousse `{label:'Couvert (…)', value: coverModifier(cover)}` (tir uniquement).
`combineMods(mods)` : partitionne `uncapped` (Avantage) du reste ; `cappedNeg = max(−30, Σ malus)`,
`cappedPos = min(+60, Σ bonus)` ; **net = uncappedΣ + cappedPos + cappedNeg**. Remplace `sumMods`
pour les **Tests de combat** (attaque ; défense en option — cf. §6). Le détail affiché conserve chaque
ligne + signale le plafonnement.

### D. Environnement (`combatFlow.ts` → `attackModifiers`)
- `obscured` = `scene.ambiance === 'nuit'` → `{label:'Obscurité', value:−20}` (`14` l.107) `[DESIGN: mapping ambiance→obscurité]`.
- `movedThisRound` = l'acteur a dépensé du Mouvement avant de tirer ce tour → `{label:'Tir en bougeant', value:−10}` (`14` l.101).

### E. Tir dans la mêlée (`combatFlow.ts`)
Si la cible de tir est **Engagée** avec un allié du tireur : `{label:'Tir dans la mêlée', value:−20}`
(`14` l.134). Résolution : on calcule le jet **avec** et **sans** ce −20 ; si avec−20 = échec mais
sans−20 = succès → la touche est **redirigée** vers un allié intercalé choisi au hasard (RNG seedable),
résolue par le pipeline de touche normal. Réutilise `engagement.ts` + la liste des occupants.

### F. Taille T0 (`size.ts`, `spawn.ts`, `types.ts`, `scene.ts`)
```
export type SizeCategory = 'minuscule'|'tresPetite'|'petite'|'moyenne'|'grande'|'enorme'|'monstrueuse'
export const SIZE_ORDER: Record<SizeCategory, number>      // 0..6 — cœur (écart)
export const SIZE_RANGED_MOD: Record<SizeCategory, number> // −30..+60 — tir (valeur absolue)
export const sizeLabel: Record<SizeCategory, string>       // FR
export function sizeGap(a, b): number                       // SIZE_ORDER[a]-SIZE_ORDER[b]
```
`sizeFromTraits(traits)` (dans `spawn.ts`, calqué sur `weaponFromTrait`/`armourFromTraits`) : regex
`/^Taille\s*\(([^)]+)\)/i` → `norm` → catégorie ; **5 plages narratives** (« de Petite à Énorme »,
« Minuscule-Énorme »…) → **borne haute** `[DESIGN documenté]` ; défaut **'moyenne'**. Dérivation dans
`statblockToCombatant` : `statblock.size ?? sizeFromTraits(traits) ?? 'moyenne'`. Héros : **'moyenne'**
pour la comparaison (Halfling reste Petite **pour les Blessures**, hors-lot T4). **Ne pas éditer
`creatures.json`** (régénéré ; les 47 traits littéraux deviennent exploitables via le parser).

### G. Taille T1 (`combat.ts`)
- **Tir** : `attackModifiers` (kind ranged) pousse `{label:'Taille (cible)', value: SIZE_RANGED_MOD[target.size]}`.
- **Plus petit** : `{label:'Taille (plus petit)', value:+10}` si `sizeGap(attacker, target) < 0` — *scope (mêlée seule vs mêlée+tir) et stacking avec le mod de tir à **vérifier verbatim** `85` l.300-306 en TDD avant de figer (cf. §6)*.
- Un mod de Taille qui transforme un échec en réussite → **0 DR** (`14` l.139) `[à implémenter dans la résolution]`.

### H. Météo (`scene.ts`, helper `state`, éditeur)
`Scene.weather?: 'clair'|'pluie'|'brouillard'|'neige'|'tempete'` (défaut `'clair'`), **orthogonal** à
`ambiance` (moment/lieu). Helper **pur côté state** `sceneCombatModifiers(scene)` → `{ concealed, attackMod, dodgeMod, labels }` :
`brouillard`→concealed (−20 tir, comme `ambiance:'nuit'`) ; `tempete`→attaque −20 ; `neige`→attaque −20
**et esquive −20** (le seul à toucher la défense) ; `pluie`/`clair`→0. `combatFlow` lit ces primitives et
les passe à `attackModifiers` (tir/mêlée) et `defenseModifiers` (esquive sous neige) — le moteur reste
sans dépendance à `Scene`. **Éditeur** : `<select>` météo dans le panneau de réglages de scène (à côté
d'`ambiance`).

### I. Gabarits d'objets statiques (`scene.ts`, `lineOfSight.ts`, walkability, éditeur)
`SceneEntity.foot?: { w: number; h: number }` (optionnel ; défaut 1×1 = comportement actuel), calqué sur
`BuildingFeature`. Un défaut **par type de décor** peut être proposé (charrette 2×1, épave 2×2…) `[DESIGN]`.
Conséquences :
- **Walkability** : un `prop`/`objet` avec `foot` **bloque toutes ses cases** (étendre `isWalkable`/un
  `entityBlockedAt(scene,x,y)` analogue à `buildingBlockedAt`). Le BFS de `path.ts` contourne sans modif
  (per-tile). *(Les créatures qui se déplacent sur empreinte = T6, hors-lot.)*
- **Couvert/LdV** : `lineOfSightCover` teste l'intersection de la ligne avec **l'ensemble des cases** de
  l'empreinte de chaque obstacle, pas seulement sa case d'ancrage.
- **Éditeur** : champs `w`/`h` d'empreinte sur l'inspecteur de décor (via `ParamFields`/inspecteur existant).
- **Rendu** : le sprite reste ancré (cosmétique) — le rig affinera l'étalement visuel ; le **gameplay**
  (couvert + blocage) est correct dès la donnée.

## 6. Décisions RAW vs DESIGN (explicites)

| Sujet | Statut | Décision |
|---|---|---|
| Valeurs Couvert −10/−20/−30, LdV gate, obscurité −20, tir-en-bougeant −10, tir-mêlée −20, Combiner ±, mods de Taille au tir | **RAW** | verbatim, sourcé §2. |
| Classification décor→classe de couvert | DESIGN | via exemplaires canon (`cloture`=barrière bois, etc.) + `14` l.75. |
| Créature sur la ligne = imparfaite −10 | DESIGN | extrapolation autorisée `14` l.75. |
| Géométrie « bloqueur adjacent cible = totale −30, sinon pas de tir » | DESIGN | réalisation de « derrière un mur de pierre = −30 » vs LdV nulle. |
| Borne haute des plages de Taille narratives | DESIGN | documenté, testé sur les 5 cas réels. |
| `ambiance:'nuit'` → obscurité −20 | DESIGN | mapping ; `'foret'` laissé au couvert par tuile. |
| Avantage hors plafond Combiner | **interprétation** | l'Avantage n'est pas une entrée de la table Difficultés ; appliqué hors cap. À confirmer. |
| Combiner appliqué à la **défense** | **à trancher** | RAW (« Tests de Combat ») ⇒ oui ; périmètre : attaque d'abord, défense si trivial. |
| **+10 au plus petit** : mêlée seule ou mêlée+tir ? stacking avec mod de tir ? | **À VÉRIFIER verbatim** | lire `85` l.300-306 avant d'implémenter T1 ; ne pas figer sur l'analyse. |

## 7. Plan de tests (TDD)
- `size.test.ts` : parser (catégories simples + 5 plages → borne haute), `SIZE_RANGED_MOD`, `sizeGap`, défaut moyenne.
- `lineOfSight.test.ts` : `tilesBetween` (horizontal/vertical/diagonal/round-trip), couvert pire-classe, bloqueur adjacent=totale vs distant=blocked, créature-sur-ligne=−10, ligne dégagée=none.
- `combat` : `combineMods` (plafonds −30/+60, mix, Avantage hors cap), `attackModifiers` cover/obscurité/mouvement/taille, gate LdV `resolveRangedAttack`.
- `combatFlow`/store : cible hors-LdV refusée ; tir-dans-la-mêlée −20 + redirection allié (RNG seedé) ; IA ne tire pas sans LdV.
- Régression : suite verte existante après bascule `sumMods`→`combineMods` (mettre à jour les attentes impactées).

## 8. Isolation session rig
Lecture seule de `scene.tiles`/`buildings`/`entities` et des catalogues. Sémantique de couvert dans
**mon** `state/terrain.ts` + `engine/lineOfSight.ts`, **pas** dans `gameIso/catalog/*`. Aucune dépendance
à éditer `IsoStage.tsx`/`rig/*` (le rendu multi-cases d'un décor reste au rig).

**Fichiers partagés** (`scene.ts`, `ui/editor/Editor.tsx` — actuellement modifiés non-committés par la
session rig) : mes ajouts (champs `weather`/`foot`/`size` ; UI météo/empreinte) sont posés dans des
**régions distinctes**, et committés par **hunks sélectifs** (`git add -p <fichier>` → `git commit`
sans pathspec = seuls mes hunks staged), **jamais** `git commit -- <fichier>` (qui emporterait leur WIP).
Mes fichiers exclusifs (`engine/size.ts`, `engine/lineOfSight.ts`, `state/sceneRules.ts`, tests) restent
committés normalement. Préférer un **sous-composant dédié** pour l'UI météo/empreinte afin de réduire la
surface de contention dans `Editor.tsx`.
