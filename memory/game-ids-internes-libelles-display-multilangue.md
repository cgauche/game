---
name: game-ids-internes-libelles-display-multilangue
description: ids partout en interne, libellés UNIQUEMENT à l'affichage joueur — pour le multilangue
metadata:
  type: project
---

Directive d'architecture (2026-06-16) : **l'application n'utilise plus les libellés comme clé, mais les
`id` stables — SAUF pour l'affichage aux joueurs.**

**Why:** le multilangue. Un `id` (slug) est indépendant de la langue ; un libellé (« Bénédiction de
Protection », « Solide ») est du texte traduisible. Toute comparaison/stockage/lookup par libellé casse
dès qu'on traduit. Les `id` restent stables → la donnée, le runtime et les sauvegardes survivent au
changement de langue.

**How to apply:**
- DATA (`src/data/*.json`) et structures RUNTIME persistées (`Combatant.spells`, `ItemInstance/Weapon.qualities`…)
  portent des **ids**. Jointures donnée→donnée = `Ref { id }` (cf. [[game-codex-compendium]]).
- Moteurs : comparer/chercher par id. Helper d'affichage SEULEMENT au bord UI : `refLabel(cat,ref)` /
  `findById(cat,id)` / `qualityRefLabel` / `trappingRefLabel` (dans `src/data/index.ts`) — c'est là que la
  traduction se branchera plus tard.
- Tolérance d'edge légitime (≠ violation) : un normaliseur d'AUTHORING qui accepte un libellé tapé/littéral
  de test et le résout en id (`parseQuality` résout id-OU-libellé ; `findSpell(label)→id` au spawn pour les
  labels d'auteur de scène). Le persisté qui en sort est en ids.
- Reste à traiter pour un multilangue COMPLET : les `key` des registres code (qualités/traits) sont encore
  des libellés FR — à terme, registre keyé par id + libellés traduisibles. Prolonge [[feedback-zero-retrocompat-briques-solides]].
