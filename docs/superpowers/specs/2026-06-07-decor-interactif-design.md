# Décor interactif — fouille & ramassage (remplace le kind `objet`)

*Spec — 2026-06-07. Sous-projet 1 (MÉCANIQUE). Dissout le kind `objet` dans `prop` : tout décor
peut devenir fouillable/ramassable, avec une affordance claire. Sous-projet 2 (sprites) suit.*

## 1. Problème

Le kind `objet` cloue l'interactivité à une **caisse générique fixe**, coupée du décor réel. On
veut *fouiller le décor existant* (cadavre, charrette, épave…) et *ramasser une lettre au sol* —
pas poser une boîte. L'implémentation actuelle a trois défauts (vérifiés) :

- **Faux loot.** `loot: string[]` (`scene.ts:106`) atterrit dans un `inventory` party = liste de
  **noms**, sans stats/équip/poids. Le seul vrai objet jouable passe par `giveTrapping` **planqué
  dans `search`** (`store.ts:864-868` vs `1602-1620`). Les deux canaux se ressemblent dans
  l'éditeur (`Editor.tsx:1361-1377`) mais font des choses incompatibles (et `search` masque `loot`
  en exploration, `store.ts:853-862`).
- **Pas d'affordance.** Décor inerte d'apparence, clic-seul (`IsoStage.tsx:432-435`), un clic à
  distance ne fait que logguer « Trop loin » (`store.ts:844-847`) sans s'y rendre.
- **Redondance.** `objet` ≈ `prop` (visuel identique), `search` ≈ `trigger` (même `Effect[]` à
  drapeau-une-fois) — 4 kinds + 2 canaux de butin qui se chevauchent.

## 2. Objectifs / non-objectifs

**Objectifs**
- N'importe quel `prop` (décor du catalogue) peut être **interactif** (fouille/ramassage).
- **Un seul canal** `Effect[]` (le système d'Effets existant fournit déjà vrais objets/lettres/
  argent/XP/flags) + un drapeau **`consume`** (disparaît vs reste-une-fois).
- **Supprimer** le faux `loot:string[]` et le kind `objet` (migration au chargement).
- **Affordance** : décor interactif surligné + clic-à-distance → déplacement puis fouille.
- Combat « Ramasser » re-ciblé sur les `prop` interactifs.

**Non-objectifs (SP2 / hors périmètre)**
- Nouveaux sprites de décor (lettre, coffre, étagère, clé, bourse) — **sous-projet 2** (la
  mécanique marche déjà avec les décors existants : cadavre, charrette, épave).
- Fouille répétable / minuteries / serrures à crochetage — YAGNI.
- Refonte de l'inventaire party (`inventory: string[]` reste pour les handouts non-objets).

## 3. Modèle de données (`src/state/scene.ts`)

- **`EntityKind`** : retirer `'objet'` → `'heroStart' | 'personnage' | 'prop'`.
- **`SceneEntity`** : ajouter
  ```ts
  /** Décor INTERACTIF (fouille/ramassage). Absent = décor pur. */
  interact?: { effects: Effect[]; consume?: boolean };
  ```
  - `effects` : appliqués à l'interaction (une fois). `consume:true` → le décor disparaît quand
    pris ; sinon il reste, marqué fouillé (`__fouille_<id>`).
  - **Retirer** `loot?: string[]` et `search?: Effect[]`.

## 4. Migration (pure, testée)

