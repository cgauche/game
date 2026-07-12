# Charte UI — référence vivante

> À lire avant de créer ou retoucher un écran (CSS, densité, responsive). Complète la règle
> stricte 4 du `CLAUDE.md` (responsive, breakpoints canon) et la table « Primitives partagées ».

## Architecture CSS

- **Couleurs UNIQUEMENT dans les tokens `:root`** (`src/ui/styles/base.css`) — jamais de hex en
  dur dans une classe. Palette : `--bg`, `--accent`/`--accent2` (rouge sang, action primaire),
  `--gold`/`--gold2` (bordures/focus/accents dorés), `--ok`/`--ok-bright` (succès),
  `--danger`/`--danger-soft` (alerte), `--copper`/`--silver` (monnaie). Changer la palette =
  éditer `:root` seul. Seules exceptions tolérées : `rgba(0,0,0/255,255,255,…)` génériques
  (ombres/voiles). **Réflexe : à chaque couleur écrite, utiliser ou créer un token.**
- **Pas de monolithe CSS.** `src/ui/styles.css` est un orchestrateur d'`@import` ; le style vit
  dans des modules par domaine sous `src/ui/styles/` (`base`, `components`, `creator`,
  `combat-ui`, `combat-modals`, `sheet`, `merchant`, `hud`, `world-meta`, `editor`, `compendium`,
  `codex-edit`, `house-rules`, `mass-battle`, `ornaments`, `tavern`). **Nouveau style → dans le
  module du domaine concerné** ; garder chaque module raisonnablement borné (pas de retour à un
  fichier de mille+ lignes).
- **Primitives canoniques** (`src/ui/styles/components.css`) — **composer, ne pas recréer une
  surface ad-hoc** : `.panel` (surface ; variantes `.sunken`/`.gold`/`.flush`), `.fold` (section
  repliable `<details>`), `.field` (champ libellé-au-dessus), `.stat-chip` (cartouche
  label+valeur), `.listrow` (rangée nom+méta+action), `.chip`/`.count` (badges), `.stack`/
  `.row-flex`. Idem pour le cadre `<Modal>` partagé (jamais de `.modal-overlay`+`.modal`+
  `useModalA11y` recopiés à la main) et les layouts responsive `.layout-sidebar`/`.panel-grid`/
  `.bar` (règle stricte 4). **Avant d'écrire du CSS : chercher la primitive qui existe déjà.**
  Afficher une valeur avec son LABEL, jamais un format cryptique (« Destin 4·4 » → 4 cartouches
  nommés Destin/Chance/Résilience/Détermination).
- **Le contenu VARIABLE (États, longueurs de noms) ne décale JAMAIS les colonnes d'une liste.** Une
  liste de rangées-personnages est une GRILLE à colonnes fixes (portrait | identité+États | contenu |
  valeur) ; la zone des chips d'États est une **cellule à empreinte STABLE, réservée dans la primitive**
  (`StateChips reserve` / `PortraitTile reserveStates`, `src/ui/StateChips.tsx`) — rendue vide sans État,
  les chips s'empilent DEDANS. Un héros porteur d'un État ne pousse plus la rangée voisine (arbitrage
  user 2026-07-11). Idem : les fills/strokes SVG viennent des tokens `var(--…)`, jamais d'un hex/rgb en
  dur dans le JSX (cliquet `src/ui/ui-ratchets.test.ts` (viii) — sinon « texte noir sur noir » quand la
  surface change de fond).

## Couche atomique — catalogue

Classes CSS **canoniques** réellement définies dans `src/ui/styles/components.css` / `base.css`
(+ `.seg` en `sheet.css`, composé par la primitive React `OptionChooser`). Ne couvre que le
PARTAGÉ (utilisé par ≥2 domaines) — pas les classes propres à un seul écran (`.voyage-*`,
`.city-hub-*`, `.party-*`, `.char-card*`…). Pour la couche **React** (composants, pas classes),
voir la table « Primitives partagées » du `CLAUDE.md` racine — les deux se lisent ensemble : une
primitive React pose souvent ces classes pour toi (ex. `RollShell` pose `.modal`/`.modal-actions`).

