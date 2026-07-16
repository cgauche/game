---
name: game-perennite-portes-chantier
description: "Chantier pérennité 10 ans — TERMINÉ 2026-07-06 (5 lots, CI verte) ; queue en issues #176-#179 ; pièges git/hooks du chantier"
metadata: 
  node_type: memory
  type: project
  originSessionId: 88e4d329-aad9-4fe6-85b1-19f8e31ecf27
---

Mission conseil « pérennité 10 ans » — **TERMINÉE 2026-07-06** (design : ex-docs/plans/2026-07-06,
commité `23a24cc7` puis PURGÉ `b0b6f139` après exécution, git porte l'historique ; principe : déplacer
la qualité de l'audit-purge hebdo — ~25-30 % de capacité — vers des portes mécaniques). **Queue en
issues : #176 (validation sauvegarde éditeur + chargement dev), #177 (extinction stock d'alertes +
flip volet excuses), #178 (suppression branche-filet dès 13/07), #179 (section donnees.md).**
Indicateur : le compte du prochain audit hebdo doit s'effondrer, sinon la prévention a un trou.

**Livré 2026-07-06** : Lot 0 (`d072b947` — CI complète : docs:check, dérive registres, gardes RAW,
typecheck server ; canari hebdo `canari.yml` ; validateScene sur 20 scénarios ; engines/.nvmrc) et
Lot 0bis (`3c8822f6` — mécanique des 4 gardes extraite en `scripts/guards/lib/*.mjs` source unique
tests⇄hooks ; pre-commit diff-scopé PROUVÉ (commit-poison refusé exit 1) ; hook au stylo
`poison-postcheck.mjs` écrit et prouvé ; cliquet hardcode généralisé engine/state ; gardes pureté
engine→ui/gameIso + state→ui ; credo : « un audit se clôt par des GARDES »). CI verte ×2 sur les deux lots.

**Restent** : (1) bloc PostToolUse dans `.claude/settings.json` = GESTE UTILISATEUR (classifieur bloque
l'auto-modification — bloc JSON fourni au user le 2026-07-06) ; (2) tri des 44 excuses
(`EXCUSE_GUARD_ACTIVE` vit dans `scripts/guards/lib/commentPoison.mjs`, un seul interrupteur pour
test+pre-commit+stylo) ; (3) Lot 1 contrat de donnée zod (LE gros levier), Lot 2 persistance
(migrateDoc générique, golden saves, parseProject migre), Lot 3 usine-dans-le-clone (export issues,
scripts art-ref, doc reprise) — détail dans le design doc. Issues de suivi : #160 (motif par-État du
cliquet), #161 (state→gameIso, 11 imports runtime de géométrie à extraire vers un module neutre).

