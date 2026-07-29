# Ajouter un flux de jet (« une situation = une modale »)

Tout jet différé (Piétinement, Course, Focalisation, Soin, Test de compétence, Marchandage…) suit
le MÊME cycle de vie et passe par la MÊME fabrique. **Aucun flux ne recode la mécanique
(RNG/Chance/Résilience/Résistance) dans son propre closure** — il ne déclare que sa FORME. Ce guide
couvre : où poser le pending, écrire la spec (`RollFlowSpec`), câbler le store, paramétrer
`RollShell`, et les gardes qui vérifient tout ça.

## 0. Le cycle de vie (rappel)

```
ouvrir (pending posé) → Lancer (roll) → Chance : relancer (reroll, jet propre raté, 1× max)
  ou +1 DR (bonusSL, LDB 17 l.26/84) → Sombre Pacte (darkPact, +1 Corruption, héros only)
  → Résilience « Je ne faillirai pas ! » (forceSuccess/setForcedRoll, LDB 17 l.68)
  → Résistance (Menace) (resist, LDB 10 l.1015-1021, sur slot tagué `menace`)
  → Appliquer (xConfirm) / Annuler (xCancel)
```

Source unique : `src/state/rollFlowFactory.ts` (fabrique `makeRollFlow`). Elle centralise TOUTE la
plomberie (gardes, dépense de points, patch de re-rendu) ; le flux ne fournit que `resolve`/
`outcome`/`lens`/`caps`/`bonus`. **`Appliquer` (`xConfirm`) reste écrit à la main dans le store** —
ses effets sont tous différents, c'est la règle métier, pas la plomberie.

## 1. Un nouveau jet = 1 spec + 1 xConfirm

Étapes concrètes (calquer un flux voisin proche : `FLOWS.trample`/`FLOWS.run`/`FLOWS.heal` selon la
forme du Test — cf. §2) :

1. **Type du pending** dans `src/state/pendings.ts` (ou co-localisé si le flux est petit) :
   `PendingX extends PendingBase` (champs `rerolled?`/`forced?`/`menace?` hérités). Champ de résultat
   `result: {...} | null` (ou `roll`/`target`/`sl`/`success` À PLAT si le Test est simple — cf.
   `flatRollLens`). Déclarer `pendingX: PendingX | null` dans `GameState` (store.ts).
2. **Entrée dans `FLOWS`** (`src/state/rollFlowSpecs.ts`) : `x: makeRollFlow<PendingX>({ key:
   'pendingX', rolled, actor, resolve, outcome, … })`. Réutiliser les fabriques PARTAGÉES plutôt que
   ré-écrire (§3) : `simpleTestResolve`/`simpleTestResultResolve` pour un Test simple, `testOutcome`/
   `rollOutcome`/`cleanRollOutcome` pour l'issue, `flatRollLens`/`resultRollLens` pour la lentille de
   dérivation, `opposedBinaryFlow` pour un Test opposé binaire calqué (Désengagement/Au Contact/
   Empoignade/Distraire).
3. **Entrée dans `FLOW_VERBS`** (même fichier, ~ligne 1441) : `x: { kind: 'mono'|'multi', verbs: […],
   coop?: true }`. C'est la SOURCE UNIQUE du type ET du runtime — `RollFlowActionsMap` (dérivé) et
   `GameState extends RollFlowActionsMap` rendent l'ajout/retrait d'un verbe ici **bidirectionnel** :
   oublier une entrée casse `tsc`. Ajouter aussi `x: FLOWS.x` dans `FLOW_HANDLERS` (juste en dessous,
   ~ligne 1482) — `satisfies Record<keyof typeof FLOW_VERBS, …>` force l'exhaustivité.
4. **`xConfirm` / `xCancel` écrits à la main** dans `src/state/combatSlice.ts` (ou `combatManeuvers.ts`
   / `merchantFlow.ts`/`partyFlow.ts` hors combat selon le domaine) : lit `pendingX.result`, applique
   les EFFETS métier (via `GameOp`/`applyOps` si l'effet est un octroi/soin/dégât — cf. § « Objets =
   vocabulaire unifié » de `CLAUDE.md`), nulle `pendingX`, ferme/avance la cascade-hôte si le jet est
   une étape de `pendingCascade` (`advanceCombatJet`/`advanceCascade` — jamais une 2ᵉ fenêtre séparée,
   cf. §4). `xCancel` : soit le teardown par défaut de la fabrique (`spec.onCancel` absent → nulle
   `pendingX` + `pendingCascade`), soit un undo métier explicite (ex. `attack.onCancel` défait la
   charge misclic AVANT le jet — `rollFlowSpecs.ts` ~l.398).
