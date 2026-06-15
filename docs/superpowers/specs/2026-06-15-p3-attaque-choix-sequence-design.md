# P3 — Folder les CHOIX d'attaque (dévier / piège-lame) dans la séquence — Design

*2026-06-15. Tranche P3 de l'épopée « conséquences d'un jet dans la modale » (P0→P2 livrés).*

## Acquis

- **P0/P0.5** : moteur de séquence (étapes **jet / choix / affichage**) + rendu (OptionChooser pour
  les choix, lignes/`CriticalBody` pour l'affichage).
- **P1** : conséquences de magie (imparfaite/colère) inline.
- **P2** : conséquences d'attaque (Critique riche, Assommante, états) routées INLINE via `pushReveal`
  (`combatEffects.ts`) → séquence `purpose:'combat'` ; gel/reprise de l'IA alignés sur `pendingCascade`
  (`resumeSuspendedAI`). La **défense** est couverte (un héros qui SUBIT un critique passe par le même
  `pushReveal`).

P3 ferme le « **Tout, choix compris** » : les deux modales de CHOIX interactives — **Déviation
Critique** (`pendingDeviation`) et **Piège-lame** (`pendingBladeTrap`) — deviennent des **étapes de
choix** de la séquence. Bénéfice : l'attaque d'un héros ARMÉ (critique + Assommante + déviation) tient
dans **une seule** modale au lieu d'éclater en plusieurs.

## État actuel (carte)

- **Déviation** : `applyAttackResult` (combatFlow.ts ~1095), sur un critique à un héros, **pré-tire** le
  Critique (graine figée), pose `pendingDeviation { attackerId, targetId, weapon, res:AttackResult,
  crit:CriticalResolved, reveal:RevealEntry, resumeAfter }` et **suspend** (`return true`).
  `deviationApply(deviate)` (store ~3168) ré-invoque `applyAttackResult(..., deviate, deviate?undefined
  :pdv.crit)` puis `autoCleave`, contrôle `defenderFumbled` (→ `pendingFumble`), puis `resumeEnemyTurn`.
  `DeviationModal` = `CriticalBody(reveal)` + `ChoiceButtons(Subir/Dévier)` (Dévier désactivé si 0 PA).
- **Piège-lame** : `applyAttackResult` (~1168) sur une parade en double d'un héros avec arme Piège-lame
  pose `pendingBladeTrap { defenderId, attackerId, weapon, parryWeaponName, defSL, roll }` (scalaires).
  `resolveBladeTrap(trap)` (combatFlow ~3188) : `crit` → `applyOpposedCritical` ; `trap` → Test opposé de
  Force ; puis `pushReveal('assommante')` + `resumeEnemyTurn`. `BladeTrapModal` = texte + `ChoiceButtons`.
- **`CascadeStep`** porte déjà un OBJET (`reveal:RevealEntry`, JSON-sérialisable) + `options/chosen/
  defaultChoice` (étape choix, P0). `CriticalResolved`, `PendingDeviation`, `PendingBladeTrap` sont tous
  **JSON-sérialisables** (données plates, aucune fonction) → portables sur l'étape, coop-safe.

## Décision-clé : porter le payload du pending sur l'étape (pas de re-dérivation RNG)

Le problème supposé (« `meta` ne prend que des scalaires, le `CriticalResolved` est un objet ») est levé :
`CascadeStep` porte DÉJÀ `reveal` (objet). On ajoute deux charges OPTIONNELLES, typées, JSON-sérialisables :

```ts
// CascadeStep (pendings.ts) — charges des étapes de CHOIX de combat (réutilisent les pendings existants) :
deviation?: PendingDeviation;   // étape 'deviation' : Critique pré-tiré + res/weapon pour la résolution
bladeTrap?: PendingBladeTrap;   // étape 'bladeTrap' : scalaires (defSL, roll, noms)
```

Coup pré-tiré CONSERVÉ tel quel (ce qu'on montre = ce qu'on subit) — **aucune re-dérivation RNG**
(fragile : le RNG a déjà avancé). Couplage `CascadeStep`↔types combat accepté : tous co-localisés dans
`pendings.ts`, pragmatique (comme `reveal`).

## Architecture

### 1. Résolveurs réutilisables (combatFlow) — extraits des actions store

- `resolveDeviation(get, set, dev: PendingDeviation, deviate: boolean, opts: { resume: boolean })` :
  CORPS actuel de `deviationApply` SANS la lecture de `pendingDeviation` ni la reprise forcée. Applique
  le Critique (`applyCriticalToTarget(..., dev.crit, suppressReveal=true)`) ou la déviation
  (`deviateArmour`), `autoCleave`, et le contrôle `defenderFumbled` (→ `pendingFumble`). Reprend l'IA
  **uniquement si `opts.resume`**.
- `resolveBladeTrap(get, set, trap: PendingBladeTrap, doTrap: boolean, opts: { resume: boolean })` :
  idem — corps actuel SANS la lecture du pending ni la reprise forcée.
- Les actions store existantes (`deviationApply`, `bladeTrapResolve`) appellent ces résolveurs avec
  `{ resume: true }` (chemin modale autonome, INCHANGÉ — compat ascendante).

### 2. Pose en ÉTAPE DE CHOIX (combatFlow)

À l'endroit où `applyAttackResult` posait `pendingDeviation`/`pendingBladeTrap`, on pousse à la place une
ÉTAPE DE CHOIX dans la séquence combat (helper `pushCombatChoice(set, step)` analogue au routage P2) :

- **Déviation** : `{ id, kind:'deviation', actorId:targetId, icon:'💥', label:'Coup Critique — dévier ?',
  options:[{key:'devier',label:'🛡️ Dévier (−1 PA)'},{key:'subir',label:'Subir'}], deviation:<payload>,
  reveal:<payload.reveal> }`. `applyAttackResult` **suspend toujours** (`return true`) — la suite (autoCleave/
  fumble/reprise) part du résolveur via l'applier, et la reprise via la **fermeture de séquence** (P2).
- **Piège-lame** : `{ id, kind:'bladeTrap', actorId:defenderId, icon:'🗡️', label:'Parade — piéger la lame ?',
  options:[{key:'trap',label:'🗡️ Piéger'},{key:'crit',label:'💥 Coup Critique'}], bladeTrap:<payload> }`.

### 3. Appliers (combatFlow, registre `cascadeAppliers`)

```
registerCascadeApplier('deviation', (get, set, step) => {
  if (!step.deviation) return;
  resolveDeviation(get, set, step.deviation, step.chosen === 'devier', { resume: false }); // reprise = fermeture séquence
  return; // les lignes sont journalisées par le résolveur (battle.log) ; l'étape garde son affichage via reveal/outcome
});
registerCascadeApplier('bladeTrap', (get, set, step) => {
  if (!step.bladeTrap) return;
  resolveBladeTrap(get, set, step.bladeTrap, step.chosen === 'trap', { resume: false });
});
```

`resume:false` : la reprise de l'IA est gérée par `cascadeNext`/`cascadeFinish` (`purpose:'combat'` →
`resumeSuspendedAI`, déjà en place P2). **Pas de double reprise.** Le `pendingFumble` posé par le résolveur
COEXISTE avec la séquence (arbitre : `fumble` (idx 1) > `cascade` (idx ~24) → le fumble s'affiche d'abord,
puis la séquence reprend) — acceptable en P3 (folder le fumble = hors périmètre).

