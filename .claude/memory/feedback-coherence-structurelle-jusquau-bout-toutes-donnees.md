---
name: feedback-coherence-structurelle-jusquau-bout-toutes-donnees
description: "Rappel 2026-08-23 : le credo (réutiliser le canonique, zéro duplication) vaut pour les STRUCTURES DE DONNÉE — l'inventaire d'un lot se fait par CONCEPT sur tous les datasets, jamais par fichier du ticket"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-23T08:16:51.376Z
---

Verbatim utilisateur (2026-08-23) : « Ca serait bien que l'application soit cohérente dans sa structure non et jusqu'au bout, que ce soit les carrières que les races, les creatures, etc ... » — « Cette remarque ce n'est pas seulement pour les spécialisations par contre » — « Tu sais c'est deja dans le credo ... » — « il n'y a aucune raison d'avoir autant de structure différente, même entre type. Il faudrait fournir une structure type partagé avec tout le monde et l'imposé comme structure obligatoire pour tout json de l'application ».

**Why :** ce n'est PAS une règle nouvelle (credo : réutiliser le canonique, zéro duplication ; [[feedback-jamais-de-demi-migration]] ; [[game-doctrine-une-entite-n-livres-n-variantes]]). Le défaut était le mien : j'ai traité le concept « choix de spécialisation » sur le dataset du ticket (créatures, 53 textes) alors que carrières (`specOptions` en libellés), talents/signes astraux (littéral dans une op), créateur (regex sur le libellé) et traits (args « deux au choix ») portaient le même concept sous d'autres formes — et le même schéma (`advancementRefSchema`) existait déjà.

**How to apply :** l'inventaire d'un lot de forme se fait par CONCEPT (grep du concept dans tous les `src/data/*.json` + schémas + moteur), jamais par fichier ; la forme cible est le schéma partagé existant (`schemas/common.ts`), et le lot va jusqu'au moteur (une porte). Cible tranchée par l'utilisateur : UNE référence GÉNÉRIQUE `entityRefSchema {id, spec?, choix?, value?}` pour TOUTE entité (compétence, talent, trait, objet, sort…), variantes par COMPOSITION seulement, IMPOSÉE à tout JSON par une garde structurelle sur les defs. Chantier : #1463.
