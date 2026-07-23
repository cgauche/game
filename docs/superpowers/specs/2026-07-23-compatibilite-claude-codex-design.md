# Compatibilité Claude Code · Codex — design

> Date : 2026-07-23  
> Statut : design approuvé  
> Périmètre : outillage d'agents du dépôt uniquement ; aucun changement au moteur de jeu.

## 1. Contexte et audit

Claude Code et Codex sont deux surfaces de premier rang pour travailler sur ce dépôt. Aucun des deux
ne doit être traité comme un mode dégradé, mais les règles communes ne doivent pas être maintenues à
la main deux fois.

L'état audité présente cinq risques de dérive :

1. `CLAUDE.md` et `AGENTS.md` portent aujourd'hui le même corps avec quelques substitutions de
   produit, sans mécanisme qui prouve leur équivalence.
2. `.claude/skills/` et `.agents/skills/` exposent les mêmes skills, mais leur parité repose sur la
   discipline humaine.
3. `.claude/agents/*.md` et `.codex/agents/*.toml` décrivent les mêmes rôles dans deux schémas
   incompatibles ; une copie à l'identique n'est donc ni possible ni souhaitable.
4. `.claude/settings.json` et `.codex/hooks.json` dupliquent les hooks, y compris des commandes
   dépendantes de `CLAUDE_PROJECT_DIR` et, pour l'injection du credo, de
   `cat ... 2>/dev/null`. Cette forme n'est ni propre à Codex ni multiplateforme.
5. `package.json` ne fournit aucun `agents:sync` ni `agents:check`, donc ni le pré-commit ni la CI ne
   peuvent distinguer un adaptateur à jour d'une copie devenue divergente.

Le contenu du credo et de la mémoire projet existe aujourd'hui côté `.claude/`. La couche Codex
l'annonce, mais aucun miroir `.Codex` établi ne garantit encore sa disponibilité ni sa parité. Ce
contenu doit être commun au projet, tandis que les mémoires personnelles de chaque produit gardent
des cycles de vie et des formats propres. Le design doit rendre cette frontière explicite.

## 2. Objectifs

- Maintenir Claude Code et Codex comme deux entrées pleinement supportées.
- Définir une source initiale unique pour chaque contenu réellement commun.
- Générer des adaptateurs déterministes, lisibles et committés.
- Détecter toute dérive sans réécrire de fichier pendant un contrôle.
- Préserver les différences nécessaires entre les schémas d'agents Claude et Codex.
- Exécuter les hooks avec Node sur Windows, macOS et Linux, sans variable réservée à un produit ni
  commande de shell POSIX.
- Partager le credo et la mémoire projet, sans fusionner les mémoires personnelles.
- Permettre une migration progressive où chaque étape est contrôlable séparément.

## 3. Non-objectifs

- Unifier les produits, leurs modèles, leurs outils, leurs permissions ou leur UX.
- Choisir Claude Code ou Codex comme surface supérieure à l'autre.
- Traduire automatiquement un profil d'agent Markdown en profil TOML, ou l'inverse.
- Synchroniser les mémoires utilisateur situées hors du dépôt.
- Faire dépendre le jeu, `src/`, `server/` ou les données WFRP de cette infrastructure.
- Introduire un générateur générique de documentation sans rapport avec les agents.
- Modifier une règle métier, une donnée de campagne ou le moteur de jeu.

## 4. Architecture cible

Le pont comporte quatre familles, chacune avec une politique adaptée :

| Famille | Source initiale | Adaptateur ou paire contrôlée | Politique |
|---|---|---|---|
| Guide du dépôt | `CLAUDE.md` | `AGENTS.md` | génération déterministe |
| Skills projet | `.claude/skills/` | `.agents/skills/` | miroir adapté déterministe |
| Profils d'agents | `.claude/agents/*.md` | `.codex/agents/*.toml` | éditions distinctes, parité validée |
| Contexte projet | `.claude/credo.md`, `.claude/memory/` | `.Codex/credo.md`, `.Codex/memory/` | miroir projet déterministe |

Les mémoires personnelles restent hors de cette table : les espaces utilisateur de Claude et Codex
ne sont ni lus, ni copiés, ni comparés.