5. **Ouvrir le pending** depuis le site d'origine (hotbar/IA/déclencheur) : poser `pendingX` +, si le
   jet est une étape de combat, `startCascade(get, set, { steps: [{ id, kind: '<x>Jet', jet: 'x',
   actorId }] })` (calquer `battleTrample`, `combatSlice.ts` ~l.738-751).
6. **Registre des modales** (`src/state/modalArbiter.ts`, `MODAL_DEFS`) — SEULEMENT si le flux N'EST
   PAS une étape de la cascade `combat`/`cascade` générique (celles-ci passent déjà par l'entrée
   `cascade`). Ajouter `{ key: 'x', when: (s) => !!s.pendingX, owner: (s) => s.pendingX?.actorId, auto:
   {...} }` — `auto` est REQUISE (politique Cadence : `self` pour un jet propre, `choice` pour un vrai
   choix, `partial` pour une cascade, `hostOnly` hors-combat). Puis enregistrer le composant dans
   `COMPONENT` (`src/ui/ActiveModal.tsx`).

## 2. La modale = `RollShell` paramétrée (jamais de mécanique recodée)

`RollShell` (`src/ui/RollShell.tsx`) est LA coquille unique : overlay → titre → sous-titre →
instruction → extra → setup (pré-jet) → rangées (`RollRow`) → outcome/summary → postRollExtra →
forcedExtra → `.modal-actions`. Écrire un hook `use<Jet>JetProps` (`src/ui/jetProps/`,
calquer `useTestJetProps.tsx`) qui lit le store et rend les PROPS de `RollShell` —
la modale elle-même (`<Jet>Modal.tsx`, cf. `RunModal.tsx`) ne fait qu'appeler le hook et rendre
`<RollShell {...props} />` (ou `null`). Une étape de cascade (jet de combat) passe par `CascadeModal`
qui rend directement le hook, sans démonter la coquille entre le jet et son Coup Critique.

- **Contrôles en props, métier en slots** : `extra`/`setup`/`postRollExtra`/`forcedExtra` reçoivent du
  JSX métier (portraits, choix d'arme/localisation, Surincantation…) ; TOUT le reste (Lancer/Chance/
  Pacte/Résilience/`<Dice>`) est géré par la coquille. Ne jamais réécrire un bouton « Lancer »/
  « Relancer » à la main dans une modale — passer par `RollRowData.onRoll`/`onReroll`/`onBonusSL`/
  `onForce`/`onDarkPact`.
- **`rows: RollRowData[]`** : mono = 1 rangée ; opposé = 2 (1 interactive + 1 témoin `interactive:
  false`) ; multi = N + `summary` optionnel.
