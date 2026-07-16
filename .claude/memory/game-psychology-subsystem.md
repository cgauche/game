---
name: game-psychology-subsystem
description: Sous-système Psychologie WFRP4 (Peur/Terreur/Frénésie/traits ciblés/groupes) livré P1-P4 ; gaps documentés
metadata: 
  node_type: memory
  type: project
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

Sous-système Psychologie **complet (P1-P4)** livré 2026-06-07 (branche `feat/wfrp4-rpg-foundation`, ~1181 tests verts). Cœur pur `engine/psychology.ts` + `engine/groups.ts`. C'est le **T5** du [[game-difficultes-combat-table|Jalon 1.5 Taille]] (Peur/Terreur dérivées de la Taille `85` l.317-318). Détail dans `ROADMAP.md` Jalon 1.5.

- **P1** Peur/Terreur (modale héros `pendingPsych` Test étendu de Calme / IA instantané ; −1 DR via `attackModifiers` ; Immunité Psychologie).
- **P2** Frénésie (`pendingFrenzy` + bouton « 🐗 Frénésie » ; +1 BF, immunité psy, attaque CC gratuite/round `aiFrenzyAttack`, cible la plus proche, fin → Exténué).
- **P3** Traits ciblés + Groupes (`groupsFor` folder/espèce/carrière+extras ; `targetedTrigger` ; Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie ; +1 DR & immunités Peur ; Soc `socialPsychMod` ; contrainte de cible IA).
- **P4** `StatblockEditor` : champ Groupes + aide syntaxe Traits psy.

**Gaps assumés & documentés** (points d'entrée si on veut pousser plus loin) :
- ⚠️ **DÉFAUT RÉEL (signalé par l'utilisateur 2026-06-07) : la Psychologie est modélisée COMBAT-ONLY**, or LDB 21 dit « chaque fois que vous **rencontrez** » le groupe — une rencontre **sociale** (entrée de scène, dialogue) en est une. Les afflictions `psychState` ne sont créées QUE par les flux de combat (`resolvePsychAI`/`psychConfirm`/`targetedTrigger` gardés sur `battle`). HORS combat : aucun **Test de Psychologie d'encontre** ne se déclenche. `socialPsychMod` (Soc −20/−10) est branché au Test de dialogue (`Effect 'test'` + `vsGroups`) mais en **raccourci** : il applique le −20/−10 du **succès** depuis la simple **possession** du trait, SANS lancer le Test (donc jamais l'échec = compulsion d'attaque/insulte) et sans modéliser Peur/Terreur hors combat (approche d'un PNJ terrifiant, etc.). **Vrai fix** = un déclencheur d'encontre en exploration (entrée scène / début dialogue avec un membre du groupe) qui rejoue la modale `pendingPsych` → succès (−20/−10 / peur contenue) ou échec (affliction active). Périmètre modéré, non câblé (attente d'arbitrage).
- Contrainte d'action **héros** = journal seul (pas de grisage des cibles non-haïes dans l'UI ; l'IA, elle, vise bien le groupe haï).
- **Phobie** traitée comme un ciblé binaire (≈ Peur 1), pas via le canal Peur étendu.
- Afflictions ciblées re-testées **tant qu'un membre du groupe est visible** ; pas d'auto-fin quand le groupe disparaît (effet résiduel nul, donc inoffensif).
- Groupes **PJ** = auto-dérivés (espèce+carrière) ; pas d'éditeur d'extras manuels côté héros (seulement statbloc).
- **`psychTraits` du PJ pas dérivés des TALENTS ni des MUTATIONS MENTALES** (sources réelles signalées par l'utilisateur 2026-06-07 ; `talents.json` contient des mots psy ; pas de fichier mutations dédié — à investiguer). Aujourd'hui seul `creature.traits` alimente `parsePsychTraits` ; `createHero` ne pose aucun `psychTrait`. Animosités **raciales** (Nain↔Elfe) idem non auto-dérivées. **NE PAS câbler sans demande explicite** (backlog).

Pattern réutilisé : modale différée = invariante [[game-roll-modal-pattern]] (suffixe résolveur `*Roll/*Confirm` whitelisté par le garde statique). Coordination commits = [[git-commits-propres-wip-parallele]] (la session rig a committé proprement entre mes tâches ; j'ai committé mes seuls fichiers par pathspec).
