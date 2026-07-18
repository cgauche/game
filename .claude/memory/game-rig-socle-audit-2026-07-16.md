---
name: game-rig-socle-audit-2026-07-16
description: "Audit MESURÉ du rig de base (2026-07-16) : 41% des slots de tenue n'ont pas de vues dédiées (fallback générique), oreilles au-dessus des heaumes, torse ogre = copie du corps nu, 1 seule règle du contrat gardée sur 5"
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

Audit du socle demandé par l'user (« il faut absolument que le rig de base soit au niveau et débuggué si on veut que les tenues puissent être à niveau ») après qu'un panel de 4 juges d'art en aveugle ait refusé 26/29 tenues — beaucoup de griefs visant le RIG, pas les tenues (« c'est le rig, pas les tenues », verbatim d'un juge).

**LE VRAI DÉFAUT — mon hypothèse (plaquage littéral) était FAUSSE.** Comptage exécuté sur les 117 defs :
- `profile`/`back` copié-collé exact du `front` : **0 cas**.
- Slots fournis en **`string` front-only** (aucune vue dédiée) : **169/411 = 41 %**. Par slot : bras **77 %**, jambes **62 %**, torse 12 %, tete 5 %.
- **93/117 defs (79,5 %)** ont ≥1 slot dans ce cas.
- Mécanisme réel : quand une tenue ne fournit pas de vue, `resolve.ts` **invente une silhouette générique** teintée par `dominantCloth()` (`PROFILE_TORSE`/`BACK_TORSE`/`BACK_JAMBE`…). C'est ÇA que les juges ont vu (« le dos est un parent pauvre », « les bras sont des chapelets de gélules ») — pas de la paresse d'artiste : **le rig fabrique 41 % des vues**.
- ⇒ La règle « 3 vues obligatoires » est **mécaniquement imposable et fiable** (`typeof p === 'object'` ; le code s'en sert déjà : `hasProfileView`/`hasBackView`, `resolve.ts:77-78`).

**BUGS PROUVÉS (par exécution, pas par lecture) :**
- **Oreilles d'elfe au-dessus des heaumes** : `oreilles-pointues.ts:33-37` layer **3** vs `SLOT_LAYER.tete` (coiffe) = **2**, tri ascendant (`composeRig.tsx:314`) ⇒ l'oreille est TOUJOURS peinte sur le heaume. Comble : la tête de race est explicitement poussée sous la coiffe (`composeRig.tsx:204`, commentaire dédié) — même mécanisme, correct à un endroit, faux à l'autre, **aucun test ne distingue**. Cause racine : aucun entier libre entre cheveux(1) et coiffe(2), et les éléments portent des layers bruts (oreilles 3, barbe 10, panse 50) qui s'interclassent avec `SLOT_LAYER` sans contrat ni garde.
- **Torse d'ogre = corps humain** : `Ogre.ts:11` = chaîne STRICTEMENT identique à `bodies/defs/nu.ts:6`. L'élément `panse` (`elements/defs/panse.ts`) existe mais est **ORPHELIN** (0 référence en donnée). `GabaritDef` = 5 scalaires, aucun champ de silhouette. → #538.
- **Nuque** (corrigé `0ed863c9`) : `BACK_NAPE` était un trapèze plat partagé par les 117 tenues. Diagnostic par **échantillonnage pixel** (`Resvg.render().pixels`) : bande unie `#cf9d72` identique sur 4 tenues ⇒ bien la part partagée ; la zone de peau est anatomiquement attendue, seul l'ART était fautif.
- `FOOT` bruns littéraux (#426), `HAND` = `@peau` nu sans gants possibles.

**LE CONTRAT EST UN DOCUMENT, PAS UNE GARDE** (`src/gameIso/rig/PART-CONTRACT.md` + `docs/creer-une-creature.md` §4) : sur les 5 règles du §4, **une seule est gardée** (« bras monstrueux efface son poing »). La règle « élément latéral jamais plaqué de face en profil » — violée 8 fois par la vague — **n'a AUCUNE garde** : `lateralPair` (`parts/parallax.ts:41`) n'est appelé que par choix d'auteur dans 4 fichiers. Les goldens figent l'octet mais ne gardent pas une RÈGLE : un `-u` sans inspection fige un plaquage aussi bien qu'un bon dessin.

**Décision user (2026-07-16)** : « D'abord le socle, format après » — ne pas figer un contrat sur un rig cassé. Voir [[user-barre-art-relevee-2026-07-16]].

**POURQUOI TOUT ÉTAIT PLAT — le diagnostic que ni moi ni les juges n'avions su formuler** (trouvé par l'artiste du nouvel étalon, 2026-07-16) : le def précédent **éclairait SOUS son propre assombrissement** — l'arête spéculaire `@metalH` était tracée AVANT la nappe d'ombre `@metalO` qui l'écrasait. L'ordre des couches, pas leur absence. À vérifier en priorité sur toute tenue jugée « aplat ».

**Le rig INTERDIT tout élément d'épaule ASYMÉTRIQUE** (constaté en refaisant l'étalon) : l'os `bras` est MIROITÉ (`PART-CONTRACT.md`), donc y poser une fourrure d'épaule la met sur les DEUX épaules. La pelisse du Loup Blanc (sur UNE épaule dans l'illustration) reste donc un panneau pendant depuis le `torse` au lieu d'une peau jetée — l'artiste a « préféré la contrainte à la faute ». Limite structurelle à trancher si on veut de l'asymétrie d'épaule.

**Pièges de TRACÉ SVG découverts en refaisant l'étalon (2026-07-16/17)** — gravés dans l'en-tête de `Chevalier-du-loup-blanc.ts`, à connaître avant toute texture de bord : (a) **le `Z` d'un path ferme AU CORDEAU** — cette arête n'est dans aucune liste de points, elle échappe à tout générateur de dents (laissait 23,8 / 8,1 / 6,6 u de ligne droite en haut des 3 masses de fourrure) ; (b) **une masse additive ne peut pas cacher une ligne plate** : ses creux doivent passer AU-DESSUS de l'ancien bord, sinon celui-ci ressort entre les dents ; (c) **un brin de liaison se trace AVANT la masse** (il émerge de dessous) — après, sa racine lit comme une découpe de papier ; (d) **une dent sous-pixel n'existe pas** : le « fringe » d'origine avait une dent médiane de 0,92 u = **0,26 px à 40px** → bord net. C'était ça, « la serviette ». Toute texture de bord se mesure **en px à 40**, jamais en unités SVG.

**LA RECETTE DE MATIÈRE — un token `*O` est une VALEUR, pas une TEINTE** (cause racine des 3 tours d'étalon ratés, trouvée 2026-07-17) : `fourrureO #9ca9b4` à 0.5 sur crème compose à 78 % de luminance = **15 pts** sous la base → invisible. L'acier voisin — **la seule matière que les 4 juges ont validée depuis le début** — faisait déjà l'inverse : `metalO #0f1216` vs `metal #4c5663`, la teinte est quasi noire et c'est l'**opacité** qui sert la nuance. **La bonne recette était dans le fichier, à côté, depuis le début.** Test mécanique : `0.5·O + 0.5·base` doit tomber **≥30 pts** sous la base. Corrigé → 35,8 pts, test niveaux-de-gris passé.
**Autres contraintes de rig mesurées sur l'étalon (2026-07-17)** : (a) **`plane:'fond'` sur l'os `torse` est occulté à 100 %** par l'art de torse (z=5) — tout support censé être VISIBLE va en `avant` (un support invisible n'ancre rien) ; (b) **échelle : 1 u = 0,33 px à 40px** → un cerne de 0,9 u = 0,27 px **n'existe pas** : séparer deux masses claires se fait par **HALO** (path tracé 2×, stroke 2.2), jamais par un cerne fin ; plancher dur `stroke-width ≥ 0.2 u` ; (c) un `stroke` sur le bord d'une enveloppe **clippée** ne garde que sa moitié intérieure → liseré franc et débord impossible sans retoucher le contour ; (d) piège d'ordre confirmé **dans les deux sens** : une lèvre de lumière tracée APRÈS la face d'ombre la **crève** (d'où le patchwork) — une lèvre éclaire, elle n'efface pas.

**Ce qu'aucune facture ne corrige** : un détail de ~4,5px (le crâne de loup) ne résout PAS à 40px — il n'enregistre qu'une masse. Un identifiant doit être GRAND ou disparaître ; le contraste de VALEUR (ceinture de laiton sur armure sombre) est ce qui porte réellement la lecture en vignette.

**Piège d'outillage majeur** (a coûté un artiste entier) : le *Replace Mode* de lean-ctx remet `Read` dans `permissions.deny` **à chaque reconnexion du serveur MCP**, pas seulement au SessionStart. `ctx_read` ne lit PAS les images (« Binary file detected ») ⇒ **un artiste ne peut plus voir ses rendus**. Le correctif existe et est consenti : `node C:/Users/gauch/.claude/fix-leanctx-settings.mjs` (sort Read du deny, neutralise le hook redirect, garde Grep/Glob sur ctx_*) — **le relancer dès qu'un agent signale un refus de `Read`**. Contournement d'un agent bloqué, à réutiliser : vérifier une matière par **échantillonnage pixel** (`Resvg.render().pixels`) plutôt que par l'œil.

⚠ **PIÈGE PIRE ENCORE — le hook `read-dedup` MENT** (2026-07-16, artiste de l'étalon) : `Read` natif renvoie un faux stub « unchanged since last read · lean-ctx read-dedup » sur des fichiers **JAMAIS lus** — il prétend que le contenu est déjà en conversation alors qu'il n'y est pas. Un agent peu méfiant croit avoir lu et travaille sur du vide. Contournement : `ctx_read(mode=raw, fresh=true)`. Le hook fautif : `PostToolUse` matcher `Read` → `lean-ctx.exe hook read-dedup` (`~/.claude/settings.json`).
