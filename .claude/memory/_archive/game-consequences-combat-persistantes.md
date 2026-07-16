---
name: game-consequences-combat-persistantes
description: "Thème « conséquences de combat persistantes » en 4 plans : Persistance(A)+Traumatismes(B)+Dégâts d'arme(C)+Maladresses(D) LIVRÉS ; + refacto store.ts→combatFlow.ts. Reste : fumble défenseur, recette navigateur."
metadata: 
  node_type: memory
  type: project
  originSessionId: e5a266bc-492a-4aac-b27d-9bdea4ea9d63
---

Parti de « Maladresses » (reliquat Jalon 1), la directive utilisateur **max-RAW** a élargi en un thème **« conséquences de combat persistantes »**, décomposé en 4 plans séquencés (spec umbrella : `docs/superpowers/specs/2026-06-06-maladresses-design.md`) :

- **Plan A — Persistance** (LIVRÉ 2026-06-06) : `engine/persistence.ts` (pur : `PERSISTENT_CONDITIONS` classement RAW des États sourcé `16-États`, `carryOverState`, `persistentConditions`) + `finalizeBattle` (writeback héros en fin de combat, `store.checkBattleOver`) + carry-in (`startCombat` : États persistants ré-importés, **morts non instanciés**, transitoire réinitialisé). Plan : `docs/superpowers/plans/2026-06-06-planA-persistance-consequences-combat.md`. Recette navigateur PAS jouée (pas d'UI ; couvert par tests store déterministes).
- **Plan B — Socle Traumatismes (en-combat)** (LIVRÉ) : type `Trauma` + factory `traumaFromKind` (`engine/trauma.ts`) partagée critiques↔Maladresse + `criticals.ts` structuré (`CritEntry.traumas`, ~22 entrées annotées) + lecture moteur (`effectiveChar` charPenalty F/Ag-30 Torse, `effectiveMovement` ÷2 jambe/Torse). limbDisabled/amputation/Esquive **journalisés** (latéralité non modélisée). `carryOverState` étendu (persiste traumas).
- **Plan C — Dégâts d'arme** (LIVRÉ, RAW `62-Les armes` l.177-180) : `engine/weaponDamage.ts` (`effectiveWeaponDamage`/`isImprovised`/`damageWeapon`/`destroyWeapon`), `Weapon.damageTaken`/`destroyed` + `ItemInstance`, combat lit les Dégâts réduits, `recomputeLoadout` propage. `parseWeaponDamage` supprimé (legacy mort).
- **Plan D — Maladresses** (LIVRÉ D1+D2+D3) : `engine/oups.ts`+`data/oups.ts` (`isFumble`, `rollOups`, Tableau des Oups! verbatim), modale `pendingFumble` (héros : Lancer→Appliquer ; ennemi : instant via `resolveEnemyFumble`), `applyOups` (combatFlow) = 7 effets + Incident de Tir, drapeaux prochain-Round (`nextActionPenalty`/`loseNextAction`/`loseNextMovement`/`actLastNextRound`) consommés dans `advanceTurn`, `attackModifiers` lit la pénalité. `FumbleModal.tsx`. **Reste : fumble du DÉFENSEUR (défense réactive) ; recette navigateur.**

**Refactos de la session** : `isDoubleRoll` partagé (`tests.ts`, dedup 6×) ; `battleRng` extrait en module (`state/battleRng.ts`) ; **`store.ts` 2364→1542 l.** — flux de combat sorti dans **`state/combatFlow.ts`** (35 fonctions get/set ; `GameState`/`BattleState` exportés de store, import type ; `applyOups`/`attackerFumbled`/`resolveEnemyFumble` y vivent). Config hooks : lean-ctx retiré (lent + faisait échouer les `mv`/`sed` en silence), **RTK seul** gardé (compression runners). Leçon : mutations de fichiers via Write/Edit, gate `tsc` (Vitest ne typecheck pas), vérifier chaque mutation shell.

**Why:** la mort persiste → tout (Blessures/critiques/États/traumatismes/dégâts d'arme) doit persister pareil ; on ne repart pas frais à chaque combat. Récupération/soins = Jalon 5. **Rien d'inventé** : le flou RAW (« −10 aux Tests *concernant* la Localisation ») est journalisé, pas comblé.
**How to apply:** enchaîner B→C→D selon le spec umbrella ; étendre `carryOverState` pour persister `traumas` (B) et `damageTaken` d'`ItemInstance` (C). Voir [[git-commits-propres-wip-parallele]] (working tree partagé session rig), [[game-death-critical-model]], [[game-roll-modal-pattern]] (invariante un-jet-une-modale pour D).
