---
name: game-combat-events-structures
description: "battle.log = CombatEvent[] structurés (kind+actor/target+texte) ; source unique journal/bandeau/feedback/caméra ; icône par kind, plus de devinage"
metadata: 
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

`battle.log` n'est plus `string[]` mais **`CombatEvent[]`** (refactor « aucune dette », commit 644ae34) : chaque entrée = `{ kind, text, actorId?, targetId? }`. Modèle + constructeurs dans **`src/state/combatLog.ts`** : `ev(kind, text, actorId?, targetId?)` et `evLines(lines, mainKind, actorId?, targetId?)` (les sous-lignes indentées « ↳ … » deviennent automatiquement `kind:'detail'`). `CombatEventKind` = charge/attack/shoot/cast/item/heal/move/flee/defensive/aim/focus/frenzy/reload/parry/dodge/damage/crit/condition/fear/death/round/detail/info.

C'est la **source unique** pour : le journal (`BattlePanel`), le bandeau d'événements (`CombatBanner`), et — à venir — le feedback flottant + le cadrage caméra (d'où les `actorId`/`targetId`). L'affichage est dans **`src/gameIso/combatNarration.ts`** : `narrateEvent(event, combatants)` → `{ icon, important, segments }`. L'**icône se déduit du `kind`** (table `KIND_ICON`) — PLUS de devinage par mots-clés. Pour `condition`/`detail`, lookup de l'icône d'état via `conditionMeta` (jeu de noms FERMÉ d'`effectIcons`). `important` (→ bandeau) = set de kinds + états incapacitants. Noms colorés par camp (`.nm-ally`/`.nm-foe`) par appariement des noms de combattants.

**Why:** l'utilisateur a exigé « ne laisse aucune dette » / « si tu dois refactoriser, fais-le maintenant, après ce sera bien plus compliqué » — fait AVANT d'empiler feedback/caméra dessus.
**How to apply:** pour journaliser un nouvel événement de combat, pousser `ev(kind, texte, acteurId, cibleId)` dans `battle.log` (ou `evLines(...)` pour envelopper un `string[]` du moteur) — JAMAIS une chaîne brute. `get().log(msg)` reste le **journal du groupe** (hors combat, `string[]`), distinct de `battle.log`. `finishPlayerAction(get,set,lines,kind)` prend le kind (cast/heal/focus/condition). Prolonge [[feedback-playtest-themes-not-points]].
