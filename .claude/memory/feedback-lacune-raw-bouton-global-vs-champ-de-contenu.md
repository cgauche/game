---
name: feedback-lacune-raw-bouton-global-vs-champ-de-contenu
description: Le « cas 1 » du credo (RAW renvoie au MJ → valeur maison) recouvre DEUX formes — bouton global vs champ authoré sur le contenu ; les confondre est une erreur de modélisation
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f99ca0f7-6f7b-4bd6-9080-4fe86b48eb33
---

**Arbitrage utilisateur du 2026-07-15, verbatim :** « Oui enfin ici ce n'est pas une valeur maison,
c'est scénario dépendant »

Contexte : j'avais classé le niveau de Faveur de l'Activité *Consulter un Expert* (LDB 23 l.120 —
« Le niveau de la Faveur due dépend de la complexité – ou du danger – de l'information que vous
cherchez, telle que déterminée par le MJ ») en « cas 1 du credo → valeur maison paramétrable taguée
`maison` ». Recadrage immédiat.

**Why :** « Valeur maison paramétrable » suppose un **bouton global** — un réglage unique, le même pour
toute la partie. Or le RAW fait ici dépendre la valeur d'une variable qu'il NOMME (quelle information,
quel danger). Un bouton global donnerait UNE Faveur pour toutes les informations du jeu : ce n'est pas
une approximation, c'est faux. Le credo dit « valeur maison **paramétrable et éditable en donnée** » —
j'avais retenu « maison » et perdu « donnée ». Les deux formes sont éditables, mais elles ne vivent pas
au même endroit et n'ont pas la même cardinalité.

**How to apply :** quand le RAW est silencieux / donne une fourchette / renvoie au MJ, trancher la forme
AVANT de coder, avec ce test : **« la valeur dépend-elle de quelque chose que le CONTENU connaît ? »**

- **Oui → champ sur l'ENTITÉ de contenu.** Authoré, éditable dans l'éditeur — **règle 2** du CLAUDE.md
  (« tout le contenu de campagne est éditable »), PAS la règle du `maison`. Ex. : niveau de Faveur porté
  par l'information/l'expert (LDB 23 l.120) ; PX porté par l'objectif de scénario (T3 Annexe IV).
- **Non → bouton global.** Le RAW ne chiffre RIEN et aucune variable de contenu ne s'applique — il faut
  un défaut universel. Ex. réel : `policy.ts:718` « MDG 13 l.522 — noyade Natation Complexe (–10) ;
  naufrage en pleine mer **non chiffré, valeur maison** ». → valeur maison paramétrable taguée `maison`,
  registre `policy.ts`. Cf. [[game-data-driven-architecture]].

⚠ **Le champ de contenu est le cas par DÉFAUT, le bouton global est l'exception.** Précision utilisateur
du 2026-07-15, verbatim : « **Souvent les scénarios prévoient des objectifs mineurs qui donne de l'xp.
Le bonus de RP c'est souvent offert par le scénario sur des chemins complexes pour récompenser le
jouer** ». J'avais pris la fourchette « attribuez de 70 à 100 PX » (T3 Annexe IV, qualité
d'interprétation) pour un bouton global : FAUX — c'est l'AUTEUR du scénario qui budgète cette récompense
sur une branche complexe. Une « fourchette qui a l'air d'un jugement d'ambiance » est presque toujours un
budget d'auteur déguisé : chercher la branche/l'objectif qui la porte AVANT de conclure au réglage
global.

**Application tranchée le 2026-07-15 — le volet *Jeu de Rôle* du T3 (Annexe IV).** Le RAW dit « Pour les
**sessions** où l'interprétation prend une place importante, attribuez de 70 à 100 Points d'Expérience ».
Ça présuppose une frontière de session ET un juge de la qualité d'interprétation : **aucun référent dans
un jeu sans MJ**. Ce n'est donc ni un bouton global ni un champ — c'est une **omission assumée**, et son
INTENTION est déjà servie par le mécanisme existant : l'auteur budgète de l'XP sur les chemins qui SONT la
solution roleplay. Récompense d'objectif et « bonus RP sur chemin complexe » = **le même mécanisme**, un
champ de récompense sur une branche authorée — pas deux concepts. Entériné sur délégation utilisateur
explicite (verbatim) : « **Tu peux entériné le bonus d'xp RP si tu pense que les bonus d'xp par objectif
s'approche plus d'un autre aspect** ».

Corollaire : un `maison` posé là où il fallait un champ de contenu est une dette de modélisation qui se
défend mal — c'est le patron « house-rule fallacieuse » de [[feedback-no-fallacious-house-rule-justification]] :
le test « je DÉFENDS ou je CORRIGE ? » s'applique.

Voir aussi [[feedback-jamais-de-constat-silencieux]] (contexte : c'est en instruisant les 9 marqueurs
« hors périmètre / arbitrage MJ » de l'Atlas que la distinction est apparue — les 9 étaient du poison,
mais certains portaient un VRAI point d'arbitre à l'intérieur de la règle, et c'est là que la forme se
choisit).