Le code du pont vit sous `scripts/agents/`. Un point d'entrée unique porte la découverte des sources,
les transformations et les validations. Les deux commandes npm n'activent que deux modes du même
moteur :

- `npm run agents:sync` calcule puis écrit les adaptateurs ;
- `npm run agents:check` calcule les mêmes sorties en mémoire et échoue si le dépôt ne contient pas
  exactement ce résultat.

Le mode `check` n'appelle jamais le mode `sync` et n'écrit rien.

## 5. Guides : `CLAUDE.md` vers `AGENTS.md`

### 5.1 Source commune

`CLAUDE.md` reste la source initiale du corps commun. Il conserve le vocabulaire Claude nécessaire à
sa propre surface et ne devient pas un gabarit abstrait illisible.

Le générateur produit `AGENTS.md` en trois opérations ordonnées :

1. poser un en-tête Codex propre, comprenant le titre `AGENTS.md`, la destination Codex et un
   avertissement de génération ;
2. reprendre le corps commun de `CLAUDE.md` ;
3. appliquer une table fermée de substitutions d'adaptation.

La table couvre uniquement les identifiants de surface connus :

| Source Claude | Sortie Codex |
|---|---|
| `CLAUDE.md` | `AGENTS.md` |
| `Claude Code` | `Codex` |
| `Foundry/CLAUDE.md` | `Foundry/AGENTS.md` |
| `.claude/credo.md` | `.Codex/credo.md` |
| `.claude/memory/` | `.Codex/memory/` |
| chemin personnel Claude cité dans la section mémoire | chemin personnel Codex correspondant |
| libellé de session cloud Claude | libellé de session cloud Codex |

Les substitutions sont exactes, ordonnées et testées ; il n'existe ni remplacement flou par
expression régulière ni réécriture sémantique libre. Toute nouvelle différence de surface exige une
entrée explicite dans cette table et un test.

### 5.2 En-tête de l'adaptateur

`AGENTS.md` commence par une bannière stable indiquant :

- qu'il est généré depuis `CLAUDE.md` ;
- qu'il ne doit pas être édité directement ;
- que `npm run agents:sync` le régénère ;
- que `npm run agents:check` vérifie sa fraîcheur.

La bannière ne remplace pas le vrai titre ni l'introduction Codex. Le fichier reste lisible seul par
un humain et exploitable directement par Codex.

Le générateur refuse de produire `AGENTS.md` si un token Claude connu subsiste dans une zone qui doit
être adaptée. Ce contrôle empêche une adaptation partielle silencieuse.

## 6. Skills : `.claude/skills/` vers `.agents/skills/`

`.claude/skills/` reste la source initiale des skills projet. `.agents/skills/` est un arbre
d'adaptateurs générés et committés.

La synchronisation :

- inventorie récursivement chaque répertoire de skill ;
- exige un `SKILL.md` valide par skill ;
- conserve le frontmatter, le Markdown, les sous-répertoires, scripts et ressources ;
- applique la même table fermée d'identifiants de surface lorsque le contenu référence le guide, le
  credo, la mémoire ou un chemin propre au produit ;
- écrit une bannière de génération après le frontmatter de chaque `SKILL.md` adapté ;
- copie à l'octet les ressources qui ne nécessitent aucune adaptation.

Un chemin présent sous `.agents/skills/` et absent de la sortie calculée est un orphelin. Le mode
`check` échoue en le nommant. Le mode `sync` ne supprime que les fichiers portant la marque générée
ou répertoriés comme ressources d'un skill généré ; il refuse de supprimer un fichier manuel non
marqué et demande une résolution explicite.

La parité porte sur l'arbre complet, pas seulement sur la liste des dossiers. Un changement d'une
ressource de skill est donc contrôlé au même titre qu'un changement de `SKILL.md`.

## 7. Flux de synchronisation

Le calcul est identique en local et en CI :

1. découvrir les sources attendues ;
2. parser et valider leur structure ;
3. construire toutes les sorties en mémoire ;
4. valider les invariants transverses ;
5. seulement en mode `sync`, écrire les fichiers qui diffèrent ;
6. recalculer et vérifier qu'un second passage ne produit aucun changement.