`migrateSceneEntity(raw): SceneEntity` (`src/state/sceneMigrate.ts`), appliquée au **chargement**
de toute scène (loadProject / import / scènes de campagne) :
- `kind: 'objet'` → `'prop'` (et `pnj`/`ennemi` → `personnage`, comme `normalizeEntityKind` aujourd'hui).
- Construit `interact` depuis l'ancien : `effects = [...(raw.search ?? []), ...(raw.loot ?? []).map(item => ({ type:'giveItem', item }))]` ;
  `consume = !!raw.loot && !raw.search` (fidèle : loot disparaissait, search restait). Si `effects`
  vide → pas d'`interact`.
- Supprime `loot`/`search` du résultat.
Remplace/englobe `normalizeEntityKind` (`scene.ts:29-33`) ; appelée là où les scènes sont chargées.

## 5. Interaction — exploration (`src/state/store.ts`)

`interactEntity(id)` (aujourd'hui `:839-870`) généralisé aux `prop` avec `interact` :
- **Cible cliquable** = `prop` avec `interact` **ou** entité avec `dialogueId` (`IsoStage.tsx:433`).
- **Clic à distance** : si `chebyshev(partyPos, ent.pos) > 1`, au lieu de logguer « Trop loin »,
  poser `pendingInteract = id` et **déplacer le groupe** vers une case adjacente libre (réutilise
  `moveParty`/pathing). À l'arrivée (adjacent), déclencher l'interaction (cf. `pendingInteract`).
- **Déclenchement** (adjacent) : si pas déjà fait (`__fouille_<id>`) → `applyEffects(interact.effects)`,
  avancer le temps (`TIME_COST.search`), puis : `consume` → `removeEntity(id)` ; sinon poser le
  drapeau `__fouille_<id>`. Re-clic non-consommable → « rien de plus à trouver ».
- **Retour** : log + modale de lecture pour un effet `document` (déjà géré) ; ramassage → log.

`pendingInteract` : champ store (`string | null`), consommé à l'arrivée du groupe adjacent (dans le
flux `moveParty`/transition d'arrivée), puis remis à null. Annulé si le joueur clique ailleurs.

## 6. Combat (`battlePickup` / `entityPickables`)

Re-cibler de `kind==='objet'` (`store.ts:1588`) vers `prop` avec `interact`. `entityPickables(ent)`
(`combatFlow.ts:104-111`) lit `ent.interact.effects` : surface chaque `giveTrapping` (vrai objet),
`giveItem` (nom), `giveMoney`. À la prise (1 Action, adjacent) : applique l'effet, retire-le du pool ;
quand le pool est vide → `consume` retire le décor, sinon flag `__fouille_<id>`. Mêmes garde-fous.

## 7. Rendu + affordance (`pickBackend`, `IsoStage`)

- **`pickBackend`** : retirer la branche `objet` (le kind n'existe plus). `prop` → backend `sprite`
  (son `ref` de catalogue), inchangé.
- **Affordance** (`IsoStage`) : un `prop` avec `interact` reçoit un **halo doux pulsé** (dessiné,
  pas un carré — cf. direction visuelle) + `cursor:pointer`. Décor pur (`prop` sans `interact`) =
  inerte (pas de halo, pas de clic). Le handler de clic n'ouvre l'interaction que pour `interact`/`dialogueId`.

## 8. Éditeur (`src/ui/editor/Editor.tsx`)

- **Retirer `'objet'`** de `KINDS` (`:36`) → le bouton « Objet » disparaît.
- L'inspecteur **`prop`** (`:1380-1417`) garde `ref` (décor) + `foot`, et **gagne** :
  - case **« Interactif »** → révèle un `EffectList` lié à `interact.effects` (+ crée `interact:{effects:[]}` au toggle) ;
  - case **« Disparaît quand pris »** → `interact.consume`.
- Le bloc inspecteur **`objet`** (`:1361-1379`) est supprimé (migré vers prop).

## 9. Tests

- **Purs** : `migrateSceneEntity` (objet+loot+search → prop+interact, `consume` correct, effets
  concaténés, loot→giveItem) ; cas décor pur (pas d'`interact`).
- **Store/intégration** : `interactEntity` sur un prop interactif → effets appliqués, `consume`
  retire vs non-consume pose le flag une-fois ; clic-à-distance → `pendingInteract` posé.
- **Recette navigateur** : fouiller un **cadavre** existant (avec `giveTrapping` + `document`) ;
  prop `consume` (disparaît) ; clic à distance → déplacement → fouille ; combat « Ramasser » ;
  halo d'affordance visible sur les interactifs, absent sur le décor pur. 0 erreur console.

## 10. Découpage

- **SP1 (ce spec) — Mécanique** : §3-§9. Data + migration + interaction + affordance + combat +
  éditeur. Livrable seul (marche avec les décors existants).
- **SP2 — Sprites** (spec séparé) : nouveaux décors `lettre`, `bourse`/`piece`, `cle`, `coffre`,
  `etagere` via le workflow sprites best-of-N. Étend SP1, ne le bloque pas.

## 11. Risques

- **`move-to-interact`** (§5) = le morceau le plus délicat : brancher `pendingInteract` sur
  l'arrivée du groupe sans casser le flux `moveParty`/transitions. À tester en recette.
- **Migration des scènes existantes** : `tome1-intro` & co utilisent peut-être `objet` (ex. corps
  de Lieberung). La migration doit être appliquée à TOUT chargement ; vérifier que le chapitre 2
  (butin par corps) reste fidèle (test d'intégration scénario existant).
- **`Editor.tsx`/`store.ts` partagés** (autre session active) : patchs ciblés + commits pathspec.
- **Suppression de `loot`/`search`** : grep tout le repo pour les usages avant de retirer les champs.
