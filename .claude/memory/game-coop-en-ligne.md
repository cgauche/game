---
name: game-coop-en-ligne
description: "Coop — v2 relay WebSocket (Worker Cloudflare server/, code room 6 chars, reconnexion auto par token) ; hôte-autoritaire+snapshots, registre unique des modales, ready-checks, save chez l'hôte"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Coop en ligne : jeu (P0→P3, 2026-06-11) + **transport v2 relay livré 2026-06-12** (spec
`docs/superpowers/specs/2026-06-12-coop-relay-websocket-design.md`). Le transport v1 (P2P sans
broker, codes `W4C1.` ~700 chars copiés/collés) est SUPPRIMÉ — inutilisable en réel : déco ~1 min
(pendingCampaign 313 Ko > 256 Kio par message DataChannel + buffer sans backpressure + STUN seul).

- **Transport v2** : Worker Cloudflare `server/` (DO « Room » par partie, hibernation WS, TTL
  30 min, refus = close 4xxx avec raison FR affichée telle quelle). Client `src/net/relay.ts` :
  RelayClient (ping 10 s/pong auto, backoff ≤ 2 min), RoomHost (un Transport VIRTUEL par siège
  sur l'unique WS), RoomGuest (EST un Transport). Sièges attribués par le DO →
  `addGuest(t, seat)`. Compression deflate des payloads > 2 Ko (champ `z`, enveloppe claire pour
  le routage), chaînes send/recv pour préserver l'ordre malgré l'async.
- **Reconnexion AUTO** : token de siège (sessionStorage → survit au F5), grace 2 min côté hôte
  (presence 'away', puis héros à l'hôte), hôte revenu = host-up + `GuestSession.rejoin()`
  (re-hello → hello+campagne+snapshot). Bannière `CoopBanner` (App.tsx). Lien d'invitation
  `?join=CODE` pré-remplit le lobby.
- **Snapshots** : throttle 120 ms + coalescing/backpressure (256 Ko bufferedAmount) ;
  `pendingCampaign` EXCLU — la campagne custom part UNE fois au join (message `campaign`,
  `extraJoinMessages` entre hello et snapshot) et au changement ; l'invité `registerScene` local.
- **Hôte-autoritaire** (inchangé) : invités → intents (allowlist `net/intents.ts` gardée par
  test) ; l'invité préserve `net.mode/mySeat/connection/hostAway` à l'application du snapshot.
  ⚠️ les resets (`startScene`, `applyLoadedSave`) PRÉSERVENT `net`.
- **REGISTRE des modales** (`state/modalArbiter.MODAL_DEFS`) : une entrée = `when` + `owner` ;
  la validation hôte (`netOwnership.intentAllowedFor`) lit le MÊME registre. Ajouter une
  modale = 1 entrée + 1 composant.
- **Gating spectateur en combat** (dc79e58, playtest 2026-06-12) : `netOwnership.controlsActive`
  (prédicat PUR, même module que la validation hôte) = « le joueur local contrôle-t-il l'actif ? »
  — faux pour l'HÔTE aussi (son UI exécute le store en direct, intentAllowedFor ne le couvre pas).
  Consommé par IsoStage (grilles Marche/Course, hoverAim/hoverMove, anneaux, aperçu tap-1, clics),
  ActionBar (barre spectateur) et CampaignView (#21 portraits). NE PAS gater dans le store/moteur :
  l'hôte y rejoue les intents légitimes des invités. Anti-doublon : la puce `SpectatorChip`
  s'efface quand la modale concerne le combattant ACTIF (la barre affiche déjà « X joue… »).
  ⚠️ ne pas importer `netFlow` comme entrée de test (cycle store↔netFlow) — les prédicats purs
  vivent dans `netOwnership`, netFlow ne fait que ré-exporter.
- **Ready-checks** : ouverture de combat + victoire (unanimité des sièges à héros vivant) ;
  rounds enchaînés (✋ pause). Butin attribuable à SES héros.
- **Écran d'équipe = lobby** : l'hôte attribue les EMPLACEMENTS (`net.slots`, `netAssignSlot`),
  chacun remplit les siens ; siège INJECTÉ par le transport (jamais des args invité) ;
  `applyNetSnapshot` préserve l'écran `creator` local de l'invité.
- **Save/reprise coop** (83c33fe) : la save vit chez l'HÔTE ; charger en session = salon intact.
- ⚠️ **Piège intents (B4)** : `onClick={onConfirm}` fuit l'événement React dans les args →
  JSON circulaire muet. Toujours `onClick={() => onConfirm()}` ; `sanitizeIntentArgs` en garde.
- ⚠️ **Piège DO** : dans `webSocketClose`, le socket fermant est ENCORE listé par
  `getWebSockets()` → toute garde « reste-t-il une connexion ? » doit l'exclure (sinon `gone`
  jamais émis — trouvé par la recette E2E Node 13/13 contre wrangler dev).

**How to apply:** Worker DÉPLOYÉ (2026-06-12) : `https://w4-coop-relay.gauche-c.workers.dev`
(= `RELAY_URL_PROD`, src/net/relay.ts) ; redéploiement = `npm run relay:deploy` ; dev local =
`npm run relay:dev` + `VITE_RELAY_URL=http://localhost:8787` (Vite à relancer pour prendre
l'env). Piège rencontré : 1er deploy exige un sous-domaine workers.dev (visite dashboard) + TLS
provisionné ~1 min après. Toute action joueur réseau → allowlist ; toute modale → registre.
Reste : recette UI 2 onglets, et le JEU sur GitHub Pages doit être redéployé (deploy.mjs, sur
demande) pour que la coop prod soit jouable en ligne. LIVRÉ aussi (491af01) : choix de campagne
dans l'écran de groupe (cartouche 📜 + modale, hôte/solo ; invités voient le nom via stub
nom-seul dans netSnapshot), « Mes campagnes » retiré du menu.
Prolonge [[feedback-adversaire-creatif]].
