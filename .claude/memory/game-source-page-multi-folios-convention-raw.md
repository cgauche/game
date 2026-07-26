---
name: game-source-page-multi-folios-convention-raw
description: "Arbitrage user 2026-07-17 : une entrée à cheval sur deux folios en cite DEUX — l'index imprimé du LDB le fait lui-même (36 entrées sur 819). Convention RAW, jamais à inventer."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Arbitrage user (2026-07-17, verbatim)** : « A une époque je voulais permettre d'avoir plusieurs entrée. Car certains talents sont présent dans plusieurs livres. **En tout cas si on regarde l'annexe d'un livre, il sera souvent marqué 2 emplacements de page** ».

**Ce qu'il faut en retenir : deux problèmes DISTINCTS, ne pas les confondre.**
1. **Même entité, PLUSIEURS LIVRES** → entrées DISTINCTES, chacune taguée à SA source. **Déjà résolu** : patron `3b651133` (« Mur de pierre AA en entrée distincte par source — collision résolue par coexistence »), rejoué pour `redoutable` (ZI) / `redoutable-mdg` (MDG). Voir [[game-collisions-variantes-livres-deferred]].
2. **Même entité, MÊME livre, DEUX FOLIOS** (à cheval : la prose sur l'un, la ligne de stats sur l'autre) → l'ancre `source` (scalaire) en désigne UN, les autres se déclarent en `alsoIn` (#563).

**La convention est RAW, pas maison — vérifiée avant d'agir** : l'index imprimé du LDB (`Source/Warhammer v4 - Livre de base version corrigée/85 - Traits de créature.md`, la grande table de renvoi) porte **36 entrées citant plusieurs folios sur 819** : `Armure299, 338`, `Artiste61, 132`, `Charme50, 119`, `Ragot51, 128`, `Magie du Chaos140, 257`, `Changer de Carrière48, 197`, `Marchandage126, 291`… **Le livre cite TOUS les endroits où l'entrée vit.**

**Cas fondateur mesuré** — `trappings.json:cimeterre`, `source.page: 90` : dans `Source/WH - V4 - Aux Armes/08 - LA RÉSERVE DE L'INTENDANT.md`, la prose est l.118 (entre les marqueurs folio **90** l.97 et 91 l.130) et la ligne de stats l.136 (après le marqueur folio **91** l.130). L'entrée est à cheval : **l'ancre `source` porte le folio de la PROSE** (90) — c'est la `desc` verbatim que la garde d'intégrité des folios localise — et le folio de la table est un emplacement SECONDAIRE. Viser la table depuis l'ancre met la donnée et la garde en désaccord alors que **les deux ont raison** : c'est le nombre d'emplacements déclarés qui manquait, pas l'un des deux folios.

**Why :** j'avais posé la question comme un arbitrage de goût (« prose OU stats ? », 3 options). C'était une **fausse alternative** : elles choisissaient toutes UN folio là où la source en déclare DEUX. L'user a redressé en pointant la source. Leçon générale : **avant d'arbitrer une convention de citation, regarder ce que le livre fait lui-même** — c'est la règle stricte 1 appliquée aux métadonnées, pas seulement aux règles.

**How to apply :**
- **L'ancre reste SCALAIRE, les autres emplacements sont des entrées à part.** `source: {book, page:number}` (`sourceRefSchema`, `src/data/schemas/common.ts`) est l'ANCRE — un seul folio, celui qui porte la `desc` (règle stricte 5) — et les emplacements SECONDAIRES vivent dans **`alsoIn?: SecondaryRef[]`** (#563 : même forme + une `quote` verbatim d'auto-attestation, prouvable dans le span du folio déclaré). Jamais `refs[0]` positionnel, jamais un `page` élargi en tableau : zéro churn sur les entrées à folio unique, et l'ancre reste saisissable au Compendium.
- **La garde y GAGNE en sévérité** : au lieu d'accepter « prose ou stats », elle vérifie que **chaque folio déclaré porte réellement quelque chose** de l'entrée.
- ⚠ **Troisième classe, NON couverte par cet arbitrage** : le « titre de section gouvernant » (`naval-traits.json:cabine-de-luxe` MDG 97 — la super-section `# AMÉLIORATIONS` est en 97, la sous-section en 98). L'entrée n'est **pas** à cheval : on a cité le folio de son PARENT. Question distincte, reste au cliquet.
- Rappel : `source.page` = le folio **IMPRIMÉ** ([[game-source-page-is-printed-folio]]), jamais l'index PDF. Le champ est éditable au Compendium — l'ancre comme les entrées d'`alsoIn` restent saisissables à la main.

Lié : [[game-atlas-raw-doc]], [[feedback-lacune-raw-bouton-global-vs-champ-de-contenu]] (même famille : « le RAW nomme-t-il la chose ? » — ici oui, l'index la nomme), [[feedback-arbitrage-agent-source-en-main]].