Les écritures utilisent des fichiers temporaires placés à côté de leur destination, puis un
remplacement atomique. Une erreur de parsing ou de validation survient avant toute écriture. Une
exécution interrompue ne doit jamais laisser un demi-`AGENTS.md` ou un demi-`SKILL.md`.

Les sorties sont normalisées en UTF-8 et fins de ligne LF. Les chemins sont comparés après
normalisation des séparateurs, mais les chemins écrits dans les documents restent ceux définis par
la transformation.

Les fichiers générés sont committés. Une nouvelle installation peut donc utiliser immédiatement
Claude ou Codex sans lancer le générateur ; la commande de contrôle prouve ensuite que ces fichiers
correspondent aux sources.

## 8. Hooks multiplateformes

### 8.1 Contrat

Les configurations Claude et Codex restent propres à leur produit, mais toutes les commandes de hook
appellent un fichier `.mjs` avec `node`.

Sont interdits dans une commande de hook :

- `CLAUDE_PROJECT_DIR` ou toute autre variable d'environnement réservée à un produit ;
- `cat`, `type`, `2>/dev/null`, `||` ou une redirection de shell ;
- une chaîne qui suppose Bash, `cmd.exe` ou PowerShell ;
- la résolution d'un fichier interne à partir du seul répertoire courant.

Les scripts résolvent la racine du dépôt depuis `import.meta.url` et utilisent `node:path`,
`node:url` et `node:fs`. Les entrées JSON de hook sont lues depuis `process.stdin` et les sorties sont
écrites sur `process.stdout` ou `process.stderr`.

### 8.2 Injection du credo

L'injection `SessionStart` devient un hook Node dédié. Il reçoit l'identifiant de surface ou le
déduit de la configuration appelante, puis lit le credo projet correspondant par chemin résolu
depuis le script. Un fichier absent, illisible ou vide est une erreur explicite avec code de sortie
non nul ; il n'existe plus de repli silencieux vers un second `cat`.

Claude injecte `.claude/credo.md`. Codex injecte `.Codex/credo.md`. La parité du contenu est garantie
en amont par `agents:check`.

### 8.3 Parité des configurations

Le contrôle extrait dans `.claude/settings.json` et `.codex/hooks.json` :

- les phases ;
- les matchers ;
- le nom du script Node ;
- le timeout ;
- le rôle fonctionnel du hook.

Après normalisation des différences de schéma autorisées, les ensembles doivent être identiques.
Une capacité disponible sur une seule surface échoue avec le chemin JSON précis des deux côtés.

Les différences explicitement propres à un produit sont déclarées dans une allowlist fermée du
validateur, avec leur justification technique. Une différence non déclarée n'est jamais acceptée
par simple absence dans l'autre fichier.

## 9. Profils d'agents

Les profils restent distincts :

- Claude conserve `.claude/agents/<role>.md`, son frontmatter, ses outils et ses paramètres ;
- Codex conserve `.codex/agents/<role>.toml`, ses champs TOML et ses instructions développeur.

Le pont ne génère pas l'un depuis l'autre, car une conversion forcerait soit la perte de capacités,
soit l'invention d'une équivalence entre des schémas différents.

`agents:check` valide néanmoins :

1. la même liste de rôles par nom de fichier ;
2. l'identifiant `name` égal au nom de fichier dans chaque schéma ;
3. la même description fonctionnelle lorsque le champ existe des deux côtés ;
4. la présence des références projet obligatoires ;
5. la parité des références communes après normalisation de
   `CLAUDE.md` vers `AGENTS.md`, de `.claude/` vers l'adaptateur Codex attendu et des séparateurs de
   chemin ;
6. l'absence, dans un profil Codex, d'une référence résiduelle à un guide ou un répertoire Claude,
   et réciproquement.

La comparaison des références porte sur les chemins du dépôt, les sections nommées et les commandes
npm. Elle ne compare pas les noms d'outils, les modèles, l'effort de raisonnement ni la syntaxe des
permissions : ces différences appartiennent au schéma de chaque produit.

Une divergence de prose métier commune doit être corrigée dans les deux profils. Une divergence
technique de surface reste autorisée tant que les rôles et leurs références demeurent équivalents.

