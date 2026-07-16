---
name: game-jalon-creation-perso-magie2-integres
description: "Jalons « création perso » + « magie Jalon 2 » fusionnés dans feat/wfrp4-rpg-foundation (merge dac4f3a, poussé) — créateur RPG data-driven, creation.ts/careerSlots.ts/grimoire.ts/corruption.ts, spellspecs curées"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f4d44f7-9831-4a00-b348-3cbc3133b909
---

Le 2026-06-10, `jaloncreationperso.bundle` (16 commits d'une session parallèle) a été fusionné dans `feat/wfrp4-rpg-foundation` (merge `dac4f3a`, poussé sur origin). Le bundle incluait déjà le Jalon 2 Magie (`jalon2magie.bundle` est donc redondant aussi).

Désormais dans la branche :
- **Création de perso complète** (LDB 04/05) : `engine/creation.ts` (d100 espèce/carrière, 100 Points, Richesse, âge/yeux/cheveux), `engine/careerSlots.ts` (spécialisations « (Au choix) »), `engine/talentEffects.ts`, créateur UI `src/ui/creator/` (rail par race, 3 zones, data-driven) + avancement PX fidèle.
- **Magie Jalon 2 Lots 0-8bis** : Péché/Colère (LDB 40), Corruption & mutations (LDB 19, `engine/corruption.ts`, `data/mutations.ts`), Imparfaites/Colère mécaniques, risques+Focalisation (LDB 46), Surincantation/États récurrents, ciblage ZdE, grimoire (`engine/grimoire.ts`), specs de sorts CURÉES `src/data/spellspecs/` (87 specs ; repli regex pour les non-curés).

**Pièges de fusion rencontrés** : conflit sémantique modales — HEAD (`f2c82f5`) avait supprimé `result`/`resultOk` de RollFlowShell au profit de `breakdown` (RollLine) + `outcome` (JournalLine) ; toute nouvelle modale arrivant d'une session parallèle doit être migrée sur ce motif (fait pour CorruptionModal). La coquille a gagné `darkPactable`/`onDarkPact` (Sombre Pacte LDB 19 l.41) côté bundle.

Prolonge [[game-modales-unification]] et [[game-magic-layer]].
