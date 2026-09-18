---
name: user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata
description: "WFRP 5e = édition SÉLECTIONNABLE ; en 5e le Core 5e REMPLACE le LDB (rien du LDB n'est converti), l'Appendice I ne sert qu'aux suppléments ; 5e en RAW strict, seuls écarts = nos errata ; l'existant n'est pas un frein ; VO gérée dans l'app, repli VF→VO, zéro traduction"
metadata: 
  node_type: memory
  type: user
  originSessionId: 60c2b9c9-5d2c-4ec0-88b2-c409c7dc078c
  modified: 2026-09-18T19:02:52.146Z
---

Arbitrages utilisateur de l'instruction du chantier 5e (#1816), verbatim :

- Place de la 5e (2026-09-18, réponse à « Quelle place la 5e prend-elle dans le jeu ? ») : « Édition sélectionnable (Recommandé) » — 4e et 5e coexistent, la partie choisit son édition à la création. L'option « Règles 5e à la carte sur base 4e » est ÉCARTÉE.
- Cœur d'édition (2026-09-18) : « L'appendice I sert uniquement pour les suppléments. Le livre v5 remplace le LDB v4 si on choisi cette édition. Si des régles sont dans le LDB mais plus dans la V5, elles ne doivent pas etre "converti". »
- Palier −50 (2026-09-18) : « Le -50 c'est une régle optionnelle de EDO, qu'il faut activer » — donc un cas de SUPPLÉMENT : activée en 5e, elle passe par l'Appendice I ; et « Les paliers on est sur du RAW ».
- RAW strict (2026-09-18) : « Mettre en place une nouvelle édition et gérer 2 langues c'est vraiment quelque chose de nouveau, certaines partie de l'application s'y prete bien, mais d'autres vont surement demandé des refacto/migration vers un système plus adapté. L'existant ne doit surtout pas etre un frein pour intégrer la 5ieme en RAW, les seuls éléments non RAW seront nos erratas en cas de "bug" dans cette version de la V5. »
- Langue (2026-09-18) : « Pas de traduction, on va gérer la VO dans l'application. Juste une régle général, si on est en VF et qu'on a pas le texte VF, on affiche la VO. »
- Arbitrages de la table Foundry (2026-09-18, réponse à la question de leur report au jeu) : « RAW 5e par défaut, table en option (Recommandé) ».
- Sentiers (2026-09-18) : « Et faire tout ca sans casser les sentiers important de l'application qui sont en cours (comme le sentier sur les structures, ou celui sur les portes uniques, ou les descriptions directement de la source et non plus recopié, et d'autres que j'ai oublié) »
- Cadrage (2026-09-18) : « Ne te lance dans rien sans un vrai plan solide ! »

**Why:** la 5e refait l'arithmétique du jeu (difficulté en DR, Advantage = inversion du dé, Momentum booléen, talents sans rangs) ; un mélange d'éditions produit un jeu qui n'existe dans aucun livre. Le Core 5e est un livre de CŒUR, pas un supplément : le traiter comme une couche de conversion par-dessus le LDB (ma première lecture de l'Appendice I, corrigée par l'utilisateur) ferait survivre en 5e des règles que l'éditeur a retirées.

**How to apply:** en édition 5e, une RÈGLE du LDB que le Core 5e ne porte plus n'existe pas — ni convertie, ni repliée ; l'Appendice I (`16 - Appendices.md` l.3-36 du Core 5e) ne s'applique qu'au contenu de SUPPLÉMENT. COMMENT le moteur et la donnée portent cette disponibilité n'est PAS arbitré ici : c'est de l'ingénierie révisable, instruite sur #1816 (une dérivation par `source.book` seul a été réfutée — elle viderait la 5e de tout le socle commun tant que ses emplacements 5e ne sont pas curés). Un module existant qui ne se prête pas à l'édition ou à la langue se REFACTORISE dans le lot qui le touche (voir [[game-existant-poc-refactor-libre]]), jamais contourné par une branche. Tout écart au RAW 5e est une entrée du registre d'errata, prouvée au PDF. L'option maison « Avantage de groupe en 5e » est parquée, désactivée par défaut, à reconfirmer (voir [[game-bascule-5e-pas-de-momentum-on-garde-avantage-de-groupe]]). Le chantier 5e ne casse aucun sentier en cours (#1388 prose adressée, #1463 fabrique `document()`, #1739 chaîne d'extraction, régime `sans-livre.ts`, `enumNomme`) : ce qu'il doit CHANGER à leur forme se négocie sur LEUR ticket. Carte d'orientation : [[reference-doc-differences-4e-5e-carte-jamais-source]].
