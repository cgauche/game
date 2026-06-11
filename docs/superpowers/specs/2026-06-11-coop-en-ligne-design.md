# Coop en ligne (Jalon 7) — design

**Statut : PROPOSITION — arbitrage utilisateur requis avant toute implémentation.**
Les recommandations sont tranchées ; les alternatives écartées sont notées avec leurs raisons.

## 1. Contraintes du projet

- **Prod 100 % statique** (GitHub Pages, `cgauche.github.io/jeu/`) : pas de serveur applicatif à
  héberger/maintenir. Toute solution exigeant un backend permanent casse le déploiement actuel.
- **Tour par tour** : latence non critique (pas de tick temps réel) ; 2-4 joueurs entre amis.
- **Socle déjà en place** : RNG de combat seedable (`battleRng`/`store.seedRng`) ; **état
  entièrement sérialisable** (prouvé par la sauvegarde : `snapshotSave` capture toutes les clés
  de données de `getInitialState`) ; hotseat fonctionnel (tout le monde contrôle tout).

## 2. Topologie réseau — RECOMMANDATION : WebRTC DataChannel via PeerJS

| Option | Verdict |
|---|---|
| **WebRTC + PeerJS** (serveur de signaling public gratuit, données en P2P direct) | ✅ Recommandé : zéro infra à héberger, prod statique conservée, lib mûre, code de partie simple (id PeerJS). |
| WebSocket + serveur maison | ❌ Exige un backend hébergé (coût, ops, hors modèle GitHub Pages). |
| WebRTC signaling manuel (copier/coller l'offre SDP) | ❌ UX pénible (gros blobs à échanger) ; à garder en SECOURS si le cloud PeerJS disparaît. |

Risques PeerJS assumés : dépendance au signaling public (fallback : héberger `peerjs-server`
plus tard, ou self-host gratuit type Render/Fly — décision repoussée) ; NAT symétriques sans
TURN ≈ rare entre amis sur réseaux domestiques (documenter « si ça ne se connecte pas… »).

## 3. Modèle d'autorité — RECOMMANDATION : hôte-autoritaire + snapshots d'état

- **Hôte-autoritaire** : SEUL l'hôte exécute le store/les règles. Les invités envoient des
  **intentions** (`{ action: 'battleClickEntity', args: [...] }`) ; l'hôte les rejoue, puis
  **broadcast un snapshot** de l'état (réutilise `snapshotSave` — données JSON-sûres).
- Alternative écartée : **lockstep déterministe** (chaque client rejoue les actions, RNG seedé).
  Élégant sur le papier (le socle seedable existe) mais fragile : LA MOINDRE source de
  non-déterminisme (ordre d'itération, `Date.now` caché, divergence de version) = désync
  silencieuse indétectable. Le snapshot autoritaire est trivialement correct.
- Coût : un snapshot complet par action (~50-300 Ko JSON). Pour du tour par tour à 4, c'est
  acceptable en DataChannel ; optimisation différentielle (delta/compression) = V2 si besoin.
- Le RNG vit chez l'hôte → aucune triche/désync possible côté invité.

## 4. Contrôles & propriété

- Chaque héros a un **propriétaire** (`ownerPeerId`, l'hôte par défaut — l'attribution se fait
  au lobby, modifiable en cours de partie).
- **Combat** : seul le propriétaire du combattant ACTIF voit ses contrôles (hotbar, modales de
  jet — Lancer/Chance/Résilience/Appliquer chez lui) ; les autres voient la scène + le journal
  en spectateurs. Les modales de DÉFENSE/Destin s'ouvrent chez le propriétaire du défenseur.
- **Exploration** : l'hôte pilote (déplacement du groupe, dialogues, fouilles) — V1 simple ;
  les invités voient tout et peuvent ouvrir LEURS fiches. (V2 : déléguer les Tests de compétence
  au porteur du meilleur score, comme `partyBest` le suggère déjà.)
- **Interlude** : chaque joueur joue les Activités de SES héros ; l'hôte clôt.
- L'écran de création/roster reste local (on amène son héros au lobby — export/import du roster
  existant ; V1 : l'hôte compose le groupe comme aujourd'hui).

## 5. Architecture code (sans toucher au moteur)

```
src/net/
  session.ts      « NetSession » : 'local' (défaut, comportement actuel) | 'host' | 'guest'
  transport.ts    PeerJS wrap (connect/broadcast/onMessage), lazy-chunké (pas dans le bundle de base)
  protocol.ts     messages : {kind:'intent'|'snapshot'|'hello'|'assign'|'chat'}, version du protocole
  intents.ts      registre des actions REJOUABLES (allowlist nom→action store + validation owner)
```
- **Couture store minimale** : un middleware d'INTERCEPTION — en mode `guest`, les actions de
  l'allowlist ne s'exécutent pas localement : elles partent en intent ; en mode `host`, après
  chaque action de l'allowlist, broadcast du snapshot. Le mode `local` est un no-op total
  (zéro régression hotseat).
- Les modales/pendings : DANS le snapshot (déjà des données pures — le chargement de save les
  restaure déjà). Le gating « qui voit quoi » est un filtre d'AFFICHAGE par ownership, pas une
  logique d'état.
- `seedRng` à l'ouverture de session (l'hôte seed et broadcast — utile aux replays/logs, pas à
  la correction).

## 6. Lobby & cycle de vie

1. « Jouer en ligne » (menu) → Héberger (affiche un **code de partie** = id PeerJS court) ou
   Rejoindre (saisir le code).
2. Lobby : liste des connectés, attribution des héros (drag/select), bouton Lancer (hôte).
3. En partie : indicateur de connexion par joueur ; un invité déconnecté → ses héros repassent
   à l'hôte (bandeau « X a quitté — reprise par l'hôte ») ; reconnexion par le même code →
   re-handshake + snapshot complet.
4. Sauvegarde : l'HÔTE sauvegarde (slots existants) ; recharger une save en ligne = ré-héberger
   puis réattribuer les héros.

## 7. Sécurité/limites assumées (V1)

Pas d'anti-triche au-delà de l'autorité hôte (jeu entre amis) ; pas de chat vocal (texte
optionnel V2) ; 4 joueurs max ; même version de build requise (check de version au hello).

## 8. Découpage d'implémentation (plans à écrire après arbitrage)

- **P0** : `NetSession` + allowlist d'intents + middleware (mode local inerte) — testable sans
  réseau (deux stores en mémoire reliés par un transport factice).
- **P1** : transport PeerJS + lobby (héberger/rejoindre/attribuer) + snapshot broadcast.
- **P2** : ownership UI (hotbar/modales gâtées par propriétaire, spectateur).
- **P3** : robustesse — reconnexion, version check, héros orphelins, indicateurs.
- **P4 (V2)** : deltas d'état, exploration déléguée, chat.

## 9. Questions ouvertes pour l'arbitrage

1. **PeerJS cloud** OK comme dépendance de signaling (gratuit, tiers) — ou exigence de
   self-host dès la V1 ?
2. L'« exploration pilotée par l'hôte » te va, ou chaque joueur doit pouvoir déplacer le groupe ?
3. 4 joueurs max (un par héros) ou spectateurs supplémentaires ?
