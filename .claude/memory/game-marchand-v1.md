---
name: game-marchand-v1
description: "Marchand LIVRÉ (v1+lot2, TERMINÉ) : achat/vente en panier, Disponibilité RAW (LDB 59), monnaie canon, Marchandage à engagement (verrou partagé achat/vente), réparation/évaluation/identification, re-stock #T3 persistant."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

Specs/plans : `docs/superpowers/specs/2026-06-08-marchand-v1-design.md` + `…-lot2-*`.

- **`src/engine/money.ts`** (pur) : monnaie impériale RAW LDB 57 (1 CO = 20 pistoles = 240 sous). `Money{gold,silver,brass}`. **Nomenclature CANON** (LDB 57 l.25/31/33) : couronne d'or = `CO`, sou de cuivre = `sc`, **pistole d'argent = notation `/`** — pistoles+sous se combinent en `S/C` (« 6/8 » = 6 pistoles 8 sous ; « 20/– » sans sou). `formatMoney` = SOURCE UNIQUE d'affichage.
- **`src/engine/disponibilite.ts`** (pur, seedé) : table RAW LDB 59 — Commune toujours ; Limitée 30/60/90, Rare 15/30/45 (Village/Ville/Cité) ; Exotique jamais (sauf curaté) ; quantités Village 1 / Ville 1d10 / Cité illimité (99), ×2 Commune, ÷2 Rare. `rollStock(catalog, settlement, rng, curated)` = instantané déterministe par seed.
- **Archétype** = 7ᵉ famille du registre `defs/` : `src/state/merchants/` (`MerchantArchetypeDef{category,settlement,resaleRate,curated?}`, `MERCHANTS` index, config `scripts/gen-registry.mjs`). Cf. [[game-creature-registry]].
- **Store** : `SceneEntity.merchant?{archetype,settlement?,resaleRate?}` ; `merchant` = instantané de visite (reset newgame) ; `interactEntity` priorise **dialogue > merchant > interact** ; `buyItem`/`sellItem` débitent/créditent via `money`+`craftPriceFactor`.
- **Helpers purs lot2** `src/engine/{bargain,appraisal,repair}.ts` — RAW LDB 60 l.10/12/22, LDB 63 l.97-98. `bargainBuyFactor`/`bargainSellFactor` (DR/Négociateur), `appraiseEstimate` (±10% Rare/Exotique), `repairCostBrass` (10%/PA perdu, 30% si brisée).
- **`ItemInstance.identified`** (false = masque les qualités à l'AFFICHAGE seul, elles restent actives en combat).
- **Marchandage — modèle final (RAW LDB 60 ne fixe pas la granularité, délégué au MJ)** : achat et vente = **2 négociations distinctes** (1 jet/visite chacune). **Botch** = net DR ≥ 6 → `merchant.soured`/**verrou `bargainLocked` PARTAGÉ achat+vente**, persistant dans `merchantStocks` (survit close/reopen), reset au réassort. **Engagement type panier** : après avoir négocié un prix, on ne peut plus AJOUTER ni RENÉGOCIER mais on peut RETIRER des articles (prix négocié tient sur panier réduit) et quitter librement (pas de softlock) ; **renier le marché** (négocier puis quitter sans payer/vendre) pose le verrou. **Score du marchand MASQUÉ** au joueur (ni `merchantValue` ni cible affichés — seulement jet/DR/verdict).
- **Panier + répartition** : Parcourir (tableau comparatif par famille, colonnes clé Dégâts/PA/Protection en emphase) → Panier (marchander le total, payer) → Répartition (héros par unité achetée) ; `closeMerchant` flush toute répartition non confirmée au 1er héros (rien n'est jamais perdu). Vente reste à l'unité (pas de panier de vente).
- **Re-stock #T3** : `merchantStocks: Record<entityId,{stock,rolledAt}>` PERSISTANT (déplétion survit aux visites), re-tiré seulement si `restockDays` écoulés (seed lié à `floor(gameTime/restockPeriod)`) — branché direct sur l'horloge #T1, sans la cascade #T3 complète.
- **Marchand DANS un dialogue** : Effet `{type:'openMerchant', entityId}` (dispatch `combatFlow.ts`, PAS store.ts — `applyEffects` y a migré) ; un choix de dialogue peut ouvrir la boutique puis fermer le dialogue.
- **Éditeur COMPLET** : inspecteur d'une entité `personnage` → menu « Marchand (archétype) » + overrides Bourg/Taux de rachat/Majoration d'achat/Réassort (vide = défaut archétype) ; Effet `openMerchant` dans le constructeur d'effets.
- **Qualité magique** : registre qualités `defs/` gagne `de-plaies-atroces.ts` (`dmgDRMode:'maxUnits'`, Dévastatrice, ADE2 l.228 vérifié).
- **Descriptions de qualités** = `engine/qualities/describe.ts` (`QUALITY_DESC` par clé canonique, toutes sourcées LDB) ; test anti-régression : chaque clé du registre DOIT avoir une desc.

⚠️ **Piège SSR-Zustand** : `renderToStaticMarkup` lit l'état INITIAL, pas le `setState` → composant connecté = le découper en présentationnel à props (comme `EffectList`) pour être testable.

⚠️ **Hazard arbre partagé (RÉCURRENT)** : des changements `store.ts` ont été absorbés par des commits // concurrents (`git add -A` d'une autre session capte le WIP avant mon propre commit). Absorption = **inoffensive** tant que `git diff HEAD <fichier>` est vide et les marqueurs présents en HEAD — ne pas s'acharner à « réparer » l'attribution avec des sessions // actives ; committer VITE après édition, vérifier l'atterrissage pas le n° de commit. Cf. [[git-commits-propres-wip-parallele]].

Recette navigateur FAITE à chaque lot (panier→marchander→payer→répartition→objets en fiche héros ; sous-onglets par famille ; carte de détail Atouts/Défauts). Suite verte, typecheck clean. **Reste** : rien de majeur — *(re-stock #T3 fait ; Marchandage 1 jet achat + 1 jet vente/visite = suffisant, option par-transaction non retenue.)* Lié à [[game-qualities-registry]], [[game-roll-modal-pattern]].
