# Spec — Harmonisation : annulation & barre d'actions des modales de jet

*2026-07-04. Suite directe de « Unifier les coquilles de modales de jet » (RollShell/RollRow, P0-P7).
Retour de jeu : la modale « Avantage — Savoir » n'a pas de « Annuler » alors que l'attaque/charge oui,
et « Lancer » n'est pas au même niveau que « Annuler ». Diagnostic : ce ne sont pas des bugs isolés
mais des **restes de non-unification** — deux systèmes divergents pour la même chose. Objectif : une
seule mécanique.*

## 1. Les deux divergences (vérifiées au code)

Tous les jets différés sont le **même** mécanisme : un flux `makeRollFlow` (`rollFlow.ts:253`) rendu
dans une **cascade à une étape** (`pendingCascade` + `pendingX`), affiché par `RollShell`. Pourtant :

**D1 — Annulation câblée à la main, flux par flux.**
- La fabrique génère bien un `cancel` (`rollFlow.ts:323`) mais il **nulle juste le pending** — pas la
  cascade hôte.
- `attackCancel` (`combatSlice.ts:1942`) est **bespoke** : ferme le pending + la cascade **et défait la
  charge** (positions/Mouvement/Avantage, golden `charge-undo.test.ts`).
- `defenseCancel` est **bespoke** aussi (+ reprise du tour IA, `resumeEnemyTurn`).
- Le flux `test` **omet `cancel`** de sa liste `rollFlowActions` (`store.ts:1847/1864`) → **aucun
  `testCancel`** ; `resolveTest` (`store.ts:1919`) ferme bien « les deux » mais il n'y a pas de pendant
  côté annulation.

