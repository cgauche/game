---
name: feedback-questions-stop-loop
description: "Quand un arbitrage utilisateur est nécessaire, COUPER la boucle autonome et poser les questions directement — ne pas parquer dans une spec en attendant en heartbeat"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

L'utilisateur (2026-06-11, pendant /loop) : « Si tu as des questions de ce genre, désactive la
loop et pose-moi des questions. »

**Why:** j'avais parqué les arbitrages (PeerJS cloud ?, exploration hôte ?, 4 joueurs ?) dans
une spec « PROPOSITION — arbitrage requis » et laissé la boucle tourner en veille pendant des
heures. L'utilisateur préfère être sollicité activement : une question posée tout de suite
débloque le chantier tout de suite.

**How to apply:** en mode boucle/autonome, dès qu'un point nécessite SON choix (design, UX,
direction artistique, périmètre), arrêter la boucle (pas de ScheduleWakeup) et poser les
questions groupées (AskUserQuestion ou message direct), puis reprendre. Ne pas multiplier les
mini-questions : les grouper. Prolonge [[feedback-decisiveness-routine-git]] (l'inverse reste
vrai : l'hygiène de routine ne se demande pas).
