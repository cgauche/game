---
name: game-refonte-ui-jeu-video-2026-07
description: "Chantier « qualité jeu vidéo » livré (7 lots) — grimdark global, CharacterPreview, registre <Icon> 128 icônes, composants de donnée unifiés, interlude repensé ; + le Jalon 9 fondateur (charte de base, arbitrages, principe « viser le beau », méthode par écran)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 298e345a-9ba2-46be-a027-d30694d0cb87
---

Chantier UI « qualité jeu vidéo » livré le 2026-07-03 (7 commits sur feat/wfrp4-rpg-foundation) :
- **LOT 0** `5edd60a8` : tokens grimdark (valeurs seules, `--combat-*`/`--tooltip-*`/`--iso-*` intouchés), `Ornaments.tsx` (OrnateFrame/RuleDivider/CornerFlourish/Fleuron) + `.tx-parchment/.tx-iron/.tx-ink` (ornaments.css, `.tx-parchment` pose `color: var(--ink)`), `GlobalSvgDefs` (hôte UNIQUE des DEFS — exceptions : SSR galeries, ItemIcon, IsoStage), **`CharacterPreview`** (LA primitive perso-en-pied : props `hero` OU `appearance/equip/career`, mêmes briques que pickBackend), `.modal`→components.css, `.sheet-*`→sheet.css.
- **LOT 4** `d4b2062e`+`7d646b80` : registre `src/ui/icons/defs/` auto-chargé (gen-registry ICON_FAMILIES), primitive `<Icon id size>` + `iconSvg()`/`<IconG>` (contextes SVG), **128 icônes** 12 familles (charte : 24×24, trait 1.8 rond « dessiné main », currentColor, silhouette pleine à 14px), migration de ~107 emojis (ActionBar, effectIcons, combatNarration, calendarPhases, ItemIcon, scénarios, éditeur, menus), garde-fou `src/ui/no-emoji-affordance.test.ts` (scan fs, exceptions justifiées qui se vident).
- **LOT 1** `375acd58` : CharCard v2 (perso en pied), slots ornés + cascade + roving tabindex, picker « Créer » permanent, i18n campagne/sièges.
- **LOT 2** `91aa79b9` : Figure supprimée, figurine ÉQUIPÉE pleine colonne, `astrology.json` (verbatim ADE2 ch.03 l.504-512), `species.family` (regex tuée), constantes d'allocation sourcées LDB 05, récap = fiche parchemin (OrnateFrame or + Prose).
- **LOT 3** `cce8f85c` : statbloc bestiaire parchemin data-driven, facettes par catégorie dérivées des items, codexLookup indexé + invalidation, TabbedEntry onglet conservé, validateEntry() bloquant, titres de relations au site de déclaration.
- **LOT 5** `05116938` : `<Coins>` généralisé (~17 écrans), `<WoundsBadge>`, `<CharValue>`, `<GameDate>`, `<FxChip>` — une famille de donnée = UN composant.
- **LOT 6** `9c8cf471` : InterludeScreen refondu — SynthBar sticky 3 phases, ActivityPane gabarit unique à PIED FIXE avec pré-jet visible AVANT « Entreprendre », `activities.json.icon` (ACTIVITY_ICON code supprimée, garde data-wellformed).

**Comment appliquer :** tout nouvel écran compose ces primitives (CharacterPreview/Icon/Coins/WoundsBadge/CharValue/GameDate/FxChip/OrnateFrame/.tx-*) ; toute nouvelle affordance = id d'icône EN DONNÉE rendu par `<Icon>` (jamais un emoji — le garde-fou échoue sinon) ; datasets app-owned = format canonique `JSON.stringify(_,null,2)` SANS newline finale (round-trip serialize.test).

✅ **RÉSOLU (vérifié inventaire 2026-07-10)** : le correctif du 2026-07-05 (« 362+ émojis restants, exceptions jamais vidées ») est PÉRIMÉ — le chantier dédié #139 a été clos le 2026-07-06 : `no-emoji-affordance.test.ts` scanne `src/ui`/`src/state`/`src/gameIso`/`src/scenes`/`src/data/*.json` avec `EXCEPTIONS = new Set([])` VIDE + cliquet anti-péremption, suite verte. La source de vérité du sujet est LE GARDE, plus aucune mesure datée. Doctrine user inchangée : les émojis ne connaissent AUCUNE exception.

## Jalon 9 — le chantier fondateur de cette direction charte (2026-06-11, arbitrages + charte de base)

Ce chantier « qualité jeu vidéo » (07) prolonge le Jalon 9 (ROADMAP, ajouté 2026-06-11) : tous les écrans
passent de POC à **produit final** — pas qu'une charte, une refonte UI/UX (hiérarchie, parcours, wording,
états vides porteurs d'action).

**Arbitrages utilisateur fondateurs** : éditeur INCLUS dans l'objectif mobile 360px — **RE-CONFIRMÉ
verbatim 2026-07-11 : « l'application doit être mobile, éditeur inclus »** (claim désormais SOURCÉ,
cf. règle CLAUDE.md « arbitrage = citation ») ; direction « identité Warhammer marquée » ; retrait de
la mention campagne Ennemi Intérieur du menu ; purge du texte tuto.

**Tokens de charte d'origine** (`:root`, commit `419b3d8`) : charbon chaud `--bg #16120d`, **rouge sang**
`--accent #8e2418` (primaire), or vieilli `--gold #c9a227`/`--gold2`, `--parchment`/`--ink`/`--blood`,
`--font-display` = **Grenze Gotisch** (fontsource, embarquée, graisses 600/800) appliquée à h1-h3 partout ;
boutons primaire sang/hover or, barre d'écran à filet or, séparateur `.rule-fleur` (⚜) — le socle sur
lequel `Ornaments.tsx`/`.tx-*`/`GlobalSvgDefs` du LOT 0 ci-dessus ont été bâtis.

**Principe « VISER LE BEAU, pas que le cohérent »** (signal fort) : sur un premier re-skin de la carte du
monde (tokens + fix bug seulement), l'utilisateur a répondu « la world map est vraiment un POC, donc
hésite pas » + « c'est juste fonctionnel mais pas très beau ». Leçon : pour un écran jugé POC, ne pas se
contenter de cohérence/tokens — faire une VRAIE refonte visuelle (texture, ornements, identité dessinée).
Exemple livré : carte SVG transformée en carte ancienne (grain `feTurbulence` + vignettage + cadre à
fleurons + médaillons + routes courbes + rose des vents). « Hésite pas » = budget visuel ambitieux assumé.
Prolonge [[game-visual-direction]].

**Méthode par écran, répétée sur ~12 écrans** (menu/groupe, victoire, interlude, marchand, HUD, carte du
monde, fiche perso, éditeur, coop lobby, dialogue in-game) : audit parcours → hiérarchie/wording →
charte/beauté → recette responsive 360/1440. Chaque écran a révélé une vraie trouvaille (restes POC, bug
de classe CSS, texte verbeux). Méthode rapide de recette 360px : `__wfrp.talk('id')` /
`store.getState().startInterlude()` pour atteindre l'écran, puis mesurer `scrollWidth>clientWidth`.
