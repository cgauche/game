---
name: feedback-css-architecture
description: "Architecture CSS (Jalon 9) : couleurs UNIQUEMENT dans les tokens :root (palette en 1 endroit) ; ne pas laisser styles.css devenir un monolithe — découper par domaine."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Deux directives d'architecture CSS posées par l'utilisateur le 2026-06-11 :

1. **Couleurs centralisées dans les tokens `:root`** — « si demain je veux changer le code couleur, je ne veux pas modifier une centaine de classes ». Aucune couleur en dur dans les classes : tout passe par les variables (`--bg/--accent/--gold/--ok/--danger/--copper/--silver/--ok-bright/--danger-soft/...`). Changer la palette = éditer `:root` seul. Fait (commit 1275522) : 134→96 hex, palette identitaire 100% tokenisée ; restent surtout `rgba(0,0,0/255,255,255,...)` d'ombres (génériques, OK) + quelques one-off à router au fil. **Réflexe : à chaque couleur écrite, utiliser/créer un token, jamais un hex en dur.**

2. **Ne pas laisser un fichier CSS monolithique** — « évite les fichiers css de 1200 lignes ». **FAIT** (commit a012fd4) : `styles.css` (4629 l.) découpé en **8 modules** sous `src/ui/styles/` (base/creator/combat-ui/combat-modals/sheet/merchant/hud/world-meta, 169-1247 l.) ; `styles.css` = orchestrateur d'`@import` dans l'ordre de cascade d'origine. **Méthode sûre** : couper UNIQUEMENT aux frontières de commentaires de section (ligne précédente = `}` ou vide → aucune règle coupée) ; découpage par numéro de ligne via PowerShell `Get-Content`/`Set-Content -Encoding UTF8` ; vérifier `vite build` + recette visuelle (build vert ne détecte pas une règle coupée). **Réflexe futur : nouveau style → dans le module du domaine concerné, et garder chaque module sous ~1200 l.**

3. **Design system — primitives canoniques** (2026-06-11, demande « un nouvel écran doit réutiliser l'existant, pas décoder son style »). `src/ui/styles/components.css` : `.panel` (surface ; `.sunken`/`.gold`/`.flush`), `.fold` (section repliable `<details>`), `.field` (champ libellé-au-dessus), `.stat-chip` (cartouche label+valeur), `.listrow` (rangée nom+méta+action), `.chip`/`.count` (badges), `.stack`/`.row-flex`. **Un écran COMPOSE ces classes**, ne recrée pas de surface ad-hoc. Importé après base.css. **Décision user : migrer TOUS les écrans existants** vers les primitives (les ~72 classes `-card/-panel/-section` dupliquées) — pilote fait (AdvSection→`.fold`, commit 89006de), reste à dérouler écran par écran avec recette. Garde-fou : nouveau style → primitive d'abord, sinon module de domaine.

4. **« Utilise ton nouveau style, ne reconstruis pas la dette par plus de dette »** (2026-06-11, pendant la refonte éditeur). Pour TOUT nouveau travail UI : **composer le design system existant** — primitives `components.css` (.panel/.fold/.field/.stat-chip/.listrow), cadre **`<Modal>` partagé** (pas de `.modal-overlay`+`.modal`+`useModalA11y` recopiés à la main), layouts responsive existants (`.layout-sidebar`/`.panel-grid`) — au lieu d'ajouter du CSS ad-hoc / des media queries one-off / des squelettes dupliqués. Ajouter de la dette pour refondre la dette = interdit. Ex. appliqué : les 3 modales d'éditeur (Triggers/Dialogues/Rencontres) dupliquaient le squelette modal → migrées vers `<Modal variant="plain">` (commit cb8ed84). **Réflexe : avant d'écrire du CSS, chercher la primitive/le composant qui existe déjà.**

Prolonge [[feedback-contenu-donnee-editeur-pas-code]] (pas d'éléments en dur) et [[game-jalon9-ui-ux-charte]]. Voir aussi clarté : « Destin 4·4 » illisible → 4 cartouches nommés (Destin/Chance/Résilience/Détermination) — afficher des valeurs avec leur LABEL, jamais un format cryptique « X·Y ».
