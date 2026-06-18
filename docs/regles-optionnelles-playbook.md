# Playbook d'implémentation — règles optionnelles restantes

> Specs vérifiées (RAW + hook code + entrée registre + test) produites par workflow multi-agents
> (2026-06-18), pour dérouler les lots restants sans ré-investiguer. Complète
> `docs/regles-optionnelles-catalogue.md`. Plan : `~/.claude/plans/transient-dancing-shamir.md`.
> Statuts : **DO** = implémentable maintenant · **2b** = différé (zone refacto combat // en cours,
> « merger en dernier ») · **HEAVY** = sous-système absent / nouvelle plomberie · **FAUX-POS** = pas
> une règle moteur (narration MJ / déjà le défaut / déjà implémenté).

## À FAIRE (HIGH, défaut byte-identique, hors zone combat //)

| règle | id | kind | hook | approche |
|---|---|---|---|---|
| Tests étendus : DR 0 = ±1 min | `test-extended-min-sl` | flag (déf false) | `store.ts:extendedTestNext` (`total += cur.result.sl`) | `effectiveSL = success?max(1,sl):min(-1,sl)` AVANT l'addition ; clamp `<0→0` APRÈS. |
| Métier (Savoir) : Int au lieu de Dex | `test-metier-int` | flag (déf false) | `engine/skills.ts:testValue` | si compétence préfixe « Métier » et carac=Dex → `max(valDex, Int+avances)`. |
| Intimidation : caractéristique | `test-intimidation-char` | mode `F`/`max`/`FM`/`I` (déf `F`) | `engine/skills.ts:testValue` | pour « Intimidation », surcharger `ck` avant `base=effectiveChar(c,ck)`. `max`=max(F,FM,I). |
| Critiques/Maladresses sur tous les Tests | `test-critiques-doubles` | flag (déf false) | UI résultat de Test (RollFlowShell `postRollExtra` / props de jet de test) | `isDouble` déjà dans TestResult ; afficher badge « Succès/Échec Stupéfiant » hors combat. Aucun effet mécanique. |
| Système achat/vente | `market-mode` | mode `complet`/`sans-disponibilite`/`sans-marchandage`/`simplifie` (déf `complet`) | `merchantFlow.ts:openMerchant` (rollStock) + `startBargain` | sans-dispo→stock plein (qty par settlement, hors Exotique) sans rollStock ; sans-marchandage→`startBargain` return tôt. |
| Guildes d'Artisans | `market-guild` | flag (déf false) | `merchantFlow.ts:openMerchant` construction `cat` | `shiftAvailability(t.availability,t,{guild:true})` (DÉJÀ implémentée+testée dans `qualities/craftEconomy.ts`) avant `rollStock`. |
| Utilisation des Maladies | `disease-mode` | mode `full`/`situational`/`off` (déf `full`) | `combatFlow.ts:finalizeBattle` (~infect post-combat) + `upkeep.ts:runDailyUpkeep` (`dailyDiseaseUpkeep`) + `restFlow.ts` (contagion nocturne) | `off`=guard tous (+ vider `woundedByInfected/Rodent/diseaseExposure`) ; `situational`=garder Infecté/Maladie, sauter post-critique. |
| « Entre deux aventures » facultatif | `interlude-enabled` | flag (déf **true**) | `combatEffects.ts:applyEffects` case `interlude` | `if(!rule(...))return;` avant `startInterlude`. |
| Devoir elfique (Prestige Elfique) | `interlude-elf-duty` | flag (déf **true**) | `interludeFlow.ts:startInterlude` (bloc `/elfe/i && w>=3 → left-=1`) | entourer le bloc de `if(rule(...))`. |
| Gnome jouable (NADJ) | `creation-gnome-jouable` | flag (déf false) | `creation.ts:randomSpeciesTable` + `CharacterCreator.tsx:SpeciesZones` | filtrer `source.book==='NADJ'` quand OFF ; quand ON, `rank()` NADJ ≤ ADE2 pour gagner rand:98 vs Ogre. **Vérifier que le Gnome existe dans species.json.** |
| Récup. de Chance en cours de session | `fortune-mid-session` | mode `off`/`manual`/`auto` (déf `off`) | `combatEffects.ts` case `restoreFortune` ; action store + bouton MJ pour `manual` | `off`=actuel ; `manual`=action `restoreFortuneNow()` (réutilise la logique restoreFortune) + bouton ; `auto`=informationnel (temps réel non trackable). |

## DIFFÉRÉ — lot 2b (gate d'un comportement DÉJÀ câblé ; zone défense-cascade // → merger en dernier)

