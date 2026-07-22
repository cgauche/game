---
name: game-pa-statblock-apparence-opt-in
description: "Doctrine — les PA d'un statblock (trait Armure LDB 85) sont de la MÉCANIQUE pure ; l'art d'armure synthétisé est un OPT-IN CURATÉ par créature (#774). Supersède le volet visuel de #181/#182."
metadata: 
  node_type: memory
  type: project
  originSessionId: bbc9d6ec-8826-4d31-9fd2-56b7bc29ff8d
  modified: 2026-07-22T19:25:23.092Z
---

**Arbitrage utilisateur (2026-07-22, verbatim)** : « Les PA ne devrait pas impacté l'apparence,
sauf si on le décide. A voir comment le faire. » puis « Car le troll en armure c'est marrant mais
ca n'a pas de sens / Mais un garde/orc nue c'est absurde aussi. »

**Doctrine** : le trait `Armure` (LDB 85 l.38-39, « une armure OU une peau épaisse ») ne distingue
pas porté/naturel → aucune déduction visuelle automatique. Par DÉFAUT, `synthArmour`
(`enemyProfile.ts`) = PA par localisation SEULEMENT, aucun art. L'art d'armure synthétisé devient
un **opt-in de DONNÉE éditable par créature** (champ type `armurePortee` sur l'entrée bestiaire,
exposé au Codex) — ni « troll plaqué » ni « garde nu » : la CURATION tranche, créature par créature.
Opté = art PLEIN, zones dérivées pied/main/cou comprises (mieux qu'avant pour un Guerrier du Chaos).

**LIVRÉ INTÉGRALEMENT (#774 FERMÉ, commit `8e27186f` 2026-07-22)** : champ éditable
`appearance.armurePortee` (schéma `common.ts`, toggle Codex `CodexEdit`), `synthArmour(ap, armurePortee)`
= `[]` sans opt-in, art PLEIN zones dérivées comprises avec ; `ItemInstance.synthetic`/`DERIVED_SLOTS`
du premier pas `23ba6245` SUPPRIMÉS (morts). **Curation : 100 entrées** posées par catégorie
(arbitrages user : squelettes/hommes-bêtes PA≥4, prêtres et paramilitaires TOUS, orcs/skavens
combattants, bêtes/démons/trolls naturels, racoleurs/civils non). Parité #181/#182 étendue à
l'override PAR ENTITÉ (réfutation du juge corrigée : `spawn.ts` porte `armurePortee` dans
`appearanceOverride`, `enemyRigProfile` lit `ov ?? cd`). ⚠ Lièvre exhumé par la passe : **#775** —
`armourFromTraits` rend 0 PA pour tout arg TEXTUEL (« Peau 1 », « Cuir 2 », barde par localisation)
→ des créatures se battent SANS leurs PA RAW (sev:majeur, ouvert).

**Chaîne de causalité à retenir** (leçon d'orchestration) : recetteur (« Nu civilisé ») et codeur
(« résolution correcte ») avaient TOUS DEUX tort à moitié — seul le juge VISION sur les captures
a révélé le vrai coupable (démon BARDÉ de plaques synthétisées). Deux agents qui se contredisent
→ faire trancher par la PREUVE PRIMAIRE (pixel/dump), jamais par le rapport le plus confiant.

Lié : [[game-rig-zones-equipables-nu-espece]] (le chantier qui a exposé le cas),
[[game-doctrine-une-tenue-nhabille-pas-le-porteur]] (même famille : l'apparence appartient au
porteur), #774 (mécanisme + curation), #770 (matériau par label — même zone de code).
