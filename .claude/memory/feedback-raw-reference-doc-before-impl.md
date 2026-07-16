---
name: feedback-raw-reference-doc-before-impl
description: "Avant d'implémenter un élément RAW-dense, produire un DOC DE RÉFÉRENCE RAW cité ; ne PAS improviser depuis des lectures ponctuelles."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc8fbd88-39a7-45b7-a964-32b9d4050814
---

Avant d'implémenter un élément de règle (surtout RAW-dense : combat naval, artillerie, sous-systèmes), **produire d'abord
un DOCUMENT DE RÉFÉRENCE RAW détaillé** — lecture VERBATIM des chapitres concernés, citée ligne par ligne (`LIVRE ch.N l.X`),
couvrant TOUT le mécanisme (pas juste la phrase centrale). **Puis** implémenter fidèlement contre ce document.

**Why:** mes implémentations naval ont **répété les mêmes violations RAW** parce que j'improvisais depuis des lectures
PONCTUELLES (« je lis la ligne qui décrit la bordée et je code »). À chaque Phase le GM m'a rattrapé sur ce que j'avais
zappé : pour la seule bordée — **Recharge** (les pièces rechargent N Rounds), **munitions** (boulet/mitraille → Dégâts +
Atouts), **Dangereuse** (Incident), **Arme d'équipe N** (chaque canon = 2-4 servants ; sous-effectif → pénalités), et
surtout **l'équipage comme RESSOURCE** (un marin = 1 rôle/Round ; la même personne ne peut PAS faire manœuvre ET bordée —
j'avais laissé les mêmes PJ contribuer aux deux). Le GM : « chaque Phase qu'on fait, tu ne respectes pas le RAW. »

**How to apply:** pour chaque élément à implémenter — (1) lire le(s) chapitre(s) `Source/` EN ENTIER (pas un spot-read) ;
(2) écrire/étendre une fiche de référence citée (cf. l'Atlas RAW `docs/raw/`, [[game-atlas-raw-doc]]) qui liste le mécanisme
COMPLET + ses interactions + l'état d'implémentation (fait / faux / manquant) ; (3) implémenter contre la fiche, pas de mémoire.
C'est la discipline Atlas du projet ([[game-mdg-new-book-pipeline]]) — je dois la SUIVRE, pas la court-circuiter. Lié à
[[feedback-source-user-claims]] (le GM délègue le RAW ; vérifier MÊME mes propres lectures).