### Actions

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.btn` | Bouton de base (fond charbon, bordure) | Tout `<button>` porte `.btn` ou `.chip` ou est rendu par une primitive (`ChoiceButtons`…) — un bouton nu hérite le noir UA (`buttontext`), illisible sur fond sombre (vécu #358bis/#373). |
| `.btn.small` | Variante compacte (padding/police réduits) | Barres d'actions denses, rangées de liste. |
| `.btn-primary` | Action primaire (dégradé rouge sang) | Une seule par barre d'actions/modale — jamais deux primaires côte à côte. |
| `.btn-ghost` | Action discrète (transparent, texte atténué) | Annuler/Subir dans `.modal-actions` (ancré à gauche automatiquement) ; pas pour une action engageante. |
| `.btn-test` | Bouton d'outil de test/QA (bordure pointillée verte) | Réservé aux écrans Atelier/dev — jamais un écran joueur. |
| `.btn.danger` | Variante destructive (bordure rouge alerte) | Suppression/abandon irréversible ; combiner avec `.btn-primary` si c'est l'action principale de l'écran. |
| `.btn.btn-resource` | Petit bouton normé de ressource (Chance/Pacte/Résilience/Détermination) | Toujours DANS `.rm-influence` (`InfluenceRow`), jamais isolé. |
| `.chip` | Badge/pastille compacte (fond `--bg2`, texte atténué) | Alias moderne de `.tag` (historique, encore présent) ; toute nouvelle pastille utilise `.chip`. |
| `.count` | Pastille numérique (compteur) | À l'intérieur d'un `.chip`/`.tab-btn`, jamais seule dans le flux de texte. |
| `.entity-chip` (+ `.entity-badge`, `.entity-choice`) | Chip d'ENTITÉ unifié (compétence/talent/sort/objet) avec déclencheur popover CodexRef | Source unique = `EntityChip.tsx` — remplace `.tag`/`.codex-chip` pour toute entité de règle ; ne pas recréer un badge ad hoc pour un nom de sort/talent. |
| `.tag` (+ `.tag.talent`) | Badge historique (alias de `.chip`) | Ne pas en créer de nouveaux usages — préférer `.chip` ou `.entity-chip` selon le contenu (texte libre vs entité de règle). |

### Conteneurs / surfaces

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.panel` | Surface de base (carte/cadre, fond `--panel`, bordure, radius 12px) | Toute carte de contenu — jamais un `<div>` avec fond/bordure recopiés à la main. |
| `.panel.sunken` | Variante « creuse » (fond `--bg2`, plus sombre que la surface) | Zone en retrait dans un panel (ex. sous-section). |
| `.panel.gold` | Variante liseré or (bordure haute épaisse `--gold`) | Marque un panel « mis en avant » (résultat, section clé). |
| `.panel.flush` | Variante sans padding | Le panel contient déjà un composant qui gère son propre espacement (ex. `MasterDetail`, image pleine largeur). |
| `.fold` (+ `.fold-title`, `.fold-body`) | Section repliable (`<details>`) | `<details class=fold><summary><span class=fold-title>…</span></summary><div class=fold-body>…</div></details>` — toute section optionnelle/secondaire dépliable. |
| `.stat-chip` (+ `.sc-label`, `.sc-value`) | Cartouche « label + valeur » (PV, carac, ressource) | Afficher une valeur nommée — jamais un format cryptique (« 4·4 » sans libellé, cf. règle charte ci-dessus). |
| `.listrow` (+ `.lr-name`) | Rangée de liste : nom (flex:1) + méta + action | Toute liste d'entités cliquables/actionnables (inventaire, roster…) plutôt qu'un `<li>` stylé à la main. |
| `.wounds-badge` / `.char-value` / `.game-date` / `.fx-chip-label` | Composants de donnée unifiés (LOT 5) — respectivement PB/carac+avancées/date de jeu/étiquette d'effet | Rendus par leurs composants (`WoundsBadge`, `CharValue`, `GameDate`, `FxChip`) — ne pas reformater ces données à la main ailleurs. |
| `.icon` | Cadrage de l'icône SVG maison | Posée par la primitive `<Icon>` (`src/ui/Icon.tsx`) — cale l'icône sur la ligne de base du texte adjacent ; jamais un `<svg>` brut à côté de texte. |
| `.charprev` (+ `.charprev-svg`, tailles `.charprev-xs/sm/md/lg`, `.charprev-fill`, ambiances `.charprev-amb-panel/parchment/spotlight`) | Cadre d'aperçu « perso en pied » (`CharacterPreview`) | Toute vignette de personnage EN PIED — les tailles/ambiances sont des modificateurs, jamais un `<img>`/SVG dimensionné à la main. |

