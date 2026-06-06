# Design — Maladresses (fumbles) au combat

*Spec, 2026-06-06. Reliquat du Jalon 1 (« Profondeur des règles de combat »).*

## But

Implémenter les **Maladresses** au combat, miroir des Critiques déjà en place. Couche
**moteur pure + testée** d'abord, puis store et UI, en respectant l'invariante du projet
« s'il y a un jet, il y a une modale » et le principe « rien d'inventé : tout vient de la Source ».

Feature **isolée** de la couche rendu/rig (session parallèle en cours sur `gameIso/`/`rig/`) :
elle vit dans `src/engine/`, `src/data/`, `src/state/store.ts` et un nouveau composant UI.

## Source (verbatim, LDB version corrigée)

- `13 - Combat.md` l.180-184 : Critiques et Maladresses ; le Critique = **double réussi**.
- `12 - Tests.md` l.151-152 : règle optionnelle, applicable à tous les Tests (ici : périmètre **combat**).
- `14 - _GoBack.md` (pages PDF 162-165) :
  - l.53-54 : **« tout Test de combat qui est un échec et dont le résultat du jet est un double est une Maladresse »** → Tableau des Oups !
  - l.14-46 : **Tableau des Oups !** (1d100, 7 bandes).
  - l.56-57 : **Incident de Tir !** — arme à Poudre noire / mécanique / explosive + Maladresse **paire** (00, 88…) → raté d'allumage, explosion : tous les Dégâts à la Localisation du **Bras principal** (dé des unités = DR pour toucher), **arme détruite**.
  - l.48-51 : **Tests Opposés et Maladresses** — on peut faire une Maladresse *et l'emporter* (meilleur DR) ; on subit quand même l'Oups !. Donc le **défenseur** d'un Test opposé peut aussi faire une Maladresse.

### Détection

Une Maladresse = `isDouble && !success` sur un Test de combat. C'est le miroir exact du
Critique (`isDouble && success`, déjà calculé `combat.ts:279`). `isDouble` est déjà porté par
chaque jet (`TestResult.isDouble`, calculé `roll === 100 || roll % 11 === 0`).

## Architecture

Respecte la règle du dépôt : **moteur pur ↔ store ↔ UI/rendu**, dépendances jamais inversées.

### 1. Engine pur + testé

