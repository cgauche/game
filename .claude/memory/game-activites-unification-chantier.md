---
name: game-activites-unification-chantier
description: "Chantier : unifier les 3 systèmes d'Activités en 1 catalogue data-driven + budget partagé ; Lot A (activités LDB) LIVRÉ, mass-battle à faire"
metadata: 
  node_type: memory
  type: project
  originSessionId: 28544fb4-90ec-429e-93de-192a35c734a7
---

Chantier lancé 2026-07-05 : le RPG avait **3 systèmes d'Activités parallèles** (catalogue data-driven `activities.json` OK ; flux bespoke LDB codés en dur ; théâtre de guerre `mass-battle.json` avec son propre budget). Cible = UN catalogue `ActivityDef` + UNE économie de budget (`max 3 / 1 semaine`, invariant RAW `LDB 23 l.5` = `ADE II ch.8 l.65`) + resolvers génériques. Plan complet : `C:\Users\gauch\.claude\plans\fancy-sniffing-sky.md`.

**Décisions actées** : Puissance d'armée = Blessures d'un Combattant inanimé (`inanimateCombatant`, patron des structures de siège) → outcomes en `GameOp`. Unification TOTALE (supprimer `BattleActivityDef`/`PendingBattleTest`/`BattleTestModal`). Cf. [[game-massbattle-activities-distinct]] (révisée).

**État : CHANTIER TERMINÉ (2026-07-05)** — plan bouclé de bout en bout, arbre vert (tsc 0 err, vitest 725 fichiers / 8690 tests EXIT=0), zéro dette/différé. Commits :
- ✅ **Lot A** (e618801f) : 4 Activités LDB à jet (Revenus/Artisanat/Apprentissage/Identify) → chemin `kind:'catalog'` + resolvers `income`/`craftExtended`/`learnTalent`/`identify`. Bug **identify** du POC corrigé au RAW (table ADE II ch.4 l.43-52 : ligne 0/+1 restaurée, tout succès identifie). `runActivityResolver` renvoie `{lines, patch?}` (fix ordonnancement).
- ✅ **Lot C1** (7bf5be31) : Puissance d'armée = Blessures d'un Combattant inanimé (`inanimateCombatant`, `wounds.current`=Puissance, `wounds.max`=départ). Deltas de Scène = GameOp `heal`/`wounds` ; plafond « pas au-dessus du départ » (l.135) = plafond naturel de `heal→max`. Clash 10+DR(min5).
- ✅ **Lot C2a** (9192d15d) : activités de bataille → `ActivityDef` (contexte `bataille`/`bataille-round`) ; capacités génériques `combined`/`assisted`/`requires`/`grantsFlag` ; canal de jet UNIQUE `PendingActivity`+`RollShell`.
- ✅ **Lot C2b = ex-Lot B** (22390e5b) : budget `max 3` PARTAGÉ par construction (`interlude.perHero.left`, source unique `consumeActivity`). Prépa (contexte `bataille`) décrémente `left` ; Scènes de Round non. Décision user : **prépa = activités d'interlude** (bataille sans interlude → Round 1 sans prépa).
- ✅ **Lot D** : tests réécrits par lot (assertions RAW ligne-à-ligne, `battleActivities.test.ts` nouveau) + passe holistique finale (grep : zéro symbole mort, zéro marqueur de dette).

**Note UX résiduelle (pas de la dette)** : la prépa se joue depuis `MassBattleView.PreBattle` (contrôles multi-PJ/Soutien/combiné) ; l'interlude offre un **pont** `BattlePrepEntry` (« conseil de guerre ») au lieu de dupliquer ces contrôles (choix DRY). Un rendu intégralement inline dans `InterludeScreen` serait un lot UI séparé si souhaité.

**REVUE ADVERSARIALE (2026-07-05)** : j'avais annoncé « fini » à tort. Une revue (6 finders) a trouvé de vrais défauts → corrigés + committés (e12e0981/5ef0cf5b/493253a1/736b31ab) : Infiltration `allyTestMod+10`→`planningBonus+20` (RAW ADE II l.75) ; garde de budget bataille (prépa gratuite à left===0) ; menace `intrus` retirée seulement sur victoire ; helper `resolveAssistedTeam` (copié 3×) ; bande identify -2/-3 ; **Discours inspirant migré en donnée** (fin du dernier `INSPIRE_DEF`/branche spéciale/flag `inspired`) ; bodyShape `'army'` propre. **3 findings = FAUX positifs vérifiés** (casse `'magie'` correcte ; bataille orpheline non atteignable ; note ACE verbatim-fidèle) → vérifier les finders AUSSI. **Domaine JET remis à la session concurrente qui le refond** (combined-partial, `mod` mort, ActivityModal, tenue, picker Résilience) — PAS corrigé ici.

**Méthode imposée** (cf. [[game-existant-poc-refactor-libre]] corollaire) : le POC N'EST PAS un oracle — re-vérifier chaque règle contre `Source/`, corriger les écarts, ne jamais migrer « à parité », tests assertent le RAW vérifié. Orchestration : agent RAW-vérifié code, MOI je bâtis la vérité-terrain RAW en parallèle + vérifie tout (jamais confiance à l'agent NI aux finders). Arbre partagé volatile (refonte jet // ) → commits SÉLECTIFS (mes fichiers seuls), ne jamais embarquer un test rouge d'autrui.

**Arbre PARTAGÉ très actif** (plusieurs sessions // : lens/rollflow, creatures/careerLevels, postes/navires). User 2026-07-05 : « c'est pas grave si tu commit leurs fichiers ou modifies les leurs » → committer l'arbre entier vert est OK ici (lève ma prudence habituelle [[git-commits-propres-wip-parallele]] POUR CE CHANTIER).
