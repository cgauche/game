---
name: user-doctrine-forme-canonique-unique-jets
description: "Doctrine utilisateur (2026-08-20, verbatim) — TOUT jet migre vers la forme canonique, y compris les tirages de monde jamais surfacés ; « un seul et unique endroit à modifier » pour fonctionnement/calculs/affichages. Un stock d'inline est une dette décroissante vers ZÉRO, jamais un registre permanent."
metadata: 
  node_type: memory
  type: user
  originSessionId: c8f120aa-33d4-4eb8-8332-4e74068f3313
  modified: 2026-08-24T14:37:16.358Z
---

Directive utilisateur (2026-08-20, verbatim, au fil du lot #1426) : « On migre tout vers une forme
canonique, genre si demain on change le fonctionnement des jets, ses calcules, les affichages ou que
sais je, je n'ai qu'un seul et unique endroit a modifier »

Formulation la plus décisive (2026-08-24, verbatim, lot #1479) : « On a pas 36 types de jets
différents dans l'application que je sache. A partir du moment ou je dois faire un jet, il doit
apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative, que je le subit, face a un
adversaire ou face a ... une maladie ... » — une TAXONOMIE de jets (champ `klass`/`RollClass`) est
interdite en soi : la seule variation légitime est la forme MÉCANIQUE du contenu (mono/bande N
participants, table d100, dé posable), qui se DÉRIVE de la requête, jamais ne se déclare en
catégorie. Contexte : j'avais présenté « subi meurt » comme le lot, en laissant `batch` discutable —
l'utilisateur a corrigé (« Tu m'inquiete ») : c'est le champ entier qui est le bug.

**Portée** : ce n'est pas seulement « surfacer ce que le joueur contrôle » (#939/#1426) — c'est que
TOUT tirage (acteur, monde, rejeu post-commit, tirage narratif) passe par LE canal canonique
(seam/porte), la surface n'étant qu'une POLITIQUE de ce canal (décidée au socle, jamais au
call-site). Un `d100(rng)` inline « légitime parce que jamais montré » reste un point de divergence
future : le jour où le fonctionnement/le journal/l'affichage des jets change, c'est un site de plus
à retoucher.

Précision (2026-08-24, verbatim, lot #1501) : « Je n'aime pas t'entendre dire "Dont openRoll coté
monde", comme si ca voulait dire qu'il y avait plusieurs facon de gérer ça ... ce n'est pas a toi de
décider comment les jets interragissent avec l'utilisateur » — l'interaction d'un jet avec
l'utilisateur N'EST PAS un choix (ni de site, ni d'orchestrateur, ni de design au cas par cas) :
l'OBJET détermine sa porte (un Test → `openRoll` ; un tirage non-Test — chance d'occurrence,
contenu — → `deMonde`), le SOCLE détermine seul la surface. Présenter deux portes comme des
« options » = une erreur de CLASSIFICATION d'objet déguisée en décision ; garde de forme consignée
sur #918 (deMonde alimentant une évaluation de Test = échec nominatif).

Précision (2026-08-24, verbatim, sur `deMonde`) : « L'application donne la possibilité de controler
tout dont l'environnement non ? » — OUI, en STRATES (précision user même jour : « En mode solo tu ne
controle l'environnement que si tu active l'option, comme les jets fixés ») : par défaut on VOIT les
dés du monde (rangée + Lancer) ; on ne les CONTRÔLE (valeur posée) qu'avec l'option Dés fixés
(arbitrage 2026-08-23 : « option = POSE seulement, d'office = cadence auto seule ») ; le silence
n'existe que par cadence/ordres. Conséquence : la catégorie « tirage sans fenêtre de pose » (`deMonde`)
n'est PAS une case durable — c'est le TROU RÉSIDUEL de ce contrôle (8 sites mesurés → #1508, cible
zéro : sous le siège qui tient le monde, tout d100 d'environnement devient posable, la politique à
UN endroit). Sur table, un MJ lance chacun de ces dés — l'outil ne confisque rien.

**How to apply** :
- Les classements « HORS périmètre de surface » ne sont PAS des exemptions de canal : ils vont au
  canal sans fenêtre.
- Un lot de migration migre TOUT dans le geste (rappel utilisateur au même fil : « Tu sais ce que
  je pense des demi-migrations ») : le compteur qui l'accompagne NAÎT À ZÉRO et garde la RÉCIDIVE —
  jamais une liste de résorption créée peuplée.
- Un stock hérité N'EST PAS un statu quo acceptable (2e rappel utilisateur, même fil : « tes stocks
  hérités, c'est une preuve de demi-migration et donc un aveu d'échec ») : un stock qui ne décroît
  qu'opportunistement (« un lot passait par là ») est une demi-migration PARQUÉE — il se PROGRAMME
  en campagne d'extinction datée cible zéro, il ne se « maintient » pas. Le cliquet empêche
  d'empirer ; il ne remplace jamais la fin du chantier.
- Un obstacle réel à une migration REMONTE à l'orchestrateur pour décision — un agent ne classe
  rien en dette de son propre chef.
- Corollaire du credo « le socle RÉSOUT, les feuilles ADRESSENT » : l'élément N+1 coûte une ligne
  déclarative, jamais la recopie d'un patron.
Lié : [[game-doctrine-contrat-affichage-jet-unique]], [[feedback-exemption-structurelle-re-triee-quand-invariant-bouge]].
