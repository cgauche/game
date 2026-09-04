---
name: user-arbitrage-de-de-monde-affiche-comme-un-critique
description: "Arbitrage utilisateur 2026-08-23 (#1426, verbatim) : un dé de MONDE (Météo d'Étape, Événement de bord…) s'AFFICHE comme un jet de Critique/Maladresse dès qu'un siège contrôle l'environnement — l'option « Dés fixés » n'ajoute que la POSE ; résolution d'office = aucun siège à la manœuvre (cadence auto) seulement. — 2026-09-04 (verbatim 3) : TOUT dé du monde, magnitudes et dispersion compris, se lance ou se fixe quand le jeu est paramétré pour"
metadata: 
  node_type: memory
  type: user
  originSessionId: 2a421ddf-a409-4ee5-990e-1d565fe6bd4f
  modified: 2026-08-23T12:12:30.366Z
---

Verbatims (2026-08-23, lot #1426 volet maritime) :
- « Etrange comme question, sachant que le code est sensé utiliser le même fonctionnement que si
  c'était un personnage controlable qui n'a pas le dé fixé. »
- « Mais la réponse est forcement: biensur que tu l'affiche ! On affiche les jets de maladresse, de
  critique, alors pourquoi tu voudrais ne pas afficher les jets de météo si je controle
  l'environnement ? »
- Sur le garde-fou « > ~3 fenêtres/jour » : « Retire moi cette limite de X a la con. »

**Règle** : une étape à table possédée par le monde = une étape à table possédée par un héros. Le
siège qui POSSÈDE (local ou distant) la voit et la LANCE (rangée + « Lancer ») ; l'option « Dés
fixés » ne fait qu'ouvrir la POSE (champ + rangées). Le socle ne résout d'office (et franchit) que
quand AUCUN siège n'est à la manœuvre (cadence auto), à la couture unique du curseur. Les pilotes
headless (tests, devtools) tirent la table eux-mêmes comme un jet de héros.

**Pourquoi j'ai failli me tromper** : j'ai lu « OFF = silence » (arbitrage de cadence du 2026-08-20)
comme « pas de rangée » ; il parlait de la fenêtre de POSE. Le jet lui-même se montre toujours.
Lié : [[user-doctrine-forme-canonique-unique-jets]], [[game-arbitrage-hud-console-rt-2026-08-16]].

**RÈGLE SIMPLE (verbatim 4, 2026-09-04, en réponse à mon replanning)** : « Je pensais pourtant avoir donné une régle simple dans le passé. L'outil peut etre utilisé comme Foundry, donc un outil pour simuler une partie de JDR. Donc tous les jets de dés sont exposables si on configure le jeu pour »

**Verbatim 5 (2026-09-04, même échange)** : « Vu que tous les jets passé par le même point d'entrée, il est inutile de se demander si le jeu est configuré pour »

**Comment appliquer (règle de décision, AVANT tout brief ou verdict sur un dé)** : un SITE ne se pose AUCUNE question — ni « est-ce un Test, une table, une magnitude, une dispersion ? », ni « le jeu est-il configuré pour ? ». Il envoie son dé au POINT D'ENTRÉE UNIQUE des jets ([[user-doctrine-forme-canonique-unique-jets]]) ; c'est la porte, et elle seule, qui sait si le dé s'affiche, se lance ou se fixe (siège qui tient le monde, option Dés fixés) — comme sous Foundry, où chaque lancer passe par le même dialogue. Un dé tiré hors de la porte (`rng()`/`d10()` dans une op, un applier, un flux) est une DETTE vers zéro, jamais une classe ; toute taxonomie qui exempte un dé (« magnitude », « conséquence canonique au registre », « sans fenêtre par contrat », « journalisé suffit ») est une invention à réfuter par construction, et un juge qui la produit est hors doctrine : son verdict tombe. Précédents de la dérive : AUTO_RESOLUS (B2, 2026-09-02), « magnitude journalisée » (B3-2b-c, 2026-09-04). Conséquence pour #1508 : le geste n'est pas « rendre N dés posables », c'est faire passer les N dés PAR LA PORTE — après quoi ils sont posables d'office.

**Verbatim 3 (2026-09-04, après le train #1657 B3-2b-c où le juge de diff avait classé le dé de hauteur de chute « magnitude journalisée, hors doctrine des étapes à table »)** : « Tu sais ce que j'ai dit sur les jets. Si on a un jet, on doit pouvoir le lancer/fixer le dé a partir du moment ou le jeu est paramétré pour (ici controller l'environnement/activer la possibilité de fixer le dé), ca inclus même le jet de dispersion. »

**Portée (précisée par ce verbatim)** : la doctrine ne se limite PAS aux étapes à TABLE (d100 à fourchettes). TOUT dé du monde — magnitude de conséquence (hauteur de chute 1d10/2d10/3d10 m, Dégâts 1d10 d'une chute, `unites` d'une amputation, dés de dégâts d'un effet), jet de dispersion d'une zone/d'un tir — doit être LANÇABLE et FIXABLE par le joueur quand l'option « contrôler l'environnement / fixer le dé » est active. Un juge qui range un dé dans une « classe » qui l'exempte (magnitude, conséquence, canonique au registre) contredit la doctrine : le verdict tombe, la doctrine reste ([[feedback-invariant-cite-verbatim-jamais-depuis-un-rendu-de-juge]]). Corollaire : « une magnitude tirée dans `applyOps` » est une DETTE vers zéro, pas une classe canonique — le registre `ENGINE_DELEGATED_ROLL_STOCK` se re-trie sous cette lumière (#1508).
