# Coop v2 — relay WebSocket (remplace le P2P WebRTC)

Date : 2026-06-12 · Statut : validé utilisateur · Remplace le transport de la spec
`2026-06-11-coop-en-ligne-design.md` (le modèle hôte-autoritaire/intents/snapshots y reste valable).

## 1. Problème

La coop v1 (WebRTC nu, signalisation par codes copiés/collés) est **inutilisable en conditions
réelles** (Internet, chacun chez soi, PC) :

- **Déconnexion systématique ~1 min après le join.** Causes identifiées dans le code :
  - `pendingCampaign` (projet de campagne entier, 313 Ko pour l'Arène) est une clé d'état → il
    part dans les snapshots ; un message DataChannel > 256 Kio **ferme le canal** (limite SCTP
    Chrome négociée).
  - Snapshots d'état complets non compressés, jusqu'à un tous les 120 ms (tours d'IA) : sur un
    upload domestique, `bufferedAmount` gonfle sans backpressure → la limite interne (~16 Mo)
    ferme le canal. L'ordre de grandeur tombe sur « ~1 minute ».
  - STUN seul (pas de TURN) : chemins P2P fragiles ou impossibles entre deux box.
  - Aucun heartbeat, aucune reconnexion : le moindre pépin = éjection définitive.
- **Échange de codes impraticable** : le SDP complet doit voyager → ~600+ caractères, dans les
  deux sens, par joueur. Structurel au choix « zéro serveur » — pas raccourcissable.

Arbitrage utilisateur (2026-06-12) : la contrainte v1 « sans dépendre d'un système externe » est
**levée** — il accepte de déployer un petit service gratuit. Approche retenue : **B — relay
WebSocket complet** (vs A — worker de signalisation + P2P durci) : en tour par tour la latence
P2P n'apporte rien, et le relay supprime TOUTE la classe de problèmes NAT/ICE/TURN/SDP.

## 2. Architecture

```
Hôte ── WS ──┐
             ├── Worker Cloudflare ── Durable Object « Room » (1 par partie)
Invité ── WS ┘        (relais de messages, AUCUNE logique de jeu)
```

- Le DO **relaie** des messages entre l'hôte et les sièges — il ne lit jamais le contenu de jeu.
- Le modèle hôte-autoritaire est inchangé : l'hôte exécute le store, les invités envoient des
  intents (allowlist), l'hôte diffuse des snapshots. `session.ts`, `intents.ts`,
  `netOwnership.ts` et leurs tests ne bougent pas.
- L'interface `Transport` est conservée ; seule l'implémentation change (WS au lieu de
  DataChannel). `FakeTransport` reste le harnais de test.

## 3. Worker (`server/` — nouveau dossier du repo)

```
server/
  wrangler.jsonc        config (DO binding « ROOM », compat date)
  src/index.ts          Worker : POST /rooms (création) + GET /room/:code (upgrade WS) → DO
  src/room.ts           Durable Object : glue WS (hibernation API, alarmes)
  src/roomLogic.ts      logique PURE de room (sièges, tokens, routage) — testée sans DO
```

### API

- `POST /rooms` → `{ code, hostToken }`. Code : **6 caractères**, alphabet sans ambiguïté
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (32^6 ≈ 1 G de combinaisons, le code fait office de secret).
- `GET /room/:code` (upgrade WebSocket) avec query :
  - hôte : `?role=host&token=<hostToken>`
  - invité nouveau : `?role=guest&name=<nom>` → le DO **attribue le siège** (1..3) et répond
    `{ evt: 'seated', seat, seatToken }`
  - invité qui reprend : `?role=guest&token=<seatToken>` → même siège.
- Room pleine (3 sièges pris et connectés) ou code inconnu → fermeture WS avec code/raison
  explicites (affichés tels quels dans le lobby).

### Protocole relay (enveloppes JSON en clair — le DO route sans décompresser)

| Sens | Message | Effet |
| --- | --- | --- |
| invité → DO | `{ data }` | relayé à l'hôte en `{ from: seat, data }` |
| hôte → DO | `{ to: seat \| 'all', data }` | `data` relayé tel quel au(x) siège(s) |
| DO → hôte | `{ evt: 'join'\|'resume', seat, name }` | présence (remplace `addGuest` implicite) |
| DO → hôte | `{ evt: 'gone', seat }` | WS du siège fermé (début de grace côté client) |
| DO → invités | `{ evt: 'host-down' }` / `{ evt: 'host-up' }` | présence de l'hôte |

`data` est la string produite par `protocol.ts` (`serializeMessage`) — opaque pour le DO.

### Cycle de vie

- WebSocket **Hibernation API** (`state.acceptWebSocket` + tags par siège) — le DO ne consomme
  de la durée que pendant le routage d'un message. `setWebSocketAutoResponse` répond aux pings
  client sans réveiller le DO.
- Les `seatToken`/`hostToken` restent valables jusqu'à la mort de la room → la reprise de siège
  marche même après une longue coupure si la room vit encore.
- **TTL** : alarme — room détruite après 30 min sans AUCUNE connexion ouverte.
- Free tier : 4 joueurs × quelques milliers de messages/session ≪ quotas (100 k req/jour) ;
  egress Workers non facturé. Limite Cloudflare : 1 Mio par message WS (cf. §5 garde-fou).

## 4. Client — transport (`src/net/`)

- **`relay.ts` (nouveau)** :
  - `RelayClient` : ouvre le WS vers `RELAY_URL`, heartbeat ping 10 s (pong auto côté DO,
    silence > 25 s = coupure), **reconnexion à backoff** (1 s → 10 s plafonné, abandon après
    2 min) en représentant son token. Expose l'état de connexion (`ok | reconnecting | lost`).
  - Côté hôte : `RoomHost` — démultiplexe l'unique WS en **un `Transport` virtuel par siège**
    (les `{from: seat, data}` entrants alimentent le bon transport ; `send` enveloppe en
    `{to: seat, data}`). `session.ts::addGuest` reçoit ces transports virtuels, inchangé.
  - Côté invité : `RoomGuest` — un `Transport` simple au-dessus du WS.
  - `onClose` d'un transport virtuel ne se déclenche **qu'après la grace** (cf. §6), pas au
    premier `gone`.
- **`RELAY_URL`** : constante, surchargée par `import.meta.env.VITE_RELAY_URL` (dev local :
  `wrangler dev` sur `ws://localhost:8787`).
- **Supprimé franchement** (pas de shadowing) : `codes.ts` + `codes.test.ts` (codes `W4C1.` —
  la machinerie deflate/base64url est d'abord déplacée dans `protocol.ts`, cf. §5),
  les fonctions RTC de `transport.ts` (`hostCreateOffer`, `guestAcceptOffer`,
  `hostAcceptAnswer`, `channelTransport`, `gatheringComplete`, `STUN_URLS`), et dans
  `netFlow.ts` : `netInvite`, `netAcceptAnswer`, `pendingInvites`.

## 5. Régime des snapshots (cause racine n° 1)

1. **Compression au niveau protocole** : `protocol.ts` transporte les gros payloads
   (`snapshot`, `campaign`) en `deflate-raw` + base64 (machinerie reprise de `codes.ts`).
   L'enveloppe relay reste en clair pour le routage. JSON d'état ≈ 10:1 → snapshot courant
   attendu ~10-30 Ko.
2. **`pendingCampaign` exclu des snapshots réseau** (`netSnapshot` le retire). Le projet de
   campagne custom est transféré **une seule fois** au join : message `{ kind: 'campaign',
   name, scenes, startSceneId, worldMap }` (compressé), envoyé par l'hôte après le `hello` et
   avant le premier snapshot, si un projet custom est chargé. L'invité fait `registerScene`
   localement (nécessaire au rendu : les portes `reveal:'door'` lisent `sceneRegistry`).
3. **Coalescing** : jamais deux snapshots en file. Le throttle 120 ms existant reste ; en plus,
   tant que l'envoi précédent n'est pas parti (WS `bufferedAmount` non drainé), seul le
   **dernier** état est retenu.
4. **Garde-fou 1 Mio** : un message qui dépasserait la limite WS Cloudflare est refusé avec un
   log explicite (au lieu d'une fermeture silencieuse). Compressée, l'Arène ≈ 40-60 Ko — marge.
5. Pas de deltas (YAGNI) : compression + coalescing suffisent en tour par tour.

## 6. Heartbeat, reconnexion, présence (cause racine n° 2)

- **Invité coupé** : `RelayClient` retente avec backoff en présentant `seatToken`. Pendant ce
  temps côté hôte, le siège passe « reconnexion » (event `gone`) et reste réservé **2 min**
  (grace). Reprise → event `resume`, l'hôte renvoie immédiatement un snapshot complet (+
  `campaign` si custom). Grace expirée → `onClose` du transport virtuel → `onSeatClosed`
  actuel (ses héros reviennent à l'hôte). La grace vit côté hôte (client) — le DO n'en sait
  rien : un invité qui revient APRÈS la grace (room encore vivante) est traité comme un
  nouveau join sur son siège, l'hôte peut lui réattribuer des héros.
- **Hôte coupé** : les invités voient « L'hôte est déconnecté… » (event `host-down`), leurs
  intents sont perdus sans erreur (tour par tour : on rejoue). L'hôte reprend avec `hostToken`
  → `host-up` + re-snapshot général. Pas de migration d'hôte (hors scope).
- **Quitter volontairement** : `bye` explicite → pas de grace, libération immédiate.
- `NetState` gagne ce qu'il faut pour l'UI : `roomCode`, présence par siège
  (`ok | reconnecting | gone`), état de sa propre connexion côté invité.

## 7. UI (CoopLobby)

- **Hôte** : « Créer une partie » → gros code `K7DM2X` + bouton copier + **lien d'invitation**
  (`<URL du jeu>?join=K7DM2X`, pré-remplit l'écran de join). Sièges avec présence (connecté /
  reconnexion / parti). Plus aucun champ « coller la réponse ».
- **Invité** : champ code (6 caractères) + nom → rejoint. Deep link `?join=` → arrive sur cet
  écran pré-rempli.
- **En partie** : bannière non bloquante « Reconnexion… » (invité) / badge siège « reconnexion »
  (hôte) ; messages d'erreur du DO (room pleine, code inconnu) affichés tels quels.
- Respecter la charte (Jalon 9) et le responsive 360 px existants de l'écran coop.

## 8. Tests

- **Inchangés** : `session.test.ts`, `intents.test.ts`, `protocol.test.ts` (étendu compression).
- **Nouveaux** :
  - `roomLogic` (module pur, dans `server/`) : attribution de sièges, tokens, routage des
    enveloppes, room pleine, reprise, TTL.
  - Multiplexage `RoomHost` : N transports virtuels sur un faux WS — `from/to` bien routés.
  - Compression round-trip (`protocol.ts`) : snapshot → wire → snapshot identique.
  - Scénarios de reprise sur `FakeTransport`/faux WS : coupure → grace → resume → snapshot ;
    grace expirée → `onSeatClosed`.
- Le DO lui-même = glue fine non testée unitairement ; recette manuelle via `wrangler dev`.

## 9. Déploiement & config

- `cd server && npx wrangler deploy` (une fois ; compte Cloudflare gratuit). L'URL `*.workers.dev`
  obtenue va dans `RELAY_URL` (et `VITE_RELAY_URL` pour l'override).
- Dev local : `wrangler dev` + `VITE_RELAY_URL=ws://localhost:8787 npm run dev`.
- Le déploiement du JEU (`scripts/deploy/deploy.mjs`) est indépendant — aucune étape ajoutée.

## 10. Limites assumées

- Pas d'authentification : partie privée entre amis, le code de room est le secret (TTL 30 min,
  alphabet 32^6). Le check `BUILD_ID` au `hello` est conservé.
- Worker down → pas de coop (infra Cloudflare, SLA très supérieur à deux box résidentielles).
- Tout le trafic de jeu transite par Cloudflare (données de jeu uniquement, rien de personnel).
- Pas de migration d'hôte, pas de spectateurs, max 4 joueurs — comme v1.