### Layouts responsive (règle stricte 4)

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.layout-sidebar` | Grille « colonne latérale (270px) + contenu » | Fiche vivante, inspecteurs — s'empile en 1 colonne ≤900px (breakpoint canon). |
| `.panel-grid` (+ `.span-2`) | Grille de `.panel` en auto-fit (min 340px) | Tableau de bord de plusieurs panels — 1 colonne ≤700px ; `.span-2` pour un panel pleine largeur. |
| `.bar` | Barre d'écran (en-tête, fond dégradé, filet or) | En-tête d'écran avec titre + actions — s'enroule ≤700px ; ne PAS la détourner pour une simple rangée sans fond/padding de header (charte : « éviter les espaces vides »). |
| `.screen` | Colonne plein-écran (flex column, hauteur 100%) | Coquille racine d'un écran plein-champ « historique » (hors `ScreenShell`, cf. table CLAUDE.md). |
| `.master-detail` (+ `.master-detail-list`, `.master-detail-detail`) | Gabarit maître-détail (liste gauche + détail centre), LAYOUT pur | Composé par `MasterDetail.tsx` (CLAUDE.md) — s'empile ≤700px (`MASTER_DETAIL_STACK_BREAKPOINT_PX`), jamais une 2ᵉ composition liste+détail recodée. |
| `.seg` (`sheet.css`) | Segmented control (choix exclusif, boutons collés) | Composé par la primitive React `OptionChooser` (variante `seg`) — jamais un groupe de boutons exclusifs recodé à la main. |

### Formulaires

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.field` / `.ed-field` | Champ de formulaire, libellé AU-DESSUS du contrôle | Toute paire libellé+input/select/textarea — `.ed-field` = même primitive côté éditeur. |
| `.ed-hint` | Texte d'aide en italique sous un champ éditeur | Précision de saisie (contrainte, format attendu), jamais un texte tutoriel joueur (cf. règle « Zéro texte tutoriel »). |
| `.bg-edit` (+ `.bg-hint`) | Bloc de champs « background » (Motivation/Ambitions) | Primitive `BackgroundFields`, partagée créateur ⇄ fiche — champs en `div.field` (pas `label`) pour un rendu identique sur les deux surfaces. |

### Titres / texte

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.mini-title` | Titre de section en petites capitales dures (11px, `--muted`) | Réflexe par défaut pour titrer une rubrique dans un panel — pas de nouveau style de titre ad hoc. |
| `.section-label` | Annotation de section alternative (small-caps, plus discrète que `.mini-title`) | Variante ADDITIVE quand `.mini-title`/un `Hn` gothique seraient trop lourds — pas un remplacement systématique. |

### Modales (cadre partagé)

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.modal-overlay` (+ variante `:has(.roll-modal)`) | Voile plein écran (`position:fixed inset:0`) | Cadre UNIQUE de toute modale — jamais un voile recopié à la main ; la variante `:has()` ancre les modales de jet en bas avec un voile plus léger. |
| `.modal` / `.modal.wide` | Boîte de la modale (surface, largeur plafonnée) | `.wide` (760px) pour un contenu riche (multi-colonnes) ; `.modal` seul (520px) sinon. |
| `.picker-modal` | Titre `<h3>` d'une modale de sélection | Modale de choix dans une liste (picker) — cohérent avec `.modal`. |
| `.modal-actions` | Barre d'actions de modale (max 2 boutons : ghost à gauche, primaire à droite) | JAMAIS de 3ᵉ bouton — les dépenses de ressources vivent dans `.rm-influence`, pas ici. |
| `.rm-influence` | Rangée « influencer le jet » (Chance/Pacte/Résilience/Détermination) | Vide → invisible (`:empty{display:none}`) ; composée par `InfluenceRow` (CLAUDE.md). |

## Densité et contrôles stylisés