- **`caps.picker`** (dé forcé PARTAGÉ) : si le flux offre le CHOIX du dé de Résilience (attaque/
  défense/incantation/piétinement…), `caps.picker(slot, actor)` renvoie `{ roll, target, critable? }`
  ou `null` — lu par le hook (`FLOWS.x.picker?.(p, actor)`) et posé sur `RollRowData.forcedRoll =
  { ...picker, onSet: setForcedRoll }`. Rendu par le sélecteur PARTAGÉ `ForcedRollPicker` (UI). Un
  flux BINAIRE (pas de choix du dé, juste « l'emporter ») n'expose pas `picker`.

## 3. Le résolveur porte les TROIS cas de résolution forcée

`spec.resolve(s, slot, actor, get, forced?, p?)` est **UN SEUL résolveur** pour tout : `forced`
absent = jet normal (RNG) ; `forced === {}` = `forceSuccess` (Résilience, dé PAR DÉFAUT — `01` en
standard, le plus haut valide en Fast DR, via `bestForcedRoll(target)`, JAMAIS `evaluateTest(1, …)`
en dur) ; `forced === { roll: n }` = `setForcedRoll` (Résilience, dé CHOISI par le joueur — doit
RESTER une réussite) ; `forced === { sl: n }` = `resist` (Résistance (Menace) — DR IMPOSÉ = Bonus
d'Endurance, PAS de choix du dé). Un flux qui ne pose pas `caps.forced` n'offre simplement pas la
Résilience (les branches `forced`/`{}`/`{roll}` sont des no-op). `caps.resist` n'est offert QUE sur
un slot tagué `menace` (posé par le SITE qui ouvre le pending).

**Réutiliser une lentille (`RollFlowLens`) avant d'écrire les branches à la main** : `flatRollLens`/
`resultRollLens` (Test simple, jet à plat ou sous `result`) composent `bonusSL`/`forceSuccess`/
`setForcedRoll`/`resist` DEPUIS `actorTR`/`applyRoll`/`dieTarget` — un flux qui fournit `lens` n'a
plus besoin d'écrire ses branches `forced`/`bonus` à la main (repli byte-identique sinon).
`opposedBinaryFlow` fait de même pour un Test opposé binaire calqué (foe FIGÉ).

Atomes OBLIGATOIRES (gardés par `rollflow-no-drift.test.ts`, §5) : `bumpSL(tr)` pour Chance « +1 DR »
(ne touche jamais `success` — LDB 17 l.84 : un Degré de plus ne transforme pas un échec en réussite),
`bestForcedRoll(target)` pour le dé forcé par défaut (policy-aware Fast DR), `forcedTR(roll, target,
sl)` pour construire un `TestResult` de réussite forcée (jamais un littéral `{ success: true, …,
isDouble: isDoubleRoll(r) }` recopié), `hydrateTR(detail)` pour ré-hydrater un `TestResult` depuis un
détail stocké.

## 4. Interdits

- **Aucun `rollTest` inline sur le chemin JOUEUR.** Un Test qui affecte un combattant piloté-humain
  DOIT ouvrir un `pending*` influençable (Chance/Résilience/Résistance) — jamais résolu en silence
  dans un résolveur métier. Gardé par `src/state/maneuver-defense-cascade.test.ts` (garde « Surfaçage
  remonte-à-un-humain », choke-point = prédicat de contrôleur `humanControlled`/`pilotedByHuman`/
  `aiDriven` — jamais le `kind`) : chaque site de surfaçage connu (upkeep Round, Peur, Corruption,
  Test déclenché, défense réactive, défense de manœuvre de zone…) est vérifié STATIQUEMENT (référence
  le bon prédicat) puis BEHAVIORALEMENT (ouvre bien un `pending*`/une étape de cascade).
- **Aucune 2ᵉ fenêtre de conséquences.** Un jet et sa conséquence immédiate (Coup Critique, Coup
  Critique d'un Piétinement, Maladresse…) vivent dans LA MÊME modale (fold sur `pendingCascade` /
  `CascadeModal`, `advanceCombatJet`) — jamais une modale « Résultat » qui s'ouvre APRÈS la modale de
  jet refermée. Cf. commit `db7ca6c9` (« Piétinement MIGRÉ en étape de cascade — fin de la 2ᵉ fenêtre
  sur Critique »).
- **Aucune mécanique d'influence recodée localement** (dé forcé en dur, `+1 DR` qui force
  `success:true`, littéral `TestResult` recopié) — passer par les atomes du §3, gardé par
  `rollflow-no-drift.test.ts`.

## 5. Gardes

| Garde | Fichier | Vérifie |
|---|---|---|
| Source unique du câblage | `src/state/rollFlowWiring.test.ts` | `buildRollFlowActions` expose EXACTEMENT les délégués `<prefix><Verbe>` de `FLOW_VERBS` ; les verbes `coop` sont dans `COMBAT_INTENTS` (`net/intents.ts`) et réciproquement ; `resist` n'est JAMAIS un intent coop. |
| Anti-dérive de la mécanique | `src/state/rollflow-no-drift.test.ts` | Scan statique de `src/state` + `src/engine` : `bestForcedRoll` (jamais `evaluateTest(1, …)` en dur), `bumpSL` (jamais `success:true` forcé), `forcedTR` (jamais le littéral recopié), `hydrateTR` (jamais `isDoubleRoll(` dans `rollFlowSpecs.ts`), présence positive des 4 atomes. |
| Surfaçage remonte-à-un-humain | `src/state/maneuver-defense-cascade.test.ts` | Un Test d'un combattant piloté-humain (upkeep/psy/corruption/déclenché/défense/défense de zone) OUVRE toujours un `pending*` ; jamais résolu inline ; suit le contrôleur, jamais le `kind`. |
| Type bidirectionnel | `tsc --noEmit` (via `GameState extends RollFlowActionsMap`) | Ajouter/retirer un flux ou un verbe dans `FLOW_VERBS` sans réimplémenter dans `FLOW_HANDLERS`/le store casse la compilation. |
| Modales | `src/ui/active-modal.test.ts` | Registre `MODAL_DEFS`/`COMPONENT` cohérent (une modale déclarée a son composant, et réciproquement). |
| Régression métier | tests dédiés par flux (`trample.test.ts`, `resilience-die-choice.test.ts`, `rollflow-outcome-invariant.test.ts`…) | Comportement RAW du flux (jet, Chance, Résilience, dé choisi, issue canonique). |

Commande : `npm test` (Vitest) — `npx tsc --noEmit` après tout ajout de flux (le type dérivé casse
immédiatement si `FLOW_VERBS`/`FLOW_HANDLERS` divergent).
