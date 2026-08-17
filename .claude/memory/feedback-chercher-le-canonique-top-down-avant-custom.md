---
name: feedback-chercher-le-canonique-top-down-avant-custom
description: "Chercher le mécanisme générique/canonique du CONCEPT (top-down, grep) AVANT de concevoir toute solution custom — pas après qu'on me pousse"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7dce2773-7f3e-4b49-bf35-1b5bc3ba4b66
---

Quand je repère une dette ou touche quelque chose qui relève d'un CONCEPT connu (spécialisation,
effet, jet, picker, ciblage, registre…), je dois **chercher le mécanisme générique EXISTANT du
concept AVANT de proposer/concevoir quoi que ce soit** — top-down depuis le concept, pas depuis le
symptôme local.

**Why:** 2026-07-05, sur la dette label-matching de `arme`/`a-distance`, j'ai correctement identifié
le problème (`SHAPE_BY_LABEL`/`RELOAD_BY_LABEL`) puis proposé une **solution custom** (résolution
« weaponId bespoke » dans `creatureEquip`). Il existait DÉJÀ `specsSource` + `SPEC_SOURCES` — le
mécanisme de spécialisation UNIVERSEL du projet (utilisé par 10+ traits : `groups`/`diseases`/
`mutations`/`breathTypes`/`damageTypes`/`cult*`/`arcaneDomains`, et les compétences). `arme`/`a-distance`
étaient le SEUL domaine jamais migré (pas de source `weapons` dans le registre). Je ne l'ai trouvé QUE
quand l'user a demandé « il n'y a pas une façon générique ? ». Verdict user : « effrayant que tu ne
l'aies pas vu et que tu étais prêt à partir sur ta solution custom. » C'est le MÊME échec qui a créé
`RELOAD_BY_LABEL` (imitation locale de `SHAPE_BY_LABEL` au lieu du canonique).

**How to apply:** j'ai ancré sur le SYMPTÔME local et raisonné latéralement. Réflexe correct = MONTER
au concept (« comment les spécialisations sont-elles modélisées ? ») et grep le concept
(`spec`, `specsSource`, `SPEC_SOURCES`, `SpecEntry`, « registre/registry/catalogue ») AVANT toute
conception. La gate credo « grep 2-3 variantes + table Primitives partagées » n'est PAS optionnelle et
se fait EN AMONT de la proposition, jamais en réaction à une objection. Un fix générique correct =
souvent « ajouter une entrée au registre existant + brancher », pas « écrire une résolution ad hoc ».
Voir [[credo-exemples-calibrants]] (RELOAD_BY_LABEL), [[feedback-effet-existant-general-parametrable]].

Récidive 2026-08-17, PAR LE CANAL DES MICRO-BRIEFS : trois violations de la même classe UI dans
la même journée, toutes injectées par des SendMessage de correction en vol (jamais par les briefs
complets, qui portaient la clause Brief-UI) — (1) infobulles de règle COMPOSÉES (paraphrase,
règle 5), (2) info routée en `title` seul alors que la charte ET un juge vision l'avaient déjà
condamné, (3) primitive « HoverTip » inventée sans UN grep, alors que `CodexRef`
(`src/ui/compendium/CodexRef.tsx`, tokens `--tooltip-*`, 16 consommateurs) était LE canon des
infobulles. Attrapé deux fois par l'USER, pas par mes filets. Verdict user : « Qui a oser saboter
Fable pour passer outre toutes nos régles lié a l'UI comme nos primitives, notre carte, nos
régles, et qui décide de réinventer la roue ? » **Règle : un micro-brief (SendMessage) qui touche
l'UI porte LA MÊME discipline qu'un brief complet — primitive nommée depuis la table OU absence
prouvée par grep collé, charte citée — sinon il ne part pas.** Le canal court est celui que
personne ne relit : c'est là que la discipline doit être la plus dure, pas la plus molle.
