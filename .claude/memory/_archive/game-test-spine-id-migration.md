---
name: game-test-spine-id-migration
description: Migration « spine des Tests + sorts/marché + SpellData.family résolus par id stable » LIVRÉE ; cluster casting-skill différé (combat)
metadata: 
  node_type: memory
  type: project
  originSessionId: f9d1d630-180f-4d99-b9db-4ad2cc2e40cf
---

Chantier multilingue « résoudre par id stable, jamais par libellé FR » poursuivi 2026-06-19. Un audit (3 agents) a trouvé **16 résolutions runtime par libellé** (pas les « 2 résidus » annoncés). LIVRÉ et committé (bd2b67d0 → b3db4fe7, branche feat/wfrp4-rpg-foundation), **suite hors-golden 3987 verte, typecheck vert** :

- **Spine des Tests** : `testValue` & famille (skillCharKeyById/altCharKey/actorHasSkill(+spec)/isSocialTest/partyBest) matchent par `skillId` ; `testStatePenalty` = `Set` d'ids ; `passiveSkillSum`/`traumaSkillPenalty` = match exact id ; `wearPenalty` émet un skillId (sinon **casse SILENCIEUSE** de la pénalité de port : `'discretion'` ≠ `'discrétion'`). **`testValue` a un 4ᵉ param `spec?`** (précision Savoir (Magie)/Métier — sans ça, `.find` prend la 1ʳᵉ instance du base-id). Tous appelants + données (spells/traits/qualities/maneuvers + 2× Dextérité→`characteristic:'Dex'`, scènes) + ~30 tests migrés. Garde-fou étendu dans `refs-migrated.test.ts`.
- **Affichage** : un libellé de skill montré se dérive TOUJOURS via `refLabel('skills',{id})` / `skillInstanceLabel` (CorruptionModal/RunModal/interludeFlow ; ops.ts/effectSummary/opSummary journaux), jamais hardcodé.
- **Sorts par id** : oocCastSpell/oocFocusSpell (store) + learnSpell de scène (combatEffects, éditeur émet l'id) via `findSpellById`. **Exposition** comptée par `effectId:'exposition-froid'`. **Marché** : stock garanti (curated) par id de trapping.
- **SpellData.family: CastingKind** (id stable) ajouté + peuplé sur 255 spells.json + 138 frenchy-spells.json (mapping mots-clés, gère les `type` irréguliers du fan-import). `grimoire.familyOf`/`canCastFromGrimoire`, `magic.isArcaneSpell`, partyFlow chaos, CharacterSheet/Creator branchent sur `family`. `SpellData.type` (libellé FR) n'est plus qu'AFFICHAGE.

**DIFFÉRÉ (combat-owned, session // active)** : cluster casting-skill = `CastInfo.skill`/`castPenalty.skill` (union `'Prière'|'Langue'|'Focalisation'`) + `magic.castingValue` (branche sur ces noms) + `castInfoIsPrayer` (combatFlow:2935, 8 sites + targeting/rollFlows). Changement de type d'union ATOMIQUE → patch combat coordonné (P3.2+P3.3 ensemble). Aussi : **Mains nues** par marqueur stable (Weapon SANS id, 6+ sites combat-adjacents) ; **P1.3 polish** (inputs libres GameOpEditor/FlowEditor `test.skill` → `RefField`, fonctionnels mais recette layout tf-row requise).

**Gotchas confirmés** : arbre PARTAGÉ volatil (combatFlow reverté 1×, etats-finitions.test reverté 1× — ré-appliqués ; un agent de fond mort au redémarrage du process → travail partiel à compléter). Golden snapshots (~600 fail) = WIP créatures/`enemyProfile` de la session //, **hors sujet**. JSON édité en masse via script node temporaire puis `JSON.stringify(,,2)` (LF sans newline final) — serialize.test = check de FORMAT. Prolonge [[game-refs-ids-migration]] et [[game-ids-internes-libelles-display-multilangue]].
