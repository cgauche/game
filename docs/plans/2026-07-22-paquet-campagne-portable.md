# Conception — Paquet de campagne portable & système d'enquête (2026-07-22)

> Artefact DATÉ (sortie de brainstorming, validé section par section par l'utilisateur le
> 2026-07-22). À SUPPRIMER une fois exécuté — git porte l'historique. Gouverné par la doctrine
> actée : frontière RÉFÉRENCE vs NARRATIF (fiche mémoire
> `game-campagne-json-portable-frontiere-reference-narratif`, directive user 2026-07-22 verbatim :
> « Les campagne sont éditable et on doit pouvoir échanger un fichier json pour l'intégrer en
> local, ne l'oublie pas »). Épique : #665. Gouverne la redirection de #670 et #671 ; lié #718
> (journal persistant), #530 (vocabulaire de campagne), #684 (ossature EDO).

## Problème

Le contenu propre à une campagne (méchants nommés, templates récurrents, rumeurs, indices,
objectifs, objets magiques d'intrigue) ne peut pas vivre dans `src/data/*.json` global :
double faute — fuite au Compendium (spoilers pour le joueur qui feuillette) ET non-portabilité
(le contenu ne voyage pas quand on échange la campagne). Il faut une solution GÉNÉRALE pour
créer et partager N campagnes, pas un aménagement pour EDO.

## Décisions utilisateur (2026-07-22, session de conception)

1. **Import au menu, stocké navigateur** : bouton « Importer une campagne » au menu principal,
   JSON validé puis persisté en IndexedDB. Les campagnes bundlées sont du MÊME format — un seul
   chemin de chargement.
2. **Snapshot embarqué dans la partie** : à « Nouvelle partie », le document de campagne est
   COPIÉ dans l'état de la partie. La save est auto-suffisante ; une mise à jour/suppression en
   bibliothèque ne touche jamais une partie en cours.
3. **Enquête = pistes vivantes à stades** : affaires regroupant des indices ; un indice a des
   stades authorés (re-révéler = mettre à jour, l'ancienne lecture reste visible barrée) ;
   statuts caché/révélé/épinglé (suivi joueur)/réfuté ; chaque transition écrit au journal
   persistant de campagne.
4. **Architecture A — couche de campagne** : le narratif vit dans une couche du store, résolu
   « campagne d'abord puis global » en UN point ; les index globaux de `src/data` ne sont
   jamais mutés → la fuite au Compendium est impossible par construction (l'approche « fusion
   taguée + filtres » est REJETÉE : anti-spoiler par filtre négatif = classe de fuite réfutée
   sur #670).

## 1. Le paquet (schema 3)

Un seul JSON auto-suffisant, extension du projet actuel `{schema:2, scenes, worldMap}`
(`parseProject`, `src/state/worldMap.ts`) :

```jsonc
{
  "schema": 3,
  "meta": { "id": "...", "label": "...", "icon": "...", "version": 1,
            "description": "…", "auteur": "…" },
  "scenes": [ /* inchangé — schéma de Scène unique (règle 2) */ ],
  "worldMap": { /* inchangé */ },
  "narratif": {
    "affaires":   [{ "id": "...", "titre": "...", "desc": "…" }],
    "indices":    [{ "id": "...", "affaireId": "...", "kind": "indice|rumeur",
                     "titre": "...",
                     "stades": [{ "id": "...", "prose": "…", "source": { } }],
                     "refs": ["autreIndiceId"] }],
    "presetsPnj": [{ "id": "...", "base": "creatureIdGlobal?", "profil": { },
                     "apparence": { }, "portrait": "...", "source": { } }],
    "objets":     [ /* MÊME schéma que les trappings globaux */ ]
  }
}
```

- `meta.id` = identité en bibliothèque ; `meta.version` = mises à jour d'auteur.
- Validation à l'import dans `parseProject` : schéma, réfs croisées (indice⇄affaire⇄scènes,
  preset⇄scenes.entities/members), **interdiction de collision** id narratif ↔ id global.
- La prose d'indice citant un document du livre = verbatim source (règle 5), `source {book,page}`.
- Un PNJ nommé = base générique globale par id (`base`) + surcharges du preset embarquées —
  l'instance nommée n'entre JAMAIS au bestiaire global (doctrine actée, #671).
- Les 3 projets bundlés (Arène, Loup et Saumure, Barge du Sel) sont régénérés en schema 3 par
  leurs générateurs dans le même geste — un seul format vivant. Les projets éditeur stockés
  (localStorage existant) migrent 2→3 au chargement (mécanique de migration, un seul saut).

## 2. Bibliothèque, import/export

- Le picker existant (`CampaignSelect`, `allBuiltinCampaigns` de `src/scenes/campaign.ts`)
  devient la vitrine d'une bibliothèque UNIQUE : bundlées (lecture seule) + bibliothèque
  locale **IndexedDB** (importées ET créées dans l'éditeur). Les projets éditeur actuellement
  en localStorage migrent en IndexedDB — une seule source de vérité.
- Import : file input → `parseProject` → entrée en bibliothèque ; même `meta.id` + version
  supérieure → proposer le remplacement (les parties en cours sont snapshotées, insensibles).
- Export : téléchargement du JSON depuis la bibliothèque ou l'éditeur.
- « Nouvelle partie » : snapshot du document dans l'état de partie (décision 2).

## 3. Couche de campagne & résolution

- Le snapshot vit dans le store comme couche de campagne — `src/data` jamais muté.
- UN module de couture : `src/state/campaignData.ts` (même doctrine que la couture label→id de
  `src/data/index.ts` : une couture, un seul fichier). Accesseurs : `affaireById`/`indiceById`
  et `presetPnjById` (n'existent QUE dans la couche) ; `trappingById` en chaîne
  **campagne d'abord, puis global** (seul type joint ; collisions interdites → déterministe).
- Points de couture du moteur (spawn `entities`/`members` par preset, `giveTrapping`/butin,
  portrait de dialogue) passent par ces accesseurs. Un test de câblage par couture prouve
  qu'un id de campagne se résout PAR LE CHEMIN RÉEL (preuve « échoue sans la clé »).

## 4. Anti-spoiler & surfaces

- Compendium/Codex joueur : index globaux UNIQUEMENT — le narratif n'y existe physiquement
  pas. Garde `codex-exposure-guard` étendue : aucun id du narratif d'une campagne chargée
  atteignable par l'index du Compendium.
- Surfaces joueur gatées par l'état de partie : Carnet (= `state.clues`, seul le découvert),
  PNJ visibles une fois rencontrés (#671), objet de campagne ramassé = objet possédé normal
  (identification existante s'il est magique).
- Contexte AUTEUR = éditeur de campagne : onglets Affaires/Indices/PNJ/Objets, composés des
  primitives (`MasterDetail`, `GameOpEditor`, pickers existants). Tout voir = éditeur, jamais
  côté joueur.

## 5. Enquête (pistes vivantes)

- `state.clues` par indice : absent = caché ; sinon
  `{ stadeCourant, statut: 'révélé'|'réfuté', épinglé?, historique: [{stade, date}] }`.
- Effets (vocabulaire d'Effects des scènes, étendu) : `revealClue {indiceId, stade?}`
  (première révélation OU mise à jour vers un stade suivant — l'entrée s'enrichit, l'ancienne
  lecture reste visible barrée) ; `discreditClue {indiceId}` (fausse piste : barrée,
  relisible — ex. mouchoir « F.S. », EDO 08 l.242-244).
- Épinglage (= suivi) : geste JOUEUR au Carnet, pas un effet authoré.
- Chaque transition écrit au journal persistant de campagne (#718 — bump de save coordonné).
- Carnet : `MasterDetail` affaires→indices, `Band`/`Prose`, épinglés en tête. Statut RAW :
  présentation maison taguée `maison` (le livre ne définit aucune mécanique de carnet, #670).
- Coop : révélation résolue par l'hôte ; carnet et épinglage PARTAGÉS (un carnet de groupe).

## 6. Save, gardes, recette

- `SAVE_VERSION` 14→15, UN SEUL bump : snapshot de campagne + `state.clues` + journal
  persistant. Migration + golden fixture (process `src/state/__fixtures__/saves/README.md`).
- Gardes : validation d'import (schéma/collisions/réfs croisées), garde d'exposition Codex
  étendue, tests de câblage des coutures du résolveur.
- Recette joueur (clavier + clics réels) : importer un JSON au menu → jouer → révéler →
  mettre à jour → réfuter → épingler → relire au Carnet → exporter depuis l'éditeur →
  recharger la save. Écran de goût du Carnet validé par l'utilisateur AVANT commit (#670 DoD).

## Impacts tickets

- **#670** : les définitions d'indices passent de `src/data/clues.json` global → bloc
  `narratif.indices` du paquet (le cœur livré en global le 2026-07-22 est à REDIRIGER avant
  tout commit). Le modèle gagne les stades (décision 3).
- **#671** : le registre de presets devient `narratif.presetsPnj` (campagne), pas un
  `src/data/*.json` global-feuilletable — le corps du ticket est à amender.
- **Nouveau ticket** à ouvrir : paquet schema 3 + bibliothèque IndexedDB + import/export
  (labels `type:système`, `domaine:campagne`, `campagne:EDO` ; « Débloque #670/#671 »).
- **#718** : consommé comme réceptacle des transitions d'indices (bump de save coordonné).
