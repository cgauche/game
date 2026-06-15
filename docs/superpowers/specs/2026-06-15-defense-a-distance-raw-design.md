# Défense contre les attaques à distance (RAW) — design

**Problème.** Une attaque à distance est résolue par un Test de Projectiles **non opposé**
(`resolveRanged`, `applyAttackResult` force `defense:'none'` pour tout tir). C'est le défaut RAW
correct (LDB 13 l.135), MAIS le RAW prévoit **trois exceptions** où la cible PEUT se défendre, et
aucune n'est implémentée. `rangedOpposeWeapon` (Protectrice 2+) existe + est testé mais **n'est câblé
nulle part**. L'aperçu du défenseur (`previewDefense`) affiche « Parade » **inconditionnellement** →
trompeur.

## RAW (cité)

- **Défaut : aucune défense.** LDB 13 Combat l.135 — « Distance : effectuez un Test de **Projectiles**…
  Sur un succès, vous touchez. » (non opposé.)
- **Exception A — Parade avec bouclier Protectrice 2+** (LDB 62 l.307) : « Si votre arme possède un
  Indice _Protectrice_ de 2 ou plus, vous pouvez aussi **opposer des projectiles tirés dans votre
  Ligne de Vue**. » → la cible PARE (Corps à corps) le tir, en Ligne de Vue.
- **Exception B — Esquive à Bout Portant** (LDB 14 « Combat À Distance » l.62) : « il est néanmoins
  possible de leur opposer une **Esquive si ces attaques sont à bout portant**. » → bande de portée
  = Bout portant (`dist×2 ≤ portée/10`).
- **Exception C — Tireur _Engagé_** (LDB 14 l.70) : « Si vous utilisez votre Compétence Projectiles
  quand vous êtes _Engagé_ avec votre cible, cette dernière peut **s'opposer avec n'importe quelle
  Compétence Corps à corps**. » (tir au contact via un Pistolet, l.64) → la cible PARE, sans
  Protectrice requise.
- **Hors périmètre / crochet :** le « talent particulier » de l.62 (parade de tir) n'a pas
  d'équivalent nommé clair dans le LDB ch.10 — laissé en hook (`canParryRanged(combatant)` renvoyant
  false par défaut), à brancher si un talent est identifié (AA ?).

## Architecture (réutiliser l'existant, pas de flux parallèle)

Tout passe par la résolution d'attaque et la modale de défense EXISTANTES — on rend simplement le tir
**opposable** quand une exception s'applique.

### 1) Moteur pur — `rangedDefenseModes` (engine/combat.ts)

```ts
/** Modes de défense AUTORISÉS contre un tir (LDB 13 l.135 défaut aucun ; exceptions LDB 62 l.307 /
 *  14 l.62 / 14 l.70). Vide = aucune défense (cas par défaut). */
export function rangedDefenseModes(
  attacker: Combatant, defender: Combatant, weapon: Weapon, distanceTiles: number | undefined, los: boolean,
): ('parade' | 'esquive')[] {
  const modes = new Set<'parade' | 'esquive'>();
  // C — tireur Engagé : la cible pare avec n'importe quelle Corps à corps.
  if (isEngagedWith(attacker, defender.id)) modes.add('parade');
  // A — bouclier Protectrice 2+, projectile en Ligne de Vue.
  else if (los && rangedOpposeWeapon(defender.weapons)) modes.add('parade');
  // B — Esquive si Bout Portant.
  if (distanceTiles != null && weapon.range && rangeBandName(distanceTiles, weapon.range) === 'Bout portant')
    modes.add('esquive');
  return [...modes];
}
```

### 2) Résolution — tir opposé quand un mode s'applique

- `resolveAttack` (combatFlow.ts) calcule `distanceTiles` + `los` et appelle `rangedDefenseModes`.
  - **modes vide** → comportement actuel (`resolveRanged` non opposé).
  - **modes non vide** → tir **OPPOSÉ** : le défenseur lance sa meilleure défense disponible (parade
    via `protectriceAP` pour l'arme Protectrice, ou Esquive) contre le Test de Projectiles du tireur.
    Réutiliser la machinerie opposée de `resolveMelee` généralisée à `kind:'ranged'` (le tireur lance
    Projectiles, pas Corps à corps) — sortie = `AttackResult` avec `defenderDetail`/`netSL` comme en
    mêlée. La parade Protectrice confère `protectriceAP(parryWeapon)` PA à toutes les localisations
    (déjà géré par `applyHit`).
- `applyAttackResult` : ne plus forcer `defense:'none'` pour le ranged si des modes existent.

### 3) Modale de défense réactive (ennemi tire sur un héros)

- `maybeOpenDefense` (combatFlow.ts:1617) : aujourd'hui mêlée-only (`weapon.type !== 'melee'` →
  return). Étendre : pour un tir, si `rangedDefenseModes` non vide, OUVRIR `pendingDefense` (le jet de
  Projectiles du tireur est figé), en limitant les options de réaction aux modes autorisés.
- `DefenseModal` / `useDefenseJetProps` (Phase B de l'unification) : le segmented control n'affiche que
  les modes autorisés (ex. Esquive seule à bout portant sans bouclier ; Parade seule avec Protectrice
  hors bout portant ; les deux si bout portant + Protectrice/Engagé).

### 4) Aperçu (héros tire sur un ennemi)

- La ligne défenseur de la modale d'attaque (`useAttackJetProps`, via `previewDefense`) doit refléter
  les modes RÉELS : `previewDefense` prend désormais le contexte de tir (attaquant/arme/distance/los) ;
  renvoie le libellé du meilleur mode autorisé, ou **rien** (« — Sans défense ») si modes vide. Plus
  de « Parade » fantôme sur un tir non défendable.

### 5) IA / cible auto

- Quand le défenseur est un ennemi (héros qui tire), il oppose **automatiquement** sa meilleure
  défense disponible (pas de modale) — comme la défense auto de mêlée actuelle.

## Plan d'implémentation (TDD, incréments)

- **T1 — `rangedDefenseModes` pur + tests** (engine) : les 3 exceptions + défaut vide. Aucun câblage.
- **T2 — résolution opposée du tir** : `resolveAttack`/`resolveRanged` opposent quand modes non vide ;
  tests (Protectrice 2+ pare ; bout portant esquive ; tireur engagé pare ; sinon non opposé). PA
  Protectrice appliquée.
- **T3 — `maybeOpenDefense` ranged** : ennemi tire sur héros à bout portant / héros avec bouclier →
  `pendingDefense` ouvert, options limitées ; tests store.
- **T4 — aperçu `previewDefense` contextuel** : la ligne défenseur reflète les modes (ou « — ») ;
  recette navigateur (le tir sur Mannequin sans bouclier hors bout portant → AUCUNE ligne de défense).
- **T5 — recette navigateur** : héros tire à bout portant sur un ennemi (esquive auto) ; ennemi tire
  sur un héros porteur de bouclier Protectrice 2+ (modale Parade) ; 0 erreur console.

## Vérification

`npm run typecheck` ; `npm test` (combat + nouveaux tests) ; recette navigateur `window.__wfrp`.

## Hors périmètre

- Talent particulier de parade de tir (hook `canParryRanged`, false par défaut).
- L'unification « une situation = une modale » continue en parallèle : la défense réactive de tir
  passera par `useDefenseJetProps` (Phase B) — même coquille.