- **Aucun contrôle natif non stylisé.** `<input type=checkbox/radio>` et `<select>` système sont
  interdits : style GLOBAL `appearance:none` appliqué dans `src/ui/styles/base.css` (+ variantes
  par module — `combat-ui.css`, `combat-modals.css`, `creator.css`) — case charbon bordée (cochée
  = fond `--accent` + marque `--gold2`), radio = point or, select = chevron or en data-URI, focus
  `--gold`, options thémées. **Piège select** : un override `padding` shorthand mange la flèche →
  utiliser `padding-right` + `background-color` (jamais `background` en raccourci).
- **Éviter les espaces vides.** Un panneau aéré-à-vide lit comme inachevé. Regrouper sur une
  ligne ce qui peut l'être (ex. itinéraire + boutons de mode en `space-between`), ne pas
  détourner `.bar` (header à fond/padding) pour une simple rangée, resserrer les marges —
  densité maîtrisée mais lisible. **Vérifier à 360px ET en large** : un layout qui tient à 360
  peut s'étaler à vide en grand (breakpoints canon 900/700/560, règle stricte 4).

## États de fin d'un combattant (#237)

Un combattant qui quitte le combat NE se rend pas de la même façon selon la raison — une croix
générique confondait mort, KO, reddition et hors-combat. Langage visuel défini **une seule fois**
dans `src/ui/endStateVisual.ts` (`END_STATE_VISUAL`), keyé sur la catégorie retournée par la
fonction moteur PURE `endState(c)` (`src/engine/conditions.ts`) :

| État (`endState`) | Sens | Icône | Classe |
|---|---|---|---|
| `mort` | mort définitive | `journal/death` (crâne) | `es-mort` (grenat) |
| `inconscient` | KO conscient perdu | `condition/unconscious` | `es-koan` (bleu) |
| `rendu` | reddition (#215) / coque amenée — pavillon baissé | `journal/surrender` | `es-rendu` (pâle, portrait NON grisé : l'ennemi capturé est intact) |
| `hors-combat` | éjecté vivant (Destin, naufrage, Mort Subite, coque coulée) | `journal/flee` | `es-hors` (sépia) |

`rendu` vs `hors-combat` repose sur le seul champ `Combatant.exitReason` (`reddition`/`prise` →
rendu ; `destin`/`naufrage`/absent → hors-combat), posé aux sites de sortie (`resolveSurrenderThreshold`,
`resolveShipUnits`, Destin dans `combatSlice`). Un héros à 0 PB CONSCIENT reste À Terre — `endState`
renvoie `null`, aucun marqueur de fin (l'À Terre vit dans les pastilles d'États).

Ce langage s'applique aux **trois surfaces** via cette source unique : le token iso (`BodyToken`,
pastille `token-endmark`), le portrait et la frise d'initiative (`PortraitTile`, badge `end-mark` —
la frise réutilise `PortraitTile`). Une coque (`bodyShape 'vehicule'`) passe par le même token :
prise = pavillon amené (`rendu`), coulée = `hors-combat`. Verrou : `src/engine/endState.test.ts`
(4 états distincts) + `src/ui/endStateVisual.test.ts` (icône/classe uniques sur token ET portrait).

## Zéro texte tutoriel

- **Ne JAMAIS ajouter de texte d'aide/tutoriel dans l'UI** (HUD ou écrans). Une UI bien conçue se
  comprend par ses affordances (surbrillances, chemins, badges d'action, curseurs,
  placeholders) — pas par un mode d'emploi affiché en permanence. Un badge/label = le NOM de
  l'action seul (« Charger (+1 Av) »), jamais une phrase d'instruction. Un **état vide** = un
  bouton d'action directe (« ➕ Créer un personnage »), jamais un paragraphe qui explique où
  aller.
- La consigne d'un champ va dans son `placeholder` ; l'explication optionnelle dans un `title`.
  GARDER en revanche les infos de DÉCISION (enjeux d'un choix : bonus PX, prix) et le lore — ce
  n'est pas du texte tutoriel.
- **JAMAIS de référence au livre dans un texte joueur** (pas de « Parer le tir — Protectrice 2+
  (LDB 62 l.307) » affiché à l'écran) : les refs LDB restent dans les commentaires de code
  (convention du dépôt), jamais dans l'UI. Réutiliser les libellés EXISTANTS plutôt que d'en
  réinventer un plus verbeux.