### 4. Rendu (CascadeModal) — étape de choix AVEC critique riche

L'étape `'deviation'` est une étape de CHOIX qui porte AUSSI une charge `reveal` (le Critique) : on combine
le panneau riche `CriticalBody` ET l'`OptionChooser`. Dans la branche `interaction === 'choix'` :
- si `cur.reveal?.kind === 'critical'` → rendre `<CriticalBody entry={cur.reveal} …/>` AVANT l'`OptionChooser`
  (Dévier/Subir) ; désactiver « Dévier » si 0 PA (lu via `cur.deviation` : `res.location` + `armour`).
- sinon (piège-lame, autres) → l'`OptionChooser` seul (+ un texte de contexte via `cur.outcome`/`label`).

`gating « Dévier »` : la modale calcule `pa = target.armour[loc]` (comme `DeviationModal` aujourd'hui) ;
option `disabled: pa===0`. La résolution d'office (« Tout résoudre ») d'une déviation = `defaultChoice`
(défaut = `'subir'` : on SUBIT — on ne dévie pas « gratis »).

## Non-goals (P3)

- **Pas de folding du `pendingFumble`** (maladresse du défenseur) ni des sous-étapes de mort/Destin :
  ils restent leurs modales (coexistence via l'arbitre). P3 = dévier + piège-lame seulement.
- **Pas de re-dérivation RNG** : on porte le `CriticalResolved` pré-tiré.
- Compat ascendante : les modales `DeviationModal`/`BladeTrapModal` autonomes RESTENT (le chemin
  `pendingDeviation`/`pendingBladeTrap` direct via les actions store n'est plus emprunté par
  `applyAttackResult`, mais les composants + actions restent pour compat/tests jusqu'à dépose nette).

## Tests

- `cascade.test`/nouveau : applier `'deviation'` — `chosen='subir'` applique le Critique pré-tiré
  (cible perd ses Blessures critiques) ; `chosen='devier'` n'applique PAS le Critique (−1 PA). Applier
  `'bladeTrap'` — `'crit'` vs `'trap'` branchent. `resume:false` ne reprend pas l'IA (la fermeture le fait).
- `reveal-routing`/`reveal-combat` : un critique sur un héros ARMÉ pose une ÉTAPE DE CHOIX `'deviation'`
  (plus `pendingDeviation`) ; non armé → étape d'affichage 'critical' (P2, inchangé).
- Régression : `store.test` (déviation/mort/Destin), `combatFlow` verts. Recette navigateur : attaque
  d'un héros armé → une seule séquence (Critique riche + choix Dévier/Subir) ; Subir applique, Dévier −1 PA.

## Risque & séquencement

- **Cœur combat, intriqué** (le plus risqué du chantier). Mitigations : on RÉUTILISE les résolveurs
  existants (zéro réécriture de la logique de critique/déviation), on ne change que le POINT DE POSE
  (pending → étape) et la REPRISE (déférée à la fermeture, déjà en place P2). Compat ascendante des
  modales autonomes. Vérif par fichier (`store.test`, `cascade.test`, `reveal-*`).
- Séquençable : **P3a déviation** d'abord (la plus utile), **P3b piège-lame** ensuite (plus simple).
