---
name: game-unified-attack-click-model
description: "Modèle d'attaque UNIFIÉ (approche-puis-frappe) LIVRÉ : UNE liste availableAttacks + UN clic battleClickEntity ; gratuites de mêlée chargent à portée ; dispatchers supprimés"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

2026-06-17. LIVRÉ (4 commits 15528ed→d0b193b, branche feat/wfrp4-rpg-foundation, plan `scalable-shimmying-floyd.md`).
Demande user : « beaucoup d'attaques gratuites peuvent se faire via une charge, ce n'est pas spécifique à la
Frénésie » + « ça doit se comporter comme l'attaque au clic : on se déplace à portée et on attaque » → fini le
refus « hors de portée » des manœuvres de mêlée. **Zéro duplication / zéro dead code** (exigence répétée).

**La brique** : `AttackOption` + `availableAttacks(active,battle)` (combatManeuvers.ts) = UNE liste à coût
(Arme d'abord, puis gratuites/zone/Piétinement/Tentacule), `targeting:'melee'|'zone'|'trample'`,
`cost:{action,advantage}`, `reach`/`forceMelee`/`freeKind`/`weaponUid`. Subsume l'arme implicite ET la garde
Frénésie (Arme libre de Frénésie = option `cost.action:false`). `selectedAttackOption` = résolveur partagé
store⇄targeting. `battle.selectedAttack` (id armé, défaut 'arme') remplace `maneuverKind`+modes d'action.

**UN chemin** : `battleClickEntity` résout l'option armée — melee → approche-puis-frappe (SEUL exécuteur
charge/moveAttack, `attackPlan(...,{reach,forceMelee})`, Avantage dépensé 1× à la frappe, payload
`pendingAttack{freeKind,weaponUid,fromCharge}`) ; zone → pendingManeuver inline ; trample → battleTrample.
`hoverTargeting` trace l'aperçu d'approche (chemin+réticule) de l'option armée. ActionBar « Attaque ▾ » =
`availableAttacks`+`battleSelectAttack`. Clic DROIT = première abordable (`forceAttackId`). Tentacule mutation
rendue CHARGEABLE (adjacence retirée).

**L'interdit qui en découle** : aucun dispatcher d'attaque parallèle ne se rebranche — ni action de store par manœuvre (`battleManeuver`, `battleTentacle`, `battleSelectManeuver` : 0 occurrence mesurée, et il en reste 0 ; ⚠ ne pas confondre avec `battleManeuverArea`, vivante), ni champ de mode sur la battle (`battle.maneuverKind`). Une attaque de plus = une entrée de plus dans `availableAttacks` (`combatManeuvers.ts`) avec son `targeting`/`cost`, armée par `battleSelectAttack` et exécutée par le clic UNIQUE `battleClickEntity` — jamais un chemin de clic à elle.

**HORS périmètre assumé** : attaques gratuites de l'IA (`aiCreatureFreeAttacks`,
file sans modale, l'IA bouge déjà). Économie : `freeKind`→Action préservée ; `fromCharge` compose.

**Vérifié** : 58/58 tests combat (player-maneuvers/frenzy/tentacle/AI/trample/maneuver-flow) ; tsc 0 sur le
périmètre ; **recette navigateur passée** (Morsure armée → survol Gobelin distant = chemin de charge 8 cases +
« Charge (+1 Avantage) » → clic → héros charge à l'adjacence → pendingAttack{freeKind:'morsure',fromCharge} →
Action préservée (acted=false) ; liste « Attaque ▾ » = Arme/griffes + Morsure·1 Av ; 0 erreur console).

Piège vécu : la session // a fait un `git checkout` sur `combatManeuvers.ts` (contesté) → mes édits E
non-committés effacés une fois ; ré-appliqués puis COMMIT immédiat. Relié à [[game-data-driven-architecture]]
(modèle « Capacité » en donnée). Prolonge [[feedback-effet-existant-general-parametrable]], [[feedback-no-legacy-propping-fallbacks]].
