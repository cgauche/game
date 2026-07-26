---
name: game-psychology-subsystem
description: Sous-système Psychologie WFRP4 (Peur/Terreur/Frénésie/traits ciblés/groupes) livré P1-P4 ; gaps documentés
metadata: 
  node_type: memory
  type: project
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

Sous-système Psychologie **complet (P1-P4)** livré 2026-06-07 (branche `feat/wfrp4-rpg-foundation`, ~1181 tests verts). Cœur pur `engine/psychology.ts` + `engine/groups.ts`. C'est le **T5** du [[game-difficultes-combat-table|Jalon 1.5 Taille]] (Peur/Terreur dérivées de la Taille `85` l.317-318). Cœur : `engine/psychology.ts`/`engine/groups.ts` (git porte l'historique de livraison).

- **P1** Peur/Terreur (héros : ÉTAPE de cascade `combatPsych` — Test étendu de Calme rendu par `CascadeModal`, ouvert par `openRoundStartPsych`/`openRoundEndPsych` ; IA instantanée `resolvePsychAI` ; −1 DR via `attackModifiers` ; Immunité Psychologie).
- **P2** Frénésie (`pendingFrenzy` + `FrenzyModal`, titre porté par l'icône `flag/frenzy` — jamais un émoji, garde `src/ui/no-emoji-affordance.test.ts` ; +1 BF, immunité psy, attaque CC gratuite/round via le hook `aiMaybeFrenzy` (`state/combatFlow.ts`), cible la plus proche, fin → Exténué).
- **P3** Traits ciblés + Groupes (`groupsFor` folder/espèce/carrière+extras ; `targetedTrigger` ; Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie ; +1 DR & immunités Peur ; Soc `socialPsychMod` ; contrainte de cible IA).
- **P4** `StatblockEditor` : champ Groupes + aide syntaxe Traits psy.

**Portée hors combat, puis gaps assumés & documentés** (points d'entrée si on veut pousser plus loin) :
- **Psychologie À LA RENCONTRE, hors combat** (LDB 21 : « chaque fois que vous **rencontrez** » le groupe — une rencontre SOCIALE en est une) : cœur pur `engine/encounterPsych.ts` (`encounterPsych(hero, npcs)` — Traits CIBLÉS/sociaux seuls : Animosité/Haine/Préjugé/Phobie/Amour/Camaraderie ; Immunité (Psychologie) et Frénésie court-circuitent) + couche state `encounterPsychFlow.ts` : UNE cascade `kind:'encounterPsych'` (un héros par ÉTAPE, applier partagé, Test de Calme générique + Détermination offerte par la coquille), ouverte par `openEncounterPsych` à l'entrée de scène (`store.ts`) et par `openScriptedPsych` pour les sources de Peur/Terreur SCRIPTÉES d'une scène. **Les PNJ AMBIANTS ne déclenchent PAS Peur/Terreur hors combat** (comportement retenu au playtest 2026-06-10 : une galerie de monstres, ou un PNJ inoffensif de grande Taille, inonderait le joueur de Tests de Calme) — Peur/Terreur restent au combat. `socialPsychMod` (Soc −20/−10) est branché au Test de dialogue (`Effect 'test'` + `vsGroups`) en **raccourci** : il applique le −20/−10 depuis la simple POSSESSION du trait, sans lancer ce Test-là (donc jamais l'échec = compulsion d'attaque/insulte).
- Contrainte d'action **héros** = journal seul (pas de grisage des cibles non-haïes dans l'UI ; l'IA, elle, vise bien le groupe haï).
- **Phobie** traitée comme un ciblé binaire (≈ Peur 1), pas via le canal Peur étendu.
- Afflictions ciblées re-testées **tant qu'un membre du groupe est visible** ; pas d'auto-fin quand le groupe disparaît (effet résiduel nul, donc inoffensif).
- Groupes **PJ** = auto-dérivés (espèce+carrière) ; pas d'éditeur d'extras manuels côté héros (seulement statbloc).
- **`psychTraits` du PJ pas dérivés des TALENTS ni des MUTATIONS MENTALES** (sources réelles signalées par l'utilisateur 2026-06-07 ; `talents.json` contient des mots psy ; pas de fichier mutations dédié — à investiguer). Aujourd'hui seul `creature.traits` alimente `parsePsychTraits` ; `createHero` ne pose aucun `psychTrait`. Animosités **raciales** (Nain↔Elfe) idem non auto-dérivées. **NE PAS câbler sans demande explicite** (backlog).

Pattern réutilisé : modale différée = invariante [[game-roll-modal-pattern]] (garde `roll-modal-invariant`, au choke-point du prédicat de contrôleur). Coordination commits = [[git-commits-propres-wip-parallele]] (la session rig a committé proprement entre mes tâches ; j'ai committé mes seuls fichiers par pathspec).
