---
name: feedback-docs-dates-poison-de-design
description: "Directive 2026-08-23 : les fichiers DATÉS de docs/ (plans, audits, maquettes) sont des instantanés jadis vrais — ils sont la CAUSE de la dérive des structures ; jamais une base de design, jamais une source de forme"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-23T09:41:20.820Z
---

Verbatim utilisateur (2026-08-23, chantier #1463 « format JSON unique ») : « Il faut faire vraiment attention avec les fichiers dans docs/ qui sont datés. C'est du contenu qui était vrai un temps et qui sont responsables de la dérive des structures qu'on a aujourd'hui. »

**Why :** un plan/audit daté décrit une forme de donnée telle qu'elle était (ou telle qu'on la voulait) à sa date ; repris comme référence par une session suivante, il fait naître une Nᵉ variante de la même structure — c'est le mécanisme même des 91 formes divergentes mesurées sur #1463. La politique `docs/` du CLAUDE.md (plans datés supprimés une fois exécutés) n'est pas tenue : `docs/plans/` en porte ~30 et plusieurs audits non datés à la racine.

**How to apply :** pour toute décision de FORME (schéma, enveloppe, référence, vocabulaire d'op) — grounding UNIQUEMENT sur le code (`src/data/schemas/`, `src/engine/types.ts`), les données réelles (`src/data/*.json`, sondes) et les références GÉNÉRÉES (`docs/*.md` produits par `scripts/docs/`). Un `.md` daté se lit au plus comme un témoin d'intention à re-vérifier, jamais comme une source. Corollaire de conception : la carte des structures doit être GÉNÉRÉE (`docs/structures-donnees.md`, DoD (0) de #1463) et gardée, sinon elle dérive comme les autres. Voir [[game-doc-derivee-jamais-ecrite-a-la-main]], [[feedback-md-porteurs-du-faux-se-corrigent]], [[feedback-coherence-structurelle-jusquau-bout-toutes-donnees]].