**D2 — Barre d'actions assemblée par chaque hook.** Chaque `useXxxJetProps` fabrique son `actions:
RollAction[]` à la main (ex. `useTestJetProps` : `[{confirm 'Continuer' post}]`, sans Annuler ;
`useAttackJetProps` : `[Annuler pre, Appliquer post]`). Et `onRoll` vit sur la **rangée** → « Lancer »
se rend dans `.prow-act` (dans la rangée), pas dans `.modal-actions` avec Annuler.

## 2. Design — une seule mécanique

### A. Un chemin d'annulation unique (cascade-aware + undo déclaré)

- **`makeRollFlow.cancel` devient cascade-aware** : exécute un `spec.onCancel?(get, set, p)` optionnel
  (undo métier) PUIS `set({ [spec.key]: null, pendingCascade: null })`. Nuller `pendingCascade` est un
  no-op quand le flux est autonome (pending sans cascade) et correct quand il est l'étape d'une cascade
  (garanti par l'arbitre : une seule modale active → toute `pendingCascade` présente est SON hôte).
- **`spec.onCancel` porte l'undo métier** : `FLOWS.attack.onCancel` = défaire-charge (l'actuel corps de
  `attackCancel`) ; `FLOWS.defense.onCancel` = reprise IA. Les actions store bespoke `attackCancel`/
  `defenseCancel` sont **SUPPRIMÉES** → remplacées par le `cancel` uniforme de la fabrique.
- **`caps.cancellable`** déclare qu'un flux expose « Annuler » (et donc que le bouton se rend). Gardé
  **pré-jet** (l'Annuler n'apparaît que `when:'pre'` — après le jet la charge est engagée, cohérent avec
  le garde-fou existant `store.test.ts:933`).
- **`test`** : ajoute `cancel` à sa liste `rollFlowActions`, `caps.cancellable: true`, pas d'`onCancel`
  (l'Action n'est dépensée qu'à `resolveTest` → annuler avant le jet ne rembourse rien, referme juste).
  Les **tests de dialogue/scène** (branches `onSuccess`/`onFailure`) restent non annulables : la
  cancellabilité est portée par le **déclencheur** (le pending pose `cancellable` — combat oui, dialogue
  non), pas par le flux en dur.

### B. Un modèle de barre d'actions unique

- **Dérivation partagée** (helper, ex. `standardRollActions(handlers)` près de `rollFlow`/`breakdown`) :
  produit les boutons standard de TOUTE modale de jet — pré-jet **Lancer** (dans `.modal-actions`) +
  **Annuler** (si `cancellable`), post-jet **Appliquer/Continuer**. Chaque hook la **consomme** au lieu
  d'assembler `actions` à la main ; il ne fournit que les extras spécifiques.
- **« Lancer » dans la barre pour le mono.** Quand il y a **une seule rangée interactive non lancée**,
  `RollShell` rend « 🎲 Lancer » comme action pré-jet dans `.modal-actions` (à côté d'Annuler) ; la
  `RollRow` cesse d'afficher son Lancer inline (prop `rollInBar`/détecté par le shell). Le **frisson**
  ~480 ms est préservé en extrayant le wrapper d'animation de `RollRow.doRoll` en helper partagé
  (`useRollFrisson`) utilisé par le bouton de barre (mono) ET par la rangée (multi) → zéro dup.
- **Multi inchangé** : chaque rangée garde son « Lancer » + « Tout lancer » dans la barre (chaque
  participant lance SON jet).

## 3. Périmètre & phasage (chaque phase : typecheck + eslint + golden verts)

- **P1 — Annulation unifiée (état).** `rollFlow.ts` (cancel cascade-aware + `onCancel` + `caps.cancellable`) ;
  migrer `attackCancel`→`FLOWS.attack.onCancel`, `defenseCancel`→`FLOWS.defense.onCancel` (supprimer les
  actions bespoke) ; wirer `cancel` sur tous les flux via `rollFlowActions`. Golden : `charge-undo`,
  défense, `cascade`, `roll-modal-invariant`, + suites attaque/défense.
- **P2 — Cancellabilité des tests de combat.** `test` : `caps.cancellable` + `cancel` wiré ; le pending
  `pendingTest` porte `cancellable` posé par `battleGainAdvantage`/Battement/Distraire (combat), pas par
  les tests de dialogue. `useTestJetProps` expose « Annuler » quand `cancellable`. Golden : flux test,
  `cascade`, combat-advantage, roll-modal-invariant.
- **P3 — Barre unique + Lancer dans la barre (UI).** Helper `standardRollActions` + `useRollFrisson` ;
  `RollShell` hisse « Lancer » (mono) ; `RollRow` `rollInBar` ; tous les hooks/modales consomment la
  dérivation. Golden : `RollShell`, tests `*View` (Reload/Bargain/Appraise), `roll-modal-invariant` ;
  **vérif navigateur** au clavier (`__wfrp.pad`) : attaque + Avantage — Savoir (Annuler + Lancer dans la
  barre), un multi (Lancer par rangée conservé).

## 4. Pièges
- `charge-undo` : préserver EXACTEMENT la restauration (positions/Mouvement/Avantage/+1 charge) en la
  déplaçant dans `onCancel` — golden `charge-undo.test.ts` = filet.
- Défense : `defenseCancel`→`onCancel` doit garder la reprise IA (`resumeEnemyTurn`, `combatFlow.ts:4951`).
- `cancel` gardé **pré-jet** (une charge rôlée est engagée). L'Annuler `when:'pre'` le garantit côté UI.
- Frisson : `useRollFrisson` doit honorer `prefers-reduced-motion` (comme l'actuel `RollRow.doRoll`).
- Arbitre de modale : nuller `pendingCascade` au cancel ne doit pas fermer une cascade multi-étapes en
  cours par erreur — à VÉRIFIER (une cascade de nuit/voyage à plusieurs étapes ne passe pas par un
  `caps.cancellable` de combat ; l'Annuler n'est offert que sur les flux qui le déclarent).

## 5. Non-buts
- Ne PAS toucher la logique métier des undo (charge/IA) — seulement la DÉPLACER dans `onCancel`.
- Ne PAS rendre les tests de dialogue annulables (laisserait le dialogue en suspens).
- Ne PAS changer le multi (Lancer par rangée est intrinsèque).
