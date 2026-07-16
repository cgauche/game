---
name: game-groups-specs-i18n-complete
description: "Migration i18n-safe des GROUPES d'appartenance et SPÉCIALISATIONS (specs) vers des ids canoniques — achevée 2026-07-05."
metadata: 
  node_type: memory
  type: project
  originSessionId: 68de8032-a27c-49b5-aed9-06d772773c1f
---

Le chantier « identités i18n-safe des GROUPES & SPECS » est **achevé** (2026-07-05, branche
`feat/wfrp4-rpg-foundation`). Plus AUCUNE comparaison par libellé d'affichage comme IDENTITÉ en logique
runtime (ce qui aurait cassé sous traduction). Complète la migration label→id ([[game-label-id-migration-complete]]).

**GROUPES** : registre SSOT `src/data/groups.json` (`{id,label}`), `findGroupById`/`groupLabel`. `groups.ts`
`groupsFor` émet des IDS (folder→catégorie, species→racial + **sous-espèce** `tileen`, trait→catégorie
`mort-vivant`/`demoniaque`, class/carrière curée `roublards→criminel`/`soldat`/`garde`/`chevalier`/`bailli`/
`juriste`/`noble`, culte via Talent Béni `sigmar→sigmarite`/`ulric→ulricain`). `groupMatch(cibleId,ids)` =
appartenance stricte par id (plus de `radicalTokens`/grammaire FR) + 2 cibles SPÉCIALES `tout` (universel)
/ `vivant` (≠ mort-vivant/démon). `domainAttributes` unifié (trait→groupe, plus de `hasTraitKey`). Cibles psy
de `creatures.json` = ids ; virgule = split multi-cibles ; « au choix » = wildcard inerte ; ~17 cibles pure
flavor laissées inertes (listées dans `registry.test.ts`, aucune invention).

**SPECS** : `SpecEntry = string | {id,label}` ; `specsOpen?` (fermé/ouvert data-driven) ; `specsSource?`
(`weaponGroups`/`domains`/`winds`/`cults`/`seaShanties`) ; `specLabel(cat,refId,specId)` résout id→label
localisé (repli verbatim). Domaines : armes (weaponGroups ids), langue/chevaucher/discretion/art/resistance/
musicien/voile/artiste/sens-aiguise (fermés), savoir/metier/divertissement/dressage/… (ouverts), magie
(focalisation+magie-des-arcanes sur `domainId` — **Vents↔Lores réconciliés**, focalisation affiche le Vent,
arcanes le Lore ; `domains.json` a un champ `wind`), cultes (beni/invocation/magie-du-chaos = `gods.key`).
Avancement/désignation par `(id, specId)` via `refKey` (plus de `splitLabel`/`label.slice` en résolution).

**Fix racine trouvé** : `character.ts resolveSpecId` comparait un libellé round-trippé à l'entrée miroir
(un id nu) → tout héros créé stockait « Base » au lieu de « base ». Corrigé en passant par `specLabel()`.

**GARDE EXHAUSTIVE** (`refs-migrated.test.ts`) : pour CHAQUE def fermée à specs, toute instance (dont
`makePregens()`) doit avoir un spec = id connu. Vérifié : typecheck 0, suite 8685 verte, navigateur 0 erreur.

**Puis (Stop hook « aucune dette / aucun élément différé ») — 2 items initialement laissés RÉSOLUS + le
sweep a trouvé PLUS d'axes que le plan** (`type`/`subType` frères non cartographiés) :
- engine `buyTalent`/`buySkillAdvance` prennent l'**id** (fin du round-trip finder-by-label) — 49f52f9a + b9ec2db4.
- `combatFlow` domainCasts par `spell.domainId` (fixture corrigée) — 54dee232.
- **Grimoire cultes** Invocation/Chaos : ne comparent plus `spell.subType` (libellé « Déesse-Araignée »/
  « Gueule »/Lore = traduisible ; commentaire « déjà i18n-safe » FAUX) → id-linkage `gods.json`
  (`miraclesOf`, comme Béni ; nouveau `chaosSpells: Ref[]`). Suppression aussi du repli `subType` de
  `wildcardSpecs`. Commit 52baaf7e.
- **Qualité `subType`** (arme/armure/objet, registre `qualitySubtypes.json`) — 2d60774e ; **Qualité `type`**
  (atout/defaut, `qualityTypes.json`, DTO `QualityInfo.type` aussi id) — 11419417.

**Heuristique** : le plan sous-compte ses axes. Sweeper `\.(type|subType|kind) (===|!==) '[A-ZÀ-Ü]'` dans
`engine`+`state` (hors discriminants internes légitimes) pour CHAQUE champ frère ; un « i18n-safe » en
commentaire = drapeau rouge, lire les valeurs. Grep de contrôle final `=== spell.subType` / quality
type|subType en logique → **0**. Cf. [[game-raw-comments-suspect-read-source]],
[[game-exhaustive-guard-vs-per-domain]], [[game-curated-commit-interleaved-tree]] (commits isolés, autre
session en WIP massBattle concurrent).
