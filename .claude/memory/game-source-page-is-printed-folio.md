---
name: game-source-page-is-printed-folio
description: "source.page dans src/data = la page IMPRIMÉE (folio lu dans l'en-tête du PDF), PAS l'index Marker/span-id ; #148 = erreur ponctuelle d'agent ; les 6 scans sont désormais folio-bakés + chapitrés (data-folio dans le .md)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8eeaebe7-e73c-4d41-8f69-3ac4d806d48c
---

Vérifié 2026-07-06 (LDB « À Enroulement » = folio imprimé **297** index PDF 298 ; AA « Cimeterre » = folio
**91** index PDF 93) : les `source.page` de `src/data/*.json` sont **DÉJÀ les bonnes pages IMPRIMÉES** (les
curateurs ont lu le folio dans l'en-tête/pied de page). Ce ne sont **PAS** des index d'ancre Marker
`<span id="page-N">`.

⚠ **Piège où je suis tombé** : « calibrer » un offset index→imprimé via `pdf.get_page_label(source.page)`
(pypdfium2) est un **RAISONNEMENT CIRCULAIRE** — `get_page_label(x) ≈ x−1` pour TOUT x, donc l'« offset
constant » qu'on observe ne prouve RIEN sur la nature de source.page. J'ai fait une migration de ~1863
pages sur cette prémisse fausse → corruption → annulée par **opération INVERSE** (script surgical sur
`source.page` uniquement, JAMAIS `git checkout` en arbre partagé — une migration emoji // touchait le
même arbre). Les tests `aa-base-weapons`/`fievre-cerebrale-pourpre` (qui assertent les folios) avaient
RAISON — ne jamais les bender pour matcher une migration douteuse.

**#148 (mauvaise page d'un agent) = erreur PONCTUELLE** (il a pris un span-id comme page), pas un défaut
systémique. Fix durable si voulu = doc/skill « `source.page` = folio imprimé (en-tête de page), jamais le
span-id » + éventuelle garde de range (page ≤ folio max du livre via `pageCount`). **PAS une migration.**
Vrai bug résiduel (pré-existant, pas de moi) : 15 « Activités de bataille » ADE II ch.08 dans
`activities.json` (Duel, Charge, Tuez la bête !…) ont un **n° de LIGNE .md** comme page (223, 219…) au
lieu du folio (~84-91) — petite passe curation un jour. La migration book-id, elle, est bonne et committée
(`21aa4881`, cf. [[game-book-relation-id-migration]]).

**MISE À JOUR 2026-07-07 — les .md fournissent maintenant livre+page+ligne pour TOUS les livres de règles.**
Demande user : la source `.md` doit donner le folio facilement (l'agent #148 n'avait pas la page). Fait pour
les 6 scans (AA/ZI/MDG/EDO/MSR/MSRC), commits `77dab03c`+`e411b433` (staging `_marker` supprimé) :
- **Méthode** : ré-extraction paginée Marker (`{N}----`, N=index PDF 0-based) → bake `{N}----` en
  `<span id="page-N" data-folio="F">` avec **F = N + offset** ; puis **retrait des ancres NUES**
  `<span id="page-N"></span>` (= l'index PDF sans folio, LE piège #148 + corrupteur de titres) ; puis
  découpe : **ALIGNÉE sur l'ancien chapitrage** (titre + page de début, via `marker-split`-logique) pour
  MDG/EDO/MSR/MSRC, **par en-têtes** pour AA/ZI (blocs uniques) ; `00 - Index.md` régénéré en **TOC à folios**.
- **Offsets par livre** (constants, vérifiés en-têtes + Cimeterre→91) : AA −2, ZI −2, MDG −3, EDO +1,
  MSR +1, MSRC +1. Les folios croissent bien chapitre par chapitre (sanity). Front matter pré-folio-1 →
  folios négatifs, confinés au `00 - Index` (jamais cité).
- **Scripts éphémères** (scratchpad `split-scans-final.mjs`/`bake-scan-staging.mjs`/`promote-scans.mjs`) —
  NON promus. Le `scripts/raw/marker-split.mjs` committé, lui, pointe encore des **pages PDF** et strippe les
  ancres → candidat à upgrade si on veut un pipeline reproductible (cf. [[game-mdg-new-book-pipeline]]).
- **Résidus** : (a) `Aventures à Ubersreik` a encore des ancres nues (jamais baké — campagne, pas règles) ;
  (b) les `00 - Index` des livres ÉTIQUETÉS pointent encore des pages PDF (bake `8e5b6d4d` n'a touché que le
  contenu) — cohérence folio à faire un jour ; (c) les 15 activités ADE II ci-dessus.
