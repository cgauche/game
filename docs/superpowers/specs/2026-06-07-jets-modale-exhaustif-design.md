# Spec — « Un jet = une modale », exhaustif + garde-fou

*2026-06-07. Rendre l'invariante **« si y'a un jet, y'a la modale »** vraie pour TOUS les jets
qu'un héros lance ou subit, et empêcher la régression par un test statique. Fait suite au constat :
Piétinement et Colère des dieux résolvaient en silence. Source de l'invariante : mémoire
`game-roll-modal-pattern`. RAW : Chance/Destin `ch.17`, Maladresses `14`, Critiques `18`, miscast `85`/sorts.*

## 1. But

Aucun jet aléatoire pertinent pour le joueur ne doit se résoudre en silence dans le journal : il
doit passer par une modale qui **montre le dé**. Deux familles :
- **Jet LANCÉ par le héros** (action qu'il déclenche) → modale **différée interactive** : Lancer →
  résultat → **Chance** (relance/+1 DR/Résilience) → Appliquer.
- **Jet SUBI / sur table sans agence** (conséquence, ennemi, entretien) → modale **témoin** : le dé
  est révélé, le joueur acquitte (pas de Chance — rien à décider).

Et : **un futur jet muet doit faire échouer un test** (anti-régression).

## 2. Audit complet des jets actuellement muets

Relevé des sites de tirage (`battleRng()`/`roll*`/`resolve*`) hors modale, par `grep` sur
`src/state/combatFlow.ts` + `src/state/store.ts` :

| Jet | Site | Catégorie |
|---|---|---|
| **Piétinement** | `resolveTrample` ← `applyTrample` ← `battleTrample` (action) | **Interactif** (action héros) |
| **Focalisation** | `resolveFocus` ← `focusSpell` (action) | **Interactif** (Test étendu héros) |
| **Colère des dieux / Incantation Imparfaite** | `rollMiscast` ← `applyMiscast` ← `applyCast`/`focusSpell` | **Témoin** (table, sur Maladresse) |
| **Coup dans le dos (Fuite)** | `resolveBackstabAttack` ← `disengageFlee` (action) | **Témoin** (subi) |
| **Test de Calme (Fuite)** | `rollTest` ← `disengageFlee` | **Témoin** (conséquence de Fuite) |
| **Coup Critique** | `rollCritical` ← `applyCriticalToTarget` ← `applyAttackResult` | **Témoin** (conséquence d'attaque) |
| **Assommante** | `opposedTest` ← `applyAttackResult` | **Témoin** (conséquence d'attaque) |
| **Initiative** | `c.initiative = … battleRng().int` ← `startCombat` | **Entretien** (début de combat) |
| **Hémorragie/poison/périodiques** | `endOfRound` ← `advanceTurn` (fin de Round) | **Entretien** (groupé) |
| **Test de mort (figurants)** | `tickDeath` ← franchissement de Round | **Entretien** (groupé) |

**Hors périmètre (jets internes IA, jamais « du » héros)** : choix de cible IA (sans RNG), jets
d'attaque/défense de l'IA déjà **figés et montrés** dans `pendingDefense`, Maladresses d'ennemi
(`resolveEnemyFumble`), balayage/piétinement IA instantané. La modale sert le **joueur** ; les
mécaniques internes de l'IA restent instantanées. (L'attaque d'un ennemi sur un héros **Surpris**
qui ne peut pas se défendre reste instantanée — pas de réaction possible ; sa touche/critique
éventuel passe par la file de révélation comme toute conséquence.)

## 3. Décisions de conception

| Sujet | Décision |
|---|---|
| Interactif vs témoin | **Interactif** = jet que le héros *déclenche* et peut influencer par Chance (Piétinement, Focalisation). **Témoin** = jet subi/sur table, sans Chance (Colère, Critique, Assommante, coup-dans-le-dos, Calme de Fuite, entretien). |
| Différé vrai vs révélation post-hoc | Les jets **interactifs** et **Colère** sont **différés vrais** (Lancer *avant* de tirer ; le site de tirage est unique et suspendable). Les conséquences enfouies dans `applyAttackResult` (Critique, Assommante) et l'entretien de Round sont **révélées post-hoc** via une **file de révélation** : le tirage (graine fixe) a déjà eu lieu, la modale **montre le dé** puis acquitte. Évite de rendre `applyAttackResult`/`resolveRoundBoundary` suspendables (≈ 6 sites d'appel, boucles IA async) — même UX, refacto bien moindre. |
| Sérialisabilité | États `pending*` et entrées de révélation **data-only** (pas de closures) — préserve le RNG seedable / future coop (`CLAUDE.md`). La logique reste dans les actions `*Roll`/`*Confirm` et un `dispatch` par `kind`. |
| Entretien groupé | Initiative, hémorragies, poisons, tests de mort : **une seule** entrée de révélation « bilan » par franchissement (pas une modale par tic — sinon injouable). |
| Suspension de l'IA | Quand une révélation est en attente, l'avancement de l'IA est **gelé** (comme `pendingFateSave`/`pendingFumble`), repris à l'acquittement. |

## 4. Architecture & composants

### 4.1 Modales différées interactives (motif `pending*` existant)
- **`PendingTrample { attackerId, targetId, result: AttackResult|null, rerolled? }`** + actions
  `battleTrample` (ouvre, garde : plus grand/adjacent/≥1 Avantage), `trampleRoll` (`resolveTrample`),
  `trampleReroll`/`trampleBonusSL`/`trampleForceSuccess` (Chance), `trampleConfirm` (dépense 1
  Avantage + `applyAttackResult`, gratuit), `trampleCancel`. Modale `TrampleModal` (réutilise
  `ChanceButtons`/`ResilienceButton`).
- **`PendingFocus { casterId, spellLabel, result: FocusResult|null, rerolled? }`** + `battleFocusSpell`
  (ouvre), `focusRoll` (`resolveFocus`), `focusReroll`/`focusBonusSL` (Chance), `focusConfirm`
  (cumule le DR, consomme l'Action), `focusCancel`. Modale `FocusModal`.

### 4.2 File de révélation témoin (unifiée)
- **`pendingReveals: RevealEntry[]`** dans `GameState`. `RevealEntry = { kind: 'miscast'|'critical'|'assommante'|'backstab'|'calme'|'round', title: string, dice?: number, lines: string[] }`.
- Composant unique **`RevealModal`** : affiche `pendingReveals[0]` (titre + dé + lignes), bouton
  **Continuer** → `dismissReveal()` (dépile la tête, puis reprend l'IA si la file est vide).
- **Producteurs** : `applyMiscast` (Colère/Imparfaite), `applyCriticalToTarget` (Critique),
  l'Assommante dans `applyAttackResult`, `disengageFlee` (coup-dans-le-dos + Calme), le
  franchissement de Round dans `advanceTurn` (entrée « bilan »). Chacun **pousse** une entrée au
  lieu de seulement journaliser.
- **Gel IA** : `advanceTurn`/`maybeRunEnemyTurn`/`resumeEnemyTurn`/`resolveRoundBoundary`
  court-circuitent si `pendingReveals.length` (repris par `dismissReveal`).
> Colère des dieux : implémentée en **différé vrai** si trivial (site unique `applyCast`/`focusSpell`)
> — sinon poussée dans la file témoin comme les autres. Choix tranché à l'implémentation selon le
> coût ; l'UX (le dé est montré) est identique.

### 4.3 Garde-fou statique (anti-régression — le livrable clé)
Test `src/state/roll-modal-invariant.test.ts` :
- Lit le **texte source** de `store.ts`, extrait chaque **action du store** (propriété-fonction de
  `useGame`).
- **Échoue** si le corps DIRECT d'une action **non whitelistée** appelle une **primitive de
  résolution** (`battleRng(`, `rollTest(`, `rollOups(`, `rollMiscast(`, `rollCritical(`,
  `resolveTrample(`, `resolveFocus(`, `resolveBackstabAttack(`, `resolveMelee(`, `resolveRanged(`,
  `resolveCasting(`, `resolveMagicMissile(`, `opposedTest(`, `applyTrample(`, `applyMiscast(`).
- **Whitelist** = les résolveurs différés légitimes (`*Roll`, `*Reroll`, `*BonusSL`,
  `*ForceSuccess`, `*Confirm`, plus l'entretien `dismissReveal`). Le corps des actions délègue
  sinon à un helper `combatFlow` (qui, lui, est hors périmètre du scan store) → pas de faux positif
  (vu : `battleDisengage`→`startDisengage`).
- Message d'échec explicite : « `<action>` résout un jet en ligne — ouvre une modale `pending*` (ou
  pousse une révélation), ou ajoute-la à la whitelist avec justification. »
- Complément **comportemental** : pour chaque jet, un test affirme que l'action ouvre le
  `pending*`/pousse une révélation **sans** consommer le RNG (compteur sur un `battleRng` espionné),
  le tirage n'arrivant qu'au `*Roll`/à la production de la révélation.

## 5. Périmètre — Lot A (pushé) puis Lot B (enchaîné)

- **Lot A** (commit + push) : garde-fou statique + **Piétinement** (interactif) + **Focalisation**
  (interactif) + **Colère/Incantation Imparfaite** + **Fuite** (coup-dans-le-dos + Calme). Le Lot B
  est **whitelisté temporairement** (`// TODO Lot B`) pour passer au vert.
- **Lot B** (enchaîné) : file de révélation branchée sur **Coup Critique** + **Assommante** +
  **entretien de Round groupé** (initiative, hémorragie, mort) ; retrait des entrées de whitelist
  temporaires ; gel IA sur `pendingReveals`.

## 6. Plan de tests (TDD)
- `roll-modal-invariant.test.ts` : (a) statique — aucune action non-whitelistée ne résout en ligne
  (écrit en PREMIER, rouge sur l'état actuel, pilote le périmètre) ; (b) comportemental par jet.
- `trample.test.ts` / `focus.test.ts` : `battleTrample`/`battleFocusSpell` ouvrent le pending sans
  tirer ; `*Roll` tire ; `*Reroll` dépense 1 Chance ; `*Confirm` applique (Piétinement gratuit, coût
  1 Avantage ; Focalisation cumule le DR + consomme l'Action).
- `miscast` : un Sort/Prière en Maladresse pousse une révélation/ouvre `pendingMiscast` et applique
  les effets à l'acquittement.
- `flee` : `disengageFlee` pousse coup-dans-le-dos + Calme en révélation ; effets (Brisé) appliqués.
- `reveal-queue` (Lot B) : un Critique/Assommante pousse une entrée ; `dismissReveal` dépile et
  reprend l'IA ; le franchissement de Round pousse UNE entrée bilan.
- Régression : suite complète verte ; les modales existantes (attaque/défense/sort/test/reload/
  désengagement/Oups!) inchangées.

## 7. Isolation session rig
`store.ts`/`combatFlow.ts` partagés et activement édités par la session rig → commits par **staging
sélectif de hunks** (recette `git-commits-propres-wip-parallele`). Nouvelles modales = fichiers à moi
(`TrampleModal.tsx`/`FocusModal.tsx`/`RevealModal.tsx`) + `CampaignView.tsx` (montage). Tests en
fichiers neufs. Pas de modale IA (instantané préservé).

## 8. Self-review
- **Placeholders** : aucun ; le choix « Colère différé-vrai vs file » est borné (UX identique, tranché à l'implémentation selon coût).
- **Cohérence** : interactif↔Chance, témoin↔file ; gel IA aligné sur `pendingFateSave`. Sérialisable (pas de closures).
- **Périmètre** : Lot A finissable+pushable ; Lot B enchaîné ; entretien **groupé** (pas N modales).
- **Frontière** : garde-fou scanne les **actions store** (déléguer à `combatFlow` reste permis) → cible la vraie régression (action qui résout en ligne) sans faux positif.
