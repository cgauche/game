---
name: game-chasse-contenu-en-dur-2026-07-12
description: "Chasse 'catalogues de contenu en dur' (classe NIGHT_STAKES) du 2026-07-12 — #365 (migrations) et #366 (arbitrages user) SOLDÉS ; leçon : « n'ouvre pas de ticket » de l'user voulait dire « pas de nouveau CHANTIER » — la doctrine tickets-toujours prime."
metadata: 
  node_type: memory
  type: project
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

Chasse lancée sur question user (« on en a d'autres des codes écrits en dur comme NIGHT_STAKES ? »), 3 chercheurs + juge doctrine (workflow wf_6366ed96-c7e).

**Résultats — tout a été ticketé, puis soldé (#365 et #366 fermés)** :
- **Tolérés confirmés** (ne pas les re-signaler à la prochaine chasse) : `AVAILABILITY_RANK`, titles ActionBar/CastModal.
- **#366** (ticket de DÉCISION, aucun code avant réponse user) portait : OPTIONAL_RULES (migrer ? hints qui paraphrasent le RAW — règle 6), DISPO_PCT/BARTER_RATIOS (tables numériques RAW en donnée ou constantes moteur ? ratio dérivable 2^Δ), tooltip Points de Péché.
- La garde qui tient la classe : `scripts/guards/lib/hardcode.mjs` (+ CLAUDE.md règles 1 et 5 — aucun contenu RAW figé en constante de code).

**Leçon de consigne (2026-07-12)** : j'avais gelé les tickets sur « N'ouvre pas de nouveau ticket, je vais fermer mon ordinateur » ; l'user a corrigé (« Ma consigne c'est de créer des tickets à chaque fois non ? ») — sa doctrine credo (écart consigné sans ticket = backlog invisible = poison) PRIME ; son message visait les nouveaux CHANTIERS, pas la traçabilité. En fin de session : ticketer reste obligatoire, ne pas lancer de travail est la vraie consigne.

Restes de la réfutation du soir (purge de code mort vestigial + assertion fixture v5), tracés en commentaires sur la plage #347/#349-#364 — encore ouverts : #348, #349, #350, #353, #355, #356, #364.