## 10. Credo et mémoires

### 10.1 Contexte projet partagé

Le credo et la mémoire projet sont du contenu committé et commun :

- `.claude/credo.md` est la source initiale de `.Codex/credo.md` ;
- `.claude/memory/` est la source initiale de `.Codex/memory/`.

Le miroir de mémoire conserve l'arborescence, les noms et le contenu, puis adapte uniquement les
références de surface définies dans la table fermée. Une fiche projet visible par Claude doit donc
être visible par Codex au même commit.

Le contrôle détecte les fiches absentes, supplémentaires ou divergentes. Comme pour les skills, le
mode `sync` refuse d'effacer un fichier Codex non marqué comme adaptateur généré.

### 10.2 Mémoire personnelle séparée

Les mémoires personnelles restent propres à chaque produit. Sont hors périmètre du pont :

- les répertoires utilisateur situés hors du dépôt ;
- l'historique de conversation ;
- les préférences, caches, index et mémoires automatiques d'un produit ;
- les données de session cloud non committées.

Aucun script du dépôt ne lit ni n'écrit ces emplacements. Une leçon qui doit devenir commune est
promue explicitement dans la mémoire projet source, puis synchronisée.

## 11. Gestion des erreurs

Les commandes échouent avec un code non nul et un diagnostic stable contenant :

- la famille concernée (`guide`, `skill`, `hook`, `agent`, `credo` ou `memory`) ;
- le fichier source et le fichier attendu ;
- le type d'écart (`missing`, `orphan`, `content`, `parse`, `reference` ou `unsafe-delete`) ;
- l'action attendue : modifier la source, compléter la paire manuelle ou lancer
  `npm run agents:sync`.

`agents:check` agrège tous les écarts indépendants avant de quitter afin d'éviter une boucle
correction-exécution fichier par fichier.

`agents:sync` s'arrête avant écriture si :

- une source est invalide ;
- deux sources produisent la même destination ;
- une substitution obligatoire ne trouve pas son ancre ;
- une sortie contient encore un identifiant interdit de l'autre surface ;
- un fichier manuel serait écrasé ou supprimé.

Le générateur n'effectue aucune correction approximative et ne transforme jamais un profil d'agent
mal formé en fichier vide.

## 12. Validation et tests

### 12.1 Tests unitaires

Des tests Node couvrent :

- la transformation du guide et son en-tête Codex ;
- le maintien du frontmatter des skills ;
- l'adaptation des chemins et le refus d'un token résiduel ;
- la normalisation LF/CRLF et des séparateurs Windows/POSIX ;
- la détection des fichiers manquants, orphelins et manuels non supprimables ;
- le parsing du frontmatter Markdown, du JSON de hooks et du TOML d'agents ;
- la normalisation des références communes entre profils ;
- la résolution des chemins de hook depuis `import.meta.url`.

### 12.2 Tests d'intégration

Sur un jeu de fixtures isolé :

1. `sync` produit tous les adaptateurs attendus ;
2. un second `sync` ne modifie aucun octet ;
3. `check` passe immédiatement après ;
4. la modification d'un adaptateur fait échouer `check` ;
5. la suppression d'un rôle sur une seule surface fait échouer la parité ;
6. une référence `CLAUDE.md` dans un profil Codex est signalée ;
7. un hook exécuté depuis un autre répertoire courant retrouve néanmoins ses fichiers internes.

### 12.3 Gates dépôt

- `npm run agents:sync` est la commande explicite de génération.
- `npm run agents:check` est exécuté par le pré-commit.
- `npm run agents:check` est exécuté par la CI avant les suites longues.
- Les tests du pont sont inclus dans la suite d'outillage Node.
- La CI vérifie également qu'un `agents:sync` simulé ne produirait aucun diff.

Les gates ne lancent ni build du jeu ni mutation de données. Les gates complets existants restent
indépendants.

## 13. Migration incrémentale

### Étape 1 — Socle de contrôle

Créer le moteur sous `scripts/agents/`, ses fixtures et les scripts npm. Le premier
`agents:check` fonctionne en mode audit et décrit les écarts existants sans être encore branché au
pré-commit ni à la CI.

