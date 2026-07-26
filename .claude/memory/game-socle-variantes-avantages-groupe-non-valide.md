---
name: game-socle-variantes-avantages-groupe-non-valide
description: "Arbitrage user 2026-07-26 : les Avantages de groupe (AA) n'ont JAMAIS été joués — le mécanisme variants/activeVariant qu'ils portent n'est pas un précédent validé. Vérifier le socle AVANT d'empiler VDM dessus."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-25T23:25:40.776Z
---

**Verbatim user (2026-07-26)** : « Ne prends pas de raccourci, il y a des sujets sacrément complexe
dans le lot qui vont demander a prendre les bonnes décisions, car d'autres éléments vont se reposer
dessus dans l'avenir. Je parle autant de l'alchimie (dans AED II on a aussi un système sur les objets
magiques) que les régles modifiés sur la magie ou la creation de familier ou les rituel, et ce ne sont
que des exemples. **Je n'ai jamais eu l'occasion de tester les avantages de groupe, donc je ne peux
t'assurer que la base est stable ou validé.** »

## Ce que ça établit

1. **`combat-aa-avantage-groupe` n'est PAS un précédent éprouvé.** Le mécanisme `variants` +
   `activeVariant()` (`src/engine/variants.ts`) n'a que ce porteur en donnée (10 talents) — et il n'a
   jamais tourné en jeu. « 10 talents l'utilisent déjà » est un argument de POPULATION, pas de PREUVE.
   #564 dit d'ailleurs l'inverse : le jeu IGNORE la variante AA de 12 talents/traits.
2. **Un socle non joué se vérifie avant d'être chargé**, pas après. Fonder 460 entités VDM
   (9 sorts modifiés, 3 carrières, 2 talents, 1 compétence, 15 règles) sur ce mécanisme sans l'avoir
   prouvé bout-en-bout, c'est multiplier un défaut inconnu par 460.
3. **Les systèmes se recoupent ENTRE LIVRES — concevoir général, jamais par livre.** Nommés par
   l'user : l'**alchimie / objets magiques** (VDM ch.12 + ch.03 ∩ ADE II ch.04, épique #737-#742), les
   **règles de magie modifiées**, la **création de familier**, les **rituels**. « Et ce ne sont que des
   exemples » — la liste n'est pas close : chercher le recoupement AVANT de coder chaque sous-système.

4. **Réparer un socle EMMÈNE ses porteurs.** Verbatim user, même jour : « **En tout cas les avantages
   de groupe doivent aussi fonctionner. Quand tu juge que l'existant n'est pas bon, tu dois t'assurer
   de migrer les éléments qui l'utilisent pour qu'ils fonctionnent aussi** ». Donc : pas de second
   mécanisme posé à côté d'un premier resté mort, pas de « je sécurise pour mon chantier et je laisse
   l'ancien cassé ». La cible est que les Avantages de groupe soient JOUABLES, #564 fermé compris.

**Why :** l'user ne dit pas « c'est cassé », il dit « je ne peux pas t'assurer que c'est validé ». La
nuance est la charge de la preuve : elle est sur MOI, pas sur lui. Un précédent trouvé dans le code
n'est un modèle que s'il est prouvé — sinon c'est peut-être le poison à ne pas copier (même famille
que `RELOAD_BY_LABEL` copié de `SHAPE_BY_LABEL`).

**How to apply :**
- Avant de fonder un lot sur une primitive, demander : **a-t-elle déjà tourné pour de vrai ?** Si non →
  lot de vérification (audit statique de la chaîne registre→donnée→résolution→moteur→UI, puis recette
  navigateur) AVANT le lot qui l'utilise. Les défauts trouvés se corrigent dans le geste.
- Devant un sous-système d'un livre, **chercher d'abord le même système dans les autres livres** et
  concevoir l'union (doctrine [[game-doctrine-une-entite-n-livres-n-variantes]] : l'axe est le MODULE,
  jamais la source). Un système « VDM » qui ignore ADE II est un fork à venir.
- Ne jamais invoquer « N entrées l'utilisent déjà » comme preuve de solidité.

Lié : [[game-vents-de-magie-integration]], [[game-doctrine-une-entite-n-livres-n-variantes]],
[[feedback-verifier-les-claims-architecturaux-des-agents]], [[game-existant-poc-refactor-libre]],
[[feedback-chercher-le-canonique-top-down-avant-custom]].
