---
name: env-coordination-arbre-partage-sessions
description: "Protocole VÉCU de coexistence de 2 sessions orchestratrices dans le MÊME arbre (nuit du 2026-08-30/31, L2 #1548 × convoi d'audit) : trains annoncés, staging par hunks, gardes-au-disque = otages croisés, JAMAIS de reset sans l'inventaire du gelé, SendMessage comme canal."
metadata: 
  node_type: memory
  type: project
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-08-31T06:43:51.659Z
---

Vécu d'une nuit à deux sessions orchestratrices dans le même arbre (game-d6 vague L2 #1548 ⇄ audit-workflow, convois entrelacés). Ce qui marche et ce qui a failli coûter cher :

**Ce qui marche** :
- **SendMessage direct entre sessions** (ListAgents → nom ; répondre au `from` exact d'un message entrant). Annoncer ses TRAINS (fichiers × ordre) avant de committer ; l'autre gèle son staging pendant le passage et le dit.
- **Staging CHIRURGICAL par hunks** sur les fichiers mixtes (générés compris) : `git diff -U2 > patch`, filtre par index de hunks (script de colle `filtre-hunks.mjs`), `git apply --cached --recount -C1`. Un commit reste cohérent sans les hunks du voisin SI ses fichiers sources ne sont pas commités non plus (_ids.generated sans le def voisin = cohérent).
- **Docs générés pour le commit** : les générer sur l'INDEX, pas sur l'arbre — `git checkout-index -a --prefix=.tmp/` puis lancer les générateurs DANS .tmp (la résolution ESM remonte au node_modules racine), copier les docs, purger. Le garde `docs-vs-commit` l'exige dès que l'arbre ≠ l'index.
- Se signaler mutuellement les rouges de SES fichiers (graphies, labels, liens mémoire) : chaque aller-retour a attrapé un vrai défaut avant main.

**Ce qui a failli coûter cher** :
- **JAMAIS de reset/snapshot sans l'INVENTAIRE du codeur gelé** : 4 fichiers `M` ont été présumés « à mon codeur en vol » — son accusé de gel a révélé qu'il n'avait RIEN écrit : les fichiers étaient LA PRÉPARATION DE CONVOI DU VOISIN. Le protocole de remise à HEAD annoncé les aurait détruits. Un fichier sale n'a pas de propriétaire évident.
- **Vérifier les trains ANNONCÉS du voisin avant de dispatcher un codeur sur des fichiers communs** (le 4bis est parti pendant que le convoi voisin démarrait sur les mêmes fichiers — gel d'urgence).
- **Les gardes pre-commit balaient le DISQUE, pas l'index** : chaque session est OTAGE des défauts du WIP de l'autre (3 graphies `ch.`, un label de manifest, une fiche périmée ont bloqué 4 tentatives de commit). Deux gardes peuvent être structurellement CONTRADICTOIRES quand arbre ≠ index (docs-vs-commit veut l'index, raw:implemente veut le disque) — se démêle en distinguant qui génère quoi (reconcile ≠ implemente).
- Un message inter-session peut être RETENU pour approbation user (delivery notice) — ne jamais attendre une réponse, prévoir le repli.
- Adresser la BONNE session : vérifier avec l'user au doute (un message de coordination parti vers une session morte depuis 14 h).