| règle | id | kind | hook | note |
|---|---|---|---|---|
| Sur la Défensive | `combat-defensive-stance` | flag (déf true) | `store.ts` action (~set `defensiveStance`) ; `defenseModifiers` lit déjà +20 | gate la DISPONIBILITÉ de l'Action. |
| Déviation Critique | `combat-critical-deflect` | flag (déf true) | `combatFlow.ts:applyAttackResult` (modale `deviation` + auto-déviation ennemi) | gate l'offre de modale / l'auto-déviation. |
| Tir dans la mêlée (−20 + fratricide) | `combat-ranged-melee-penalty` | flag (déf true) | `combatFlow.ts:attackEnv` (−20) + stray shot | gate les 2 sites ; garder `inMelee=false` au retour si OFF. |
| Cible sans défense | `combat-helpless-mode` | mode `critique`/`mort-auto` (déf `critique`) | `combat.ts:helplessTest` (×2) + `applyAttackResult` (autoKill) | `mort-auto` mêlée only ; passer par checkBattleOver/Destin (pas d'early-return brutal). |
| Méthode + fréquence d'Initiative | `combat-init-method` / `combat-init-frequency` | mode | `combat.ts:initiativeOrder` (lit `c.initiative`) + combatFlow startBattle/roundBoundary | `rollInitiative(c,rng)` alimente `c.initiative` ; `per-round`=re-tirer au passage de Round. |

## DIFFÉRÉ — HEAVY / sous-système absent (nouvelle plomberie ; faire le socle d'abord)

- **Test Combiné** (`test-combined`) + **Filature** (`test-filature`) : 3ᵉ issue « partielle » → étendre `PendingTest`/`FlowTest`/`FLOWS.test`/éditeur. Filature dépend du Test Combiné.
- **Composant d'incantation** (`magic-composant`) : `Combatant.componentSpells[]` + downgrade Imparfaite dans `applyCast`/`focusConfirm` + UI fiche.
- **Dissipation collective** (`magic-dissipation-soutenu`) : prérequis = Dissipation de Sort Permanent (Test étendu solo) — inexistante ; puis Test Soutenu multi-acteur.
- **Tenir les Comptes** (`market-tenir-comptes`) : prérequis = `Combatant.statusTier/standing` + compteur `dailyFreebuys` (reset advanceDay).
- **Maladies de l'eau par blessures ouvertes** (`disease-water-open-wounds`) : prérequis = système de Natation/immersion fluviale (inexistant).
- **Voyage par Étapes** (`travel-etapes` parent + `travel-etapes-count-bonus` + `travel-attraper-froid` + `travel-forage` + `travel-mount-mishaps`) : la variante « Étapes » du Compagnon n'existe pas (seul le voyage LDB jour/jour). Faire le socle Étapes d'abord.
- **Se Fatiguer** (`combat-fatigue-track`) : nouveau compteur `effortRounds` + Test en `resolveRoundBoundary` (zone //).
- **Social** (`social-status-reaction-roll`, `social-begging-bonus`, `social-charm-intra-tier`) : la couche de modificateurs sociaux de Statut N'EXISTE PAS (ni inter- ni intra-Échelon). Créer `statusCharmMod` + `FlowTest.vsStatus` + ré-exposer `heroStatus` au moteur. Socle d'abord.
- **Longueur d'arme & combat au contact** (`combat-weapon-reach`) : `REACH_ORDER` dans engagement.ts (retirer le garde-fou « NE PAS implémenter ») + −10 dans `attackModifiers` + flux « au contact » (Action + Test opposé).
- **Poursuites** (`chase-dodge-obstacle`, `chase-variable-env`) : AUCUN système de poursuite dans le code (socle LDB 15 à créer d'abord).

## FAUX POSITIFS (ne PAS mettre au registre)

- **Embrasser les Ombres** (LDB 19 l.18) : narration MJ ; le Sombre Pacte (+1 PC) est déjà câblé (ChanceButtons).
- **Manifestations Lentes** (LDB 19 l.189) : « laissé à l'appréciation du MJ » — aucun mécanisme défini (durée/trigger). Implémenter = inventer.
- **Maladies de l'eau au jugé** (C2 ch.14) : conseil de fréquence ; couvert par `disease-mode='situational'`.
- **Incantation Critique : choix** (LDB 46 l.53) : DÉJÀ implémenté (`CastCritChoice`, `castSetCritChoice`, picker CastModal).
- **Cavalier = Mouvement de la monture** (AA l.3282) : DÉJÀ le défaut (`mount.ts:mountMovement` rend le M de la monture).
- **Sélection aléatoire de race** (NADJ l.64) : le d100+20 PX est DÉJÀ inconditionnel (`rollDraftSpecies`/`speciesXp`) ; seul l'ajout du Gnome au contenu est une option (= `creation-gnome-jouable`).
