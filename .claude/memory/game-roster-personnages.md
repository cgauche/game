---
name: game-roster-personnages
description: Roster persistant des persos créés (localStorage) livré ; quirk — startScene écrase la richesse initiale (money remis à 5 pa)
metadata: 
  node_type: memory
  type: project
  originSessionId: a2c018e4-34c4-497f-9095-46de20ab9e4b
---

Roster persistant LIVRÉ (commit 32b4878, 2026-06-10) : `src/state/roster.ts` (clé `wfrp4.roster.v1`, `rosterLoad/Add/Remove`, garde sans-localStorage) ; chaque héros sorti du créateur est sauvegardé AVEC sa Richesse initiale (`RosterEntry = {hero, wealth}` — la bourse n'est pas sur le Combatant) ; PartyScreen → modale à onglets « Mes personnages » / « Pré-tirés » (`PartyPicker` exporté, testé en rendu statique), reprise = clone + `creditPartyMoney`.

**Quirk préexistant signalé à l'utilisateur** : `startScene` (store.ts ~787) remet `money: {gold:0, silver:5, brass:0}` — la Richesse initiale créditée à la création est ÉCRASÉE au lancement de campagne (vrai aussi pour la reprise depuis le roster). À trancher un jour : créditer la richesse APRÈS startScene ou la préserver dans le reset.

Prolonge [[game-newgame-reset-pattern]] (le reset zéro-maintenance est la cause du quirk).