**Trunk-based acté 2026-07-06** : `main` fast-forwardé (jamais divergé, 2609 commits d'avance),
clone LOCAL basculé sur `main` (checkout no-op, WIP intact), CLAUDE.md à jour (`4e32ffbf`),
canari ACTIF (premier run vert). `feat/wfrp4-rpg-foundation` = filet synchronisé, À SUPPRIMER
vers le 2026-07-13. Doctrine : branche courte = travail risqué isolable, fusion le jour même.

**Lot 1 vague 1 LIVRÉE 2026-07-06** (`7e4d3921`+`6a4d4081`+fix `1e7a9648`, CI verte) : 36/94 datasets
sous contrat zod strict (defs auto-registrés SCHEMA_DEFS via gen-registry, test-contrat
`schema-contract.test.ts` avec PENDING=58 en cliquet, `validate-data.mts` branché au pre-commit).
EXCUSE_RX affinée (44→12 : 3 vraies + 9 résiduels au canal ALERTE). Premières prises : decorPalette
hex corrigé, issues #162 (spec Poudre noire ignorée) #163 (clés names⇄speciesRace). ⚠ Leçon : l'agent
fondation a déclaré son extension de gen-registry « rétrocompatible » — FAUX (alias renommés sur les
26 registres) ; la garde de dérive CI l'a pris ; vérifier les CLAIMS de compatibilité des agents, et
un `_registry.generated.ts` modifié dans le WIP partagé peut être À MOI (gen le réécrit).
**Tri des excuses TERMINÉ 2026-07-06 soir** (CI verte `b870c329`) : 0 vraie excuse, 0 [entériné]
écrit — les 3 « vraies » étaient des dettes : SpecEntry legacy SUPPRIMÉE (`1426e804`), recouvrement
Embrigadement = mécanique RAW complète non modélisée → issue #164 (MDG 15 l.245 verbatim),
sens/#158 déjà corrigé par la session // (`485916c5`, fermé par le hook post-commit). Restent 8 faux
positifs au canal ALERTE avant flip d'EXCUSE_GUARD_ACTIVE. Garde `enterine-guard.mjs` écrite
(PreToolUse ask = la validation user) — branchement settings.json TOUJOURS en attente de la main
du user (avec poison-postcheck). ⚠ Incidents encaissés : commit embarquant le WIP #157 d'autrui
(CodexEdit — 3e collision fichier-partagé du jour ; réparé par splice d'index `02154728`) →
**prochaines vagues d'agents EN WORKTREE + relire CHAQUE fichier stagé** ; pre-commit corrigé pour
scanner le BLOB STAGÉ pas le working tree (`b870c329`).
**Lot 1 vague 2 LIVRÉE 2026-07-06 soir** (`11ad15f9`+`f1f231f6`+`16e042f0`) : **94/94 datasets sous
contrat, PENDING vide** (tout nouveau JSON doit naître avec son def). Algèbre Flow/Formula/Ref/…
consolidée dans schemas/common.ts (+ bug zod : z.intersection d'unions strictes ne fusionne pas).
Prises : nurgling décalage de colonne réparé, spells.cn ×101 string→number, Money|null (cascade
priceToMoney), bug moteur expandOp/escapeStrength corrigé (TDD), optionals composés → #174 ; backlog
#169 (EffectOp.on 'victim'/'self' hors union — 'self' SUSPECT sémantiquement), #170 (engineerTest
dormant), #171 (traits.suffix fantôme), #172 (appearance.legs fuite de type). ⚠ 2 splices d'index de
plus (trappings/careerLevels mêlés au chantier d'armes parallèle) — le splice entrée-par-entrée avec
garde anti-mélange est le patron qui marche, MAIS **PIÈGE GIT : `git commit -- <chemins>` committe le
WORKING TREE de ces chemins, PAS l'index** — il a écrasé le splice (machines #156 embarquées sans leur
qualité `equipe` → CI rouge, réparé `89116fc1`). Un splice par `update-index --cacheinfo` se committe
SANS pathspec (l'index fait foi).
**Restent Lot 1** : validation à la sauvegarde éditeur (+ recette navigateur), types index.ts → z.infer
progressif, section conventions docs/donnees.md (bloquée par WIP d'autrui). Puis Lot 2 (persistance)
et Lot 3 (usine dans le clone).

**Classe « bélier » gardée + Lot 2 LIVRÉ 2026-07-06 nuit** : l'incident #156 (bélier modélisé « arme
portée », justifié par « RAW ne l'exige pas » — FAUX, ADE II ch.8 exige l'Équipe) a révélé une classe
que même le volet excuses n'aurait PAS attrapée (aucun motif ne matchait une affirmation-RAW). →
famille `scanRawClaims` (`6166143f`) : thèse sur le RAW sans réf de livre ADJACENTE (±120 car. — le
bloc entier ne suffit pas, l'en-tête bélier citait ADE II ailleurs) = ALERTE au stylo + pre-commit ;
data-edit-guard règle 4bis : la FORME suit l'INTENTION (Équipe ⇒ poste servi). Leçons d'orchestrateur :
auditer la FORME de déploiement, pas que les valeurs ; un test vert peut verrouiller un modèle faux ;
toute claim RAW d'agent = poison présumé à rouvrir au Source. Lot 2 (`83606921`) : `migrateDoc`
primitive unique (saves SAVE_VERSION 2 + patch ad hoc→migration officielle, parseProject migre,
roster versionné + erreur UI, mismatch coop = message typé pré-fermeture), golden save v1 + cliquet
bump-sans-fixture. settings.json BRANCHÉ (autorisation explicite user) : poison-postcheck +
enterine-guard actifs pour toute nouvelle session.

**Gotcha machine (non commitable)** : `core.hooksPath` n'était PAS configuré dans le clone —
le post-commit #137 n'avait jamais tourné ; posé à la main le 2026-07-06 (`git config core.hooksPath
scripts/git-hooks`, ce que fait le postinstall). Après tout nouveau clone : `npm install` l'active.
Le canari (cron + dispatch) ne s'active qu'une fois `canari.yml` fusionné sur `main` (limitation GitHub).
