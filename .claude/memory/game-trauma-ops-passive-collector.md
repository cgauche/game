---
name: game-trauma-ops-passive-collector
description: Effets de séquelle (trauma) en GameOp + collecteur passif GÉNÉRAL passiveOps ; éditabilité JSON = reste à faire
metadata: 
  node_type: memory
  type: project
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

**Refonte « effets génériques data-driven, éditables comme les sorts » (demande user).** Le `GameOp`
(`engine/ops.ts`) est le **vocab d'effet PARTAGÉ** des sorts (édité via `GameOpEditor`). On l'étend à
TOUT effet passif pour que créer un trauma/trait/objet = de la donnée éditable, pas du code.

**Livré (2 commits) :**
- `f788a7a` — 4 ops passives GÉNÉRALISÉES ajoutées à GameOp (pas de drapeau étroit) : `skillMod(skill,mod)`
  (= ancien skillPenalty + dodgePenalty/Esquive), `moveScale(num,den)` (= movementHalved), `maxWeaponHands(hands)`
  (= noTwoHanded), `senseLoss(sense)`. + cas `applyOps` (un SORT peut les imposer) + champs `ActiveEffect`
  (skillMods/moveScale/maxWeaponHands) + `GameOpEditor` (OP_LABEL/OP_GROUPS/newOp).
- `e42768a` — `Trauma.{charPenalty,skillPenalty,dodgePenalty,movementHalved,noTwoHanded,sense}` → UN champ
  `ops: GameOp[]`. Producteurs (`traumaFromKind`/`permanentAmputations`/`consolidateAmputations`/
  `escalateSensoryLoss`/`fractureSequela`) construisent des ops.

**Le cœur = `passiveOps(c)` (`engine/trauma.ts`) : LECTEUR UNIQUE général.** Agrège les ops passives de
TOUTES les sources → un trait/objet portant `ops` sera lu À L'IDENTIQUE d'une séquelle (point d'extension
balisé). Gating PAR NATURE d'op (LDB 17/18/73/85) : `maxWeaponHands`/`senseLoss` = STRUCTUREL (annulé par
prothèse 'all' SEULE, hors Détermination/Insensible) ; `charMod`/`skillMod`/`moveScale` = douleur/mobilité
(ignorés par Détermination `ignoreCritMods` + Insensible `painlessIgnores`, annulés par prothèse —
'movement' pour moveScale). Les helpers (`traumaCharPenalties`/`SkillPenalty`/`DodgePenalty`/
`MovementHalved`, `cannotWieldTwoHanded`) lisent `passiveOps` ; consommateurs (`effectiveChar`/`testValue`/
`defenseValue`/`effectiveMovement`/`recomputeLoadout`) INCHANGÉS. Gate : suite engine 1004/1004 verte.

**RESTE pour la vision « éditer dans le Codex » :**
- **Trauma encore généré par CODE** (`traumaFromKind`/`permanentAmputations`) → PAS éditable en Codex.
  Éditabilité = **sortir les templates de séquelle en JSON** (réponse à « comment j'édite un trauma s'il
  n'est pas en .json »). Dataset de séquelles éditable + producteurs en lookup.
- **Prothèse** = encore name-matchée (`i.name==='Crochet'`/`'Fausse jambe'` dans `trauma.ts cannotWieldTwoHanded`,
  `partyFlow trainProsthesis`, `CharacterSheet.tsx`) → descripteur de training en DONNÉE.
- **Traits** (but initial user « éditer les traits comme les sorts ») : lecture PRÊTE via passiveOps. Reste
  `TraitDef.ops` (engine/traits/defs, 43 defs ; Vol/Taille/Éthéré = structurels, champs déclaratifs ≠ GameOp)
  + brancher la catégorie Traits du Codex (read-only aujourd'hui, registry.ts:243) au `GameOpEditor`.

Pièges : `store.ts`/`iso.ts` = refonte caméra d'une AUTRE session (test camRot store.test rouge = leur WIP,
pas le trauma) → exclus du commit. Prolonge [[game-data-driven-architecture]] + [[feedback-contenu-donnee-editeur-pas-code]].
