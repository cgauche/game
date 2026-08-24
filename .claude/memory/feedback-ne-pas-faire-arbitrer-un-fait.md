---
name: feedback-ne-pas-faire-arbitrer-un-fait
description: "User 2026-07-26 : ne JAMAIS demander à l'utilisateur de trancher une question de FAIT (que dit le RAW, que fait le code) — ça se mesure au Source ou au code ; il n'arbitre que le produit et le goût."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c99d31-0f31-42bf-b192-e530e82d7635
  modified: 2026-08-24T08:34:52.338Z
---

**User 2026-07-26 (verbatim)** : « Moi je n'en sais rien, c'est tes relevés »

**Contexte** : chantier éditeur. J'avais posé une question à choix multiples sur la Disponibilité « ND » de 7 objets — en lui annonçant au passage que le livre n'en portait que 2. Il ne pouvait pas répondre : le chiffre venait de MES agents, pas de sa connaissance. Même dérive plus tôt dans la session sur la cadence de voyage, où il a répondu « C'est une décision qui demande de voir pourquoi c'est comme cela. Ticket, RAW ? » — c'est-à-dire *va instruire d'abord*.

**Why** : lui faire arbitrer un fait, c'est lui transférer un travail de vérification qui m'incombe, et fabriquer un faux « arbitrage utilisateur » sur une base que personne n'a contrôlée. Le RAW et le code sont des sources OBSERVABLES : il n'y a rien à décider tant qu'on ne les a pas lus. Une question posée trop tôt coûte un aller-retour et pollue l'historique des décisions (cf. la règle du dépôt : un « arbitrage utilisateur » sans citation verbatim se traite comme une évaluation d'ingénierie, révisable).

**How to apply** : avant toute question, classer.
- **FAIT** (« le RAW dit-il X ? », « ce champ a-t-il un lecteur ? », « combien d'entrées ? », « pourquoi le code est-il ainsi ? ») → on MESURE : Atlas `docs/raw/` puis `Source/` (FR uniquement) pour citer, `grep`/AST pour le code, `git log -S` pour l'histoire. On ne demande pas.
- **PRODUIT / GOÛT / RISQUE ASSUMÉ** (casser les saves des joueurs, quelle ergonomie d'auteur, quel comportement quand le RAW est SILENCIEUX après vérification, quelle priorité) → là seulement on demande, et on présente les options avec ce que chacune coûte.
Corollaire : quand une question mixte se présente, on instruit la part factuelle D'ABORD et on ne soumet que le résidu. Une lacune RAW ne se déclare qu'APRÈS lecture — précédent du même jour : l'Allonge « Variable » semblait exiger un arbitrage maison ; `LDB 62 l.163-164` donnait en fait la valeur par défaut (« 4 mètres plutôt que 2 »), donc rien à trancher.

**Corollaire 2 (2026-08-04, Faveurs/interludes)** : une question née de la STRUCTURE APPLICATIVE se
présente RAW-d'abord, jamais habillée en question de règle. Précédent : « consécutives » (LDB 23
l.149) traduit dans notre découpage en interludes avait fait naître « que devient la chaîne entre
deux interludes ? » — j'ai failli faire re-trancher ça en opposant RAW et moteur, alors que relue
RAW-d'abord (« consécutives » = rien d'intercalé), l'implémentation existante était la traduction
fidèle et il n'y avait RIEN à décider. User : « tu me parlais des activités et interlude, puis tu
m'as parlé du moteur applicatif en opposant le raw ». Le moteur ne définit pas la règle ; il la
traduit — présenter sa structure comme le cadre de la décision fabrique de faux arbitrages.

**Corollaire 3 (2026-08-10, Peur d'invocateur, #1202)** : proposer des OPTIONS MAISON à côté d'un
texte explicite EST une variante du même défaut — l'AskUserQuestion « RAW strict / exemption du
contrôleur (maison) / exemption de camp (maison) » mettait en scène un choix là où le livre avait
tranché (« chez les autres créatures », aucune exemption écrite). L'utilisateur a choisi « RAW
strict » puis rectifié : « ce n'est pas "mon arbitrage" et je ne veux pas le voir dans le code.
C'est le RAW ». Quand le texte est explicite, il n'y a AUCUNE question à poser — on implémente avec
la réf nue, sans tag de décision (poison famille 4) ; une règle maison ne se propose qu'après avoir
établi un vrai silence (et vit alors en règle OPTIONNELLE éditable, cf.
[[game-preference-vs-regle-optionnelle]]).

**Corollaire 4 (2026-08-24, #1479)** : une DOCTRINE DÉJÀ RENDUE ne se re-arbitre pas non plus — la
re-poser force l'utilisateur à re-trancher ce qu'il a déjà tranché et ouvre la porte à un arbitrage
contradictoire. Précédent : j'ai demandé « un Test subi par un héros possédé s'affiche-t-il ? »
alors que la chaîne #942 (« on nourrit l'hôte, on ne le duplique jamais »), la forme canonique
(2026-08-20) et le contrat d'affichage (2026-08-04) répondaient déjà. User : « Si tu te pose cette
question c'est que notre objectif n'est pas clair » puis « pourquoi aujourd'hui tu me demande un
arbitrage qui va a l'encontre même du système qui a des bases solides ». CAUSE AMONT : le ticket
#1479, écrit par MOI à la clôture de #1426, avait classé la branche `subi` « décision produit » sans
la confronter aux doctrines — la classification de périmètre a fabriqué une question ouverte, puis
le ticket a gagné l'autorité d'un brief. VERROUS : (a) avant tout AskUserQuestion d'arbitrage,
confronter la question à la chaîne d'invariants (tickets-programmes #942/#939 + fiches doctrine) —
si une doctrine répond, on ÉNONCE et on avance ; (b) tout ticket que J'ÉCRIS sur un socle (dont les
« restes » de clôture) porte `## Invariant` verbatim, comme les briefs de codeur — un reste ticketé
sans sa chaîne d'invariants fabrique la question ouverte de demain.

Lié : [[feedback-arbitrage-agent-source-en-main]], [[feedback-questions-stop-loop]],
[[feedback-deleguer-grounding-pas-que-code]], [[game-preference-vs-regle-optionnelle]],
[[feedback-invariant-cite-verbatim-jamais-depuis-un-rendu-de-juge]],
[[user-doctrine-forme-canonique-unique-jets]].