### Étape 2 — Guide

Déclarer `CLAUDE.md` source initiale, générer `AGENTS.md`, vérifier l'en-tête propre et la table de
substitutions. À partir de cette étape, toute modification du corps commun commence dans
`CLAUDE.md`.

### Étape 3 — Skills

Basculer `.agents/skills/` en arbre généré, marquer les adaptateurs et vérifier la parité récursive.
Les éventuels fichiers manuels Codex sont d'abord classés : différence de surface explicite ou
contenu commun à remonter dans la source Claude.

### Étape 4 — Hooks

Remplacer les commandes dépendantes de `CLAUDE_PROJECT_DIR` et la commande `cat` par des hooks Node.
Tester chaque phase avec des entrées JSON représentatives sous Windows et dans un environnement
POSIX.

### Étape 5 — Agents, credo et mémoire

Activer la validation de parité des rôles et références sans générer les profils. Basculer le credo
et la mémoire projet Codex en adaptateurs générés. Exclure explicitement les mémoires personnelles.

### Étape 6 — Blocage de la dérive

Brancher `agents:check` au pré-commit et à la CI seulement lorsque l'audit complet est vert. Les
sorties générées sont committées dans le même changement que leur source.

Chaque étape est réversible par suppression de son branchement au pont ; aucune étape ne touche
`src/`, les sauvegardes, les données ou le comportement du jeu.

## 14. Risques et réponses

| Risque | Réponse |
|---|---|
| `CLAUDE.md` devient un pseudo-template illisible | conserver un document Claude valide et limiter l'adaptation à une table fermée |
| remplacement textuel trop large | substitutions exactes, ancres obligatoires et test de tokens résiduels |
| perte d'une capacité spécifique à un produit | profils séparés et allowlist explicite des différences techniques |
| suppression d'un fichier manuel sous un arbre généré | marque de génération obligatoire et refus `unsafe-delete` |
| sortie différente selon l'OS | Node seul, chemins normalisés, UTF-8/LF et fixtures Windows/POSIX |
| hook lancé hors de la racine | résolution interne par `import.meta.url` |
| CI verte malgré un adaptateur modifié à la main | recalcul en mémoire et comparaison octet par octet |
| duplication volumineuse de la mémoire projet | duplication committée assumée pour disponibilité immédiate ; contenu contrôlé automatiquement |
| confusion entre mémoire projet et mémoire personnelle | périmètres de dépôt explicites ; aucun accès aux espaces utilisateur |
| blocage prématuré du pré-commit | migration en audit, puis activation du gate seulement après parité |

## 15. Critères d'acceptation

Le chantier est accepté lorsque :

1. Claude Code et Codex chargent chacun un guide autonome et correctement nommé.
2. `AGENTS.md` est reproductible à l'octet depuis `CLAUDE.md` et porte son en-tête généré.
3. chaque skill de `.claude/skills/` possède un adaptateur contrôlé sous `.agents/skills/`, sans
   fichier manquant ni orphelin ;
4. les mêmes rôles existent sous `.claude/agents/` et `.codex/agents/`, avec descriptions et
   références communes validées malgré leurs schémas distincts ;
5. les configurations de hooks offrent les mêmes protections sur les deux surfaces ;
6. aucune commande de hook ne contient `CLAUDE_PROJECT_DIR`, `cat`, `/dev/null`, redirection ou
   opérateur de shell ;
7. tous les hooks internes résolvent leurs fichiers par des API Node multiplateformes ;
8. le credo et chaque fiche de mémoire projet sont disponibles et équivalents sur les deux
   surfaces ;
9. aucune mémoire personnelle n'est lue, copiée ou validée par le pont ;
10. `npm run agents:sync` est idempotent ;
11. `npm run agents:check` est strictement non mutatif et produit des diagnostics exploitables ;
12. une modification manuelle d'un fichier généré fait échouer le pré-commit et la CI ;
13. tous les fichiers générés nécessaires au fonctionnement immédiat des deux surfaces sont
    committés ;
14. aucun fichier du moteur de jeu, de l'UI, du serveur ou des données WFRP n'est modifié par
    l'implémentation.
