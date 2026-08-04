---
name: game-coop-dissociation-bg3
description: "Arbitrage user 2026-07-19 — cap coop structurel : chacun gère SON inventaire, intents par propriétaire, viser la dissociation des personnages façon BG3 ; jamais un nouveau miroir-hôte."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c73772-f9e8-48df-97c3-237da1659a39
  modified: 2026-08-04T09:32:21.128Z
---

**Arbitrage utilisateur (2026-07-19, verbatim)** : « l'hôte ne doit pas pouvoir tout faire au
marchand. Chacun gère SON inventaire au marchand. Un jour en mode coop l'hôte perdra son autorité
et les personnages seront dissociés, donc pense dans cette optique dès maintenant, comme dans
BG3. »

**Why** : la coop actuelle est un miroir-hôte hors combat (`src/net/intents.ts` — marchand/voyage/
hub refusés aux invités). Chaque nouvelle surface bâtie en miroir-hôte devra être re-démolie quand
les personnages seront dissociés.

**How to apply** : toute NOUVELLE surface qui touche l'inventaire, la bourse ou les possessions
d'un héros se conçoit en intents PAR PROPRIÉTAIRE (patron `INTERLUDE_INTENTS`, gate
`intentAllowedFor`) dès sa création — l'hôte reste l'autorité TECHNIQUE (relay), pas l'autorité
PRODUIT sur les biens d'autrui. Seul le propriétaire ALIÈNE (vend/abandonne/transfère) sa
possession. Premier périmètre livré par #619 ; programme complet : #627. Voir
[[game-socle-possessions-programme]].

**Précision 2026-08-04 (verbatim)** : « Je veux garder cela en tete sur les décisions d'hote, que
demain si je décide de séparer le groupe, on n'ait pas tout le système de coop a refaire.
L'exempme du temple et de la taverne c'est dans via la map de ville, ou on peut choisir des lieux
ou faire des actions. Certains pourraient amener vers des scenes uniques et d'autres juste des
actions dans l'interface comme aujourd'hui avec le marchand »
→ La dissociation cible d'abord le NIVEAU CARTE DE VILLE (CityHub : lieux → écrans d'interface OU
scènes uniques), pas la scène iso partagée.

**Modèle PRÉCISÉ 2026-08-04 (verbatim)** : « Apres je ne veux pas séparer le groupe dans le sens
ou si on ouvre une scene, tout le monde la suis même si leur personnage n'est pas présent. Apres
ca impact la temporalité (si le groupe se scinde en 2, on a 2 temporalités a suivre, on va suivre
le premier groupe puis le 2nd) »
→ PROJECTEUR SÉQUENTIEL, pas dissociation parallèle : la VUE reste PARTAGÉE (tous les sièges
suivent la scène/l'écran actif, leurs héros présents ou non — le modèle SpectatorChip généralise),
et un groupe scindé = DEUX TEMPORALITÉS JOUÉES L'UNE APRÈS L'AUTRE (fil du sous-groupe 1, puis fil
du sous-groupe 2 — la machinerie suspend/resume des cascades est le patron). CONSÉQUENCES : la
fenêtre modale UNIQUE reste le BON modèle (pas de multi-fenêtres par siège à construire) ; ce qui
manque = l'appartenance par SOUS-GROUPE (quels héros à quel lieu, en donnée), le PARCAGE d'un fil
pendant qu'on joue l'autre (temporalité par fil), et l'ouverture des intents d'exploration à qui a
le projecteur. Règles de conception pour TOUTE décision d'hôte/lot :
(1) un LIEU/écran de hub raisonne « quels héros sont ICI » (jamais « le groupe est ici ») — un
sous-ensemble doit pouvoir y être ; (2) [RÉVISÉE 2026-08-04] la vue est PARTAGÉE par design — les
écrans/scènes se conçoivent pour être REGARDABLES par un siège dont aucun héros n'est présent
(spectateur riche, jamais un écran vide ou cassé) ; (3) les MURS mesurés (2026-08-04, RÉDUITS par
le modèle projecteur) : la fenêtre modale active UNIQUE
(ActiveModal/pickActiveModalKey — une seule clé pour tous les sièges, SpectatorChip pour les
autres : deux dialogues simultanés impossibles) et la POSITION DE GROUPE unique hors combat
(`partyPos: Pt` store.ts:394, `moveParty` — aucun `pos` par héros hors combat ; `moveParty` est
HORS allowlist par TEST délibéré, intents.test.ts:26 « périmètre combat + groupe ») — la
dissociation exigera position par héros/sous-groupe + ouverture des intents d'exploration ;
⚠ à vérifier : le clavier d'exploration ne gate pas l'invité (keybindings `exploring(s)`) alors
que moveParty est hors allowlist — affordance morte potentielle de la classe #1050 ; (4) une scène unique ouverte par un sous-groupe = le patron
`members` des rencontres (roster partiel), déjà en donnée. Toute nouvelle surface de hub qui
violerait (1)-(2) recrée le miroir-hôte à démolir.
