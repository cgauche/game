# Système de passifs unifié & corruption data-driven

Référence du système qui modélise **tout modificateur PASSIF continu** (porté par un trait, une mutation,
une qualité d'objet, un traumatisme, une maladie, la faim, un sort actif) dans **UN seul vocabulaire d'ops**,
lu par **UN seul collecteur**, et **éditable en données** (Codex) avec **le même éditeur que les sorts**.

> Passif = effet CONTINU, lu à chaque calcul (≠ effet DÉCLENCHÉ `TriggeredEffect`/Flow, qui se joue sur un
> événement onHit/onKill…, ni effet de sort appliqué à l'incantation). Un passif n'a pas de déclencheur.

## 1. Le vocabulaire : `GameOp` et `PassiveMod`

Un passif est une liste de `GameOp` (`src/engine/ops.ts`) — **le même vocabulaire que les sorts**. Les ops
PASSIVES pertinentes :

| Op | Effet | Lu par |
|---|---|---|
| `charMod {char, mod}` | modif d'une Caractéristique (les 10 à d100) | `effectiveChar` |
| `skillMod {skill, mod}` | modif d'un Test de Compétence nommée | `testValue` / `defenseValue` |
| `testMod {amount, char?}` | modif de Test, qualifié par Caractéristique si `char` | `testValue` |
| `moveMod {mod}` | modif ADDITIVE de Mouvement | `effectiveMovement` |
| `moveScale {num, den}` | modif MULTIPLICATIVE de Mouvement (½ trauma jambe) | `effectiveMovement` |
| `maxWeaponHands {hands}` | plafond de mains d'arme (amputation) | `recomputeLoadout` |
| `senseLoss {sense}` | perte de sens (cécité/surdité cumulative) | escalade sensorielle |
| `apAll {amount}` | PA temporisés à toutes localisations (sort) | `effectiveArmourAt` |

**`charMod` est LE seul op de modif de carac** — il couvre le passif (trait/mutation) ET les sorts. Le
Mouvement n'est PAS une Caractéristique (`CharKey` = les 10 à d100 ; `M` = un petit entier séparé sans Bonus)
→ `moveMod`/`moveScale` lui sont dédiés (légitime, pas une duplication).

Au runtime, le collecteur emballe chaque op dans un **`PassiveMod = { op: GameOp; kind?: PassiveKind }`**.

### `kind` : profil d'ANNULATION et de COMBINAISON

`PassiveKind` (`ops.ts`) porte deux choses : ce qui ANNULE l'effet, et comment il se COMBINE.

| `kind` | annulé par | combinaison |
|---|---|---|
| `intrinsèque` (trait/mutation/qualité) | rien (nature permanente) | **Σ dans la BASE** (additif) |
| `douleur` (séquelle) | Détermination · Insensible · prothèse 'all' | pool non-cumul |
| `mobilité` (séquelle jambe) | idem + prothèse 'movement' | pool non-cumul |
| `structurel` (membre perdu) | prothèse 'all' seule | pool non-cumul |
| `sensoriel` (organe perdu) | rien | pool non-cumul |
| `maladie` | Détermination seule | pool non-cumul |
| `faim` | (`noHunger` purge l'état en amont) | pool non-cumul |
| `magique` (sort actif) | rien (expire) | pool non-cumul |

Règle de combinaison : `intrinsèque` = sommé dans la base ; tout le reste = **pool « meilleur bonus + pire
malus »** (non-cumul, LDB l.168). Table `PASSIVE_CANCELLERS` dans `src/engine/trauma.ts`.

## 2. Le collecteur : `passiveMods(c)`

`src/engine/trauma.ts` → `passiveMods(c: Combatant): PassiveMod[]` est le **point de lecture UNIQUE**. Il
concatène toutes les sources, applique le gating (annulation par `kind`) :

- **Traumatismes** : `Trauma.ops` (kind dérivé par `traumaOpKind`).
- **Mutations** : `c.mutations[].passive` → emballé `intrinsèque`.
- **Traits de profil** : `traitPassiveMods(c.liveTraits)` (cf. §4) → `intrinsèque`.
- **Qualités d'objet équipées** : objet Laid (`testMod{Soc}`) + port d'armure (`skillMod{skill}`) → `intrinsèque`.
- **Maladies / Faim** : pénalités de carac → `maladie` / `faim`.
- **Sorts actifs** (`ActiveEffect`) : `skillMods`/`moveScale`/`moveMod`/`maxWeaponHands` → `magique`.

Helpers d'extraction (lus par les consommateurs, filtrés par op-type + combinaison) :
`passiveCharSum` (charMod Σ intrinsèque), `traumaCharPenalties` (charMod pool), `passiveSkillSum`,
`traumaSkillPenalty`/`traumaDodgePenalty`, `passiveTestMod`, `passiveMoveMod`, `traumaMovementHalved`,
`cannotWieldTwoHanded`. Les consommateurs (`effectiveChar`/`testValue`/`defenseValue`/`effectiveMovement`/
`recomputeLoadout`) lisent UNIQUEMENT ces helpers — jamais les champs typés d'origine.

### Anti-cycle
Le collecteur (trauma.ts) ne peut importer QUE des **feuilles** (disease/provisions/wearPenalty/traits-
dispatch — aucune n'importe trauma/characteristics). Les mutations sont lues **inline** (`c.mutations` est
sur le Combatant). L'**Agilité d'encombrement** reste hors collecteur (couche d'ÉTAT orthogonale, contrainte
de cycle encumbrance→trauma), avec les **États** (couche de pénalité de Test orthogonale).

## 3. Où vivent les passifs (DONNÉE éditable)

| Élément | Champ donnée | Fichier |
|---|---|---|
| Trait | `TraitData.passive: GameOp[]` | `src/data/traits.json` |
| Qualité | `QualityData.passive: GameOp[]` | `src/data/qualities.json` |
| Mutation | `Mutation.passive: GameOp[]` | `src/data/mutations.json` |
| Traumatisme | `Trauma.ops: GameOp[]` | généré en code (`trauma.ts`) |

Le `kind` n'est PAS dans la donnée pour trait/mutation/qualité (toujours `intrinsèque`) : le collecteur
l'affecte. Comme `Trauma.ops` (le kind d'une séquelle est dérivé, pas stocké). **Un seul format : `GameOp[]`.**

## 4. Traits de profil : `spawn → live` (`liveTraits`)

Les modificateurs de profil d'un trait (Élite +20 CC, Brutal −1 M…) ne sont PLUS cuits dans
`characteristics`/`movement` au spawn. `characteristics` = la BASE pure ; `Combatant.liveTraits` liste les
traits dont le passif s'applique EN DIRECT (collecteur) : facultatifs d'un profil bestiaire, traits d'un
statbloc d'éditeur, traits accordés en jeu (`grantTrait`). Les traits **inhérents** d'un profil bestiaire
sont déjà cuits dans le profil imprimé (FINAL) → PAS dans `liveTraits` → **zéro double-compte**.

- `baseWithTraits(c, key)` = base + charMods de trait (sans les volatils) — pour les rares lecteurs BRUTS
  (roll d'Initiative, capacité d'Encombrement, polymorphe) qui attendaient « base + traits ».
- Blessures dérivées du profil INCLUANT les traits (`withTraitChars`) ; `effectiveMaxWounds` référencé sur
  `baseWithTraits` → pas de double-compte des PB de trait.

## 5. Mutations & Tables de Corruption (DÉCOUPLÉES)

Une **mutation** (entité) = identité + effets (`passive`, `apAll`/`apLocations` armure naturelle,
`derivedWeapon`, `traits`, `psychTraits`, `note`), SANS plage de tirage. `src/data/mutations.json` =
`[{label, kind, passive, …}]`.

Une **Table de Corruption** = des plages d100 qui RÉFÉRENCENT des mutations par label.
`src/data/mutationTables.json` = `[{label:'physique', ranges:[{min,max,mutation}]}, …]`. **Plusieurs tables
peuvent pointer la même mutation** (LDB : physique/mentale ; Compagnon T1 : une table par dieu du Chaos
rejoue les mêmes mutations à d'autres plages — pas de collision).

`src/data/mutations.ts` : `rollMutation(table, rng)` (table → plage → réf → entité), `mutationByLabel`,
`LABELS_PHYSIQUES`/`LABELS_MENTALES`. Le `kind` (physique/mentale) reste sur la mutation (nature, pour les
limites de Corruption `mutationLimitExceeded`), indépendant de la table qui l'a tirée.

## 6. Éditer / créer — au Codex

Tout passe par le **Compendium in-app** (`src/ui/compendium/CodexEdit.tsx`, écran Codex DEV) :

- **Trait / Qualité / Mutation** : champ `passive` édité par **`<GameOpEditor>`** (le composant de liste
  d'ops EXISTANT, celui qu'`EffectList` utilise pour les sorts). Ajouter un modificateur de profil = ajouter
  une op. Les autres champs (kind, apAll…) sont auto-inférés (`inferFields`).
- **Tables de Corruption** : `MutationTableField` édite les `ranges` (intervalle d100 + mutation référencée,
  autocomplétée depuis le dataset `mutations`).
- Sauvegarde : écrit le `*.json` app-owned (File System Access API) ; Vite recharge.

**Réutiliser, ne jamais réinventer** : pour éditer des ops → `GameOpEditor`/`EffectList`/`FlowEditor` ;
ne pas écrire de widget de liste d'ops à la main, ne pas dupliquer le vocabulaire (`movementHalved`→`moveScale`).

## 7. Frontières (ce qui N'EST PAS un passif `GameOp`)

- **Apparence** (cornes/écailles/peau d'une mutation) : couche RIG séparée (`src/gameIso/rig/`), par
  label/type → overlay. PAS un `GameOp` (le visuel ≠ le mécanique). Cf. le chantier « apparence d'élément ».
- **Armure naturelle** d'une mutation (`apAll`/`apLocations`) : lue par `recomputeLoadout`/`mutationArmourBonus`,
  couche d'armure (≠ collecteur passif de stats).
- **Sorts** modifiant une carac : MÊME op `charMod`, mais appliqué par `applyOps` → `ActiveEffect{char,bonus}`
  (temporisé, pool `magique`), pas par le collecteur intrinsèque.
- **États** + **Agilité d'encombrement** : couches de pénalité de TEST orthogonales (gardent leur layer).
- Effets STRUCTURELS/comportementaux de trait/qualité (`fly`/`wardSave`/`critTrigger`…) : drapeaux de
  registre dédiés, PAS des modificateurs `GameOp`.

## 8. Recettes (how-to)

- **Ajouter un trait à modificateur de profil** : éditer `traits.json` (Codex) → champ `passive` → `+` op
  `charMod`/`moveMod`. La def TS `src/engine/traits/defs/<slug>.ts` reste `{ key: '…' }` (clé canonique).
- **Créer une mutation** : Codex → catégorie « Mutations » → label/kind + `passive` (ops). L'armure naturelle
  (`apAll`) reste un champ. (Apparence custom : cf. chantier apparence, pas encore en données.)
- **Ajouter une table de Corruption (dieu du Chaos)** : Codex → « Tables de Corruption » → nouvelle entrée
  `{label:'Khorne', ranges:[…]}` référençant des mutations existantes. `rollMutation('Khorne', rng)`.

## Fichiers clés
- `src/engine/ops.ts` — `GameOp`, `PassiveMod`, `PassiveKind`.
- `src/engine/trauma.ts` — collecteur `passiveMods` + helpers + `PASSIVE_CANCELLERS`.
- `src/engine/characteristics.ts` — `effectiveChar`, `baseWithTraits`, `effectiveMaxWounds`.
- `src/engine/traits/dispatch.ts` — `traitPassiveMods`/`traitCharMods` (extracteurs).
- `src/data/mutations.ts` + `mutations.json` + `mutationTables.json` — mutations & tables découplées.
- `src/ui/editor/GameOpEditor.tsx` — éditeur d'ops (réutilisé partout).
- `src/ui/compendium/CodexEdit.tsx` — édition Codex (passif + tables).
