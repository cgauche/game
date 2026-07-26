---
name: game-guerison-action
description: "Sous-système Guérison (action de soin) livré — combat + hors-combat, limite 1/rencontre, désencombrement ActionBar"
metadata: 
  node_type: memory
  type: project
  originSessionId: def5ec14-c25d-4bf9-b5de-542874fe6aa1
---

Action **Guérison** livrée (LDB 09-Compétences l.226-243, 16-États l.104-109, 18-Trauma l.28).

- **Moteur pur** `src/engine/healing.ts` : `hasHealSkill` (gate Compétence AVANCÉE), `isHealable`,
  `availableHealModes` ('wounds'|'bleed'), `healableTargets` (combat = soi+adjacents ; hors = tout le groupe),
  `healWoundsDelta` (succès BI+DR plancher 0 ; échec BI+DR<0 → perte), `stopBleedOutcome` (1+DR, Exténué si tout retiré),
  mutateurs `applyHealWounds`/`applyStopBleed`.
- **Limite** « 1 soin de Blessures / patient / rencontre » via `Combatant.soinRencontreUtilise` : reset au `startCombat`,
  reporté par `carryOverState` (combat→groupe). L'arrêt d'Hémorragie n'est PAS limité.
- **Store** : `PendingHeal` DÉDIÉ (pas de réutilisation de `pendingTest` → évite un désync Chance/Résilience entre
  party et battle.combatants) ; actions `battleHeal`/`healAlly`/`healRoll`/`healReroll`/`healBonusSL`/`healForceSuccess`/
  `healConfirm`/`healCancel`. Suit l'invariant [[game-jet-modale-exhaustif]] (modale `HealModal`, nommage `*Confirm` OK garde-fou).
- **UI** : slot 🩹 Soigner direct (combat) + bouton sur `CharacterSheet`/`FicheBody` (hors-combat, **n'avance pas le temps**).
- **Désencombrement ActionBar** : primaires directs + catégories repliables Mouvement/Tir/Objets (idiome `ab-spells`) +
  **Détermination = seule alerte visible** ; Piétiner/Frénésie = contextuels rares. `battle.action` étendu (heal/mvt/tir/objets).
- **Compose avec `outOfCombatUpkeep`** (session // « décor interactif/psy ») : leur tick rend le saignement mortel hors combat,
  Guérison est l'antidote (arrêt d'Hémorragie) — ne pas avancer le temps avant de panser.
- Scénario de test `08-guerison` (soigneur garanti + allié blessé/hémorragique). Source unitaire : `healing.test.ts`, `heal.test.ts`.

**Atteignable en jeu normal** : le **Tueur (Grunni)** a la compétence Guérison NATIVEMENT — fidèle à la Source
(`08-Statut.md l.1113`, Tueur de Trolls – Bronze 2 : « …Esquive, **Guérison**, Pari… »). Donc le slot Soigner apparaît
avec le groupe par défaut, pas besoin d'injecter la compétence. (Le sort « Bénédiction de Guérison » de Frère Anselm ≠
la compétence.) **Leçon** : ne jamais douter des données à partir de la mémoire WFRP — la Source FR fait foi (un Tueur
soigneur surprend mais c'est canon FR). Lié : [[game-francais-jamais-anglais]] + CLAUDE.md règle 7 « Pas de MJ ».