- **`combat.ts`** : ajouter `fumble: boolean` à `AttackResult`, dérivé `isDouble && !success`
  côté **attaquant** ET côté **défenseur** (un défenseur d'opposé peut fumble). Aucune
  modification du calcul des dégâts, de la localisation ou de l'Avantage.
- **`src/data/oups.ts`** (écrit-main **verbatim**, exactement comme `src/data/criticals.ts`) :
  `OUPS_TABLE: OupsEntry[]` — 7 entrées. Chaque entrée porte un `kind` discriminé (l'effet
  mécanique) + une `note` (texte canon). Encodage `00` = `max: 100` (convention `criticals.ts`).
- **`engine/oups.ts`** : `rollOups(combatant, weapon, alliesAtRange, rng) → OupsResolved`,
  table-driven, RNG **seedé**, calqué sur `rollCritical`. Gère l'**Incident de Tir** en
  priorité (si l'arme est à poudre/mécanique/explosive **et** le jet est pair). Renvoie un
  descripteur d'effet discriminé + un `log` ; n'**applique rien** (le store applique, comme
  pour les critiques).

### 2. Mapping du Tableau des Oups !

Principe : on applique l'effet mécanique **immédiat et modélisable** ; on **journalise** (sans
simuler) ce qui dépend d'un subsystème absent — **précédent établi** par les effets long-terme
des Blessures critiques (`criticals.ts` champ `note`, « journalisé mais NON simulé → Jalon 5 »).

| d100 | Effet canon (l.16-46) | `kind` | Traitement |
|---|---|---|---|
| 01-20 | Perd 1 Blessure, ignore BE + PA | `selfWound` | ✅ `wounds.current -= 1` (plancher 0, ignore BE+PA) |
| 21-40 | Arme abîmée (1 Dégât) **+ agir en dernier** au prochain Round | `weaponDamageActLast` | ✅ `actLastNextRound` ; durabilité d'arme **journalisée** (pas de subsystème de durabilité) |
| 41-60 | **−10** à l'Action au prochain Round | `actionPenalty` | ✅ `nextActionPenalty = 10` |
| 61-70 | Perd son prochain **Mouvement** | `loseMovement` | ✅ `loseNextMovement = true` |
| 71-80 | Perd sa prochaine **Action** | `loseAction` | ✅ `loseNextAction = true` |
| 81-90 | **Déchirure musculaire (Mineur)**, compte comme Blessure critique | `criticalWound` | ✅ `criticalWounds += 1` (compte pour le modèle de mort : critiques cumulées > BE) + trauma **journalisé** (→ Jalon 5, comme tout traumatisme) |
| 91-00 | Touche **1 allié au hasard à distance** (unités = DR) ; sinon **soi-même** → Sonné | `hitAlly` | ✅ si un allié est à portée : Blessure à un allié tiré au sort (unités du d100 = DR, localisation = jet inversé, réduction BE+PA standard) ; sinon `addCondition(self, 'Sonné')` |

**Incident de Tir !** (l.56-57), priorité sur le tableau si conditions réunies : `kind: 'misfire'`
— Dégâts au **Bras principal** (unités du d100 = DR), **arme détruite** (journalisée — pas de
durabilité), pas de tirage sur le Tableau des Oups !.

> Note de fidélité : « agir en dernier » et « arme à 1 Dégât » sont une **même** entrée canon ;
> on modélise la partie initiative (act-last), on journalise la partie durabilité. On n'invente
> aucune valeur — l'auto-blessure 91-00 réutilise le pipeline de dégâts existant (`applyHit`).

### 3. Store (`src/state/store.ts`)

Invariante **« un jet = une modale »** :

- Nouveau `pendingFumble: PendingFumble | null` (combattant, contexte arme, alliés à portée, jet,
  résultat). Flux : `fumbleRoll` (tire l'Oups!) → affichage → `fumbleConfirm` (applique l'effet,
  reprend le combat). **Pas de bouton Chance** : la Chance s'applique au Test *avant* qu'il ne
  devienne une Maladresse (relance d'un jet raté) ; une fois la Maladresse actée, l'Oups! est subi.
- **Héros** qui fait une Maladresse (attaque OU défense réactive) → ouvre `pendingFumble`
  (suspend la reprise de l'IA, comme `pendingDefense`/`pendingFateSave`).
- **Ennemi** qui fait une Maladresse → `rollOups` résolu **instantanément** + log (cohérent avec
  l'IA abstraite et la résolution instantanée des critiques/figurants).
- Nouveaux champs `Combatant` (engine `types.ts`) : `nextActionPenalty?: number`,
  `loseNextAction?: boolean`, `loseNextMovement?: boolean`, `actLastNextRound?: boolean`.
  **Consommation** :
  - `nextActionPenalty` : lu dans le chemin de résolution d'attaque (modificateur −N au Test),
    puis remis à 0 après usage.
  - `loseNextAction` / `loseNextMovement` : au début du tour du combattant (`advanceTurn` /
    `maybeRunEnemyTurn`), marque `acted`/`moved` comme déjà consommés et efface le flag + log.
  - `actLastNextRound` : au franchissement de Round (`advanceTurn` round boundary /
    `resolveRoundBoundary`), déplace l'id en fin de `battle.order` pour le Round suivant, efface le flag.

### 4. UI (`src/ui/`)

- **`FumbleModal.tsx`** calquée sur la modale d'attaque (`AttackModal`/styles `.roll-modal`).
  Affiche : « Maladresse ! » + jet d'Oups! (d100) + libellé de l'effet + `note` canon + bouton
  **Appliquer**. Branchée dans `CampaignView` à côté des autres modales (`pendingAttack`,
  `pendingDefense`, `pendingFateSave`…).

### 5. Tests

- `engine/oups.test.ts` : les **7 bandes** du tableau (RNG forcé sur chaque bande), Incident de
  Tir **pair** (déclenché) vs **impair** (tableau normal) vs **arme non-poudre** (pas d'Incident),
  91-00 **avec allié à portée** (touche l'allié) vs **sans** (Sonné sur soi).
- `engine/combat.test.ts` : détection `fumble` attaquant (double + échec) et **non**-fumble
  (double + succès = critique ; échec simple ≠ fumble) ; côté défenseur.
- `state/store.test.ts` : héros fumble → `pendingFumble` ouvert + IA suspendue ; `fumbleConfirm`
  applique et reprend ; ennemi fumble → résolu instantanément (pas de `pendingFumble`) ;
  consommation des flags prochain-Round (perte d'Action, −10, act-last).
- **Vérif navigateur** (Playwright, après le vert) : forcer une Maladresse (RNG seedé / scénario
  de test), voir la `FumbleModal`, appliquer, vérifier le log + l'effet ; `console` à 0 erreur.

## Hors périmètre (assumé)

- **Durabilité / réparation d'arme** (« arme subit 1 Dégât », arme détruite par Incident de Tir) :
  journalisé, non simulé — aucun subsystème de durabilité n'existe (cohérent avec les traumatismes).
- **Traumatisme Déchirure musculaire** (soin/guérison) : journalisé → Jalon 5, comme les autres traumatismes.
- **Maladresses hors combat** (règle optionnelle `12-Tests` l.151) : périmètre = combat uniquement.
- **IA** : un ennemi ne subit pas les effets « prochain Round » de façon élaborée — ils sont
  appliqués sur ses flags comme pour un héros, mais l'IA reste simplifiée (cohérent avec la dette assumée).

## Risques / points d'attention

- **Frontières de tour** : la consommation des flags prochain-Round touche `advanceTurn` et la
  résolution de fin de Round — code sensible (morts lentes, Destin, pré-emption). Tests store dédiés.
- **Défenseur héros qui fumble** sur une défense réactive : le `pendingFumble` doit s'enchaîner
  *après* `pendingDefense` sans casser la reprise de l'IA (`resumeEnemyTurn`).
- **Ordre `pendingFumble` vs critique/mort** : si l'attaque touche ET que l'attaquant fumble
  (impossible — un fumble est un échec, donc 0 touche), pas de collision. Le fumble du *défenseur*
  peut coexister avec une touche subie : appliquer la touche d'abord, puis l'Oups! du défenseur.

## Conventions respectées

- FR partout ; data FR ; aucune source VO.
- Moteur pur + testé ; store/UI en dépendent.
- Table verbatim de la Source, écrite-main comme `criticals.ts`.
- Commits propres : ne committer que mes fichiers (working tree partagé avec la session rig).
