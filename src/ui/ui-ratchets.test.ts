import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cliquets d'hygiène UI (#236) — même patron que `combat-hardcode-guard`/`no-emoji-affordance` : une
 * BASELINE gèle, PAR FICHIER, la dette tolérée au recensement ; toute HAUSSE échoue (régression) et
 * toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE. On ne PURGE pas la dette
 * ici — on interdit sa croissance et on impose la décrue.
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

function walk(dir: string, test: (f: string) => boolean, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, test, acc);
    else if (test(e)) acc.push(p);
  }
  return acc;
}
const rel = (abs: string) => abs.slice(UI.length).split('\\').join('/');

function assertRatchet(counts: Record<string, number>, baseline: Record<string, number>, what: string) {
  const over: string[] = [];
  for (const [f, n] of Object.entries(counts)) {
    const b = baseline[f] ?? 0;
    if (n > b) over.push(`${f} : ${n} (baseline ${b})`);
  }
  expect(over, `Régression ${what} — utiliser le token/la primitive, ou ABAISSER une baseline assainie :\n${over.join('\n')}`).toEqual([]);
  const stale: string[] = [];
  for (const [f, b] of Object.entries(baseline)) {
    const n = counts[f] ?? 0;
    if (n < b) stale.push(`${f} : baseline ${b}, réel ${n}`);
  }
  expect(stale, `Baseline(s) PÉRIMÉE(s) ${what} — abaisser :\n${stale.join('\n')}`).toEqual([]);
}

// ── (iv) Couleurs hex hors tokens `:root` : la palette vit dans `base.css` (§charte-ui). Tout hex
//    dans un AUTRE module CSS est de la dette gelée — le cliquet interdit sa hausse, impose la décrue.
//    Purge #310 : les 12 modules audités sont à ZÉRO — baseline vide, tolérance zéro. ──
const HEX_BASELINE: Record<string, number> = {};

// ── (v) Prix affichés ⇒ `<Coins>`/`formatMoney` : une valeur monétaire interpolée suivie d'une unité
//    nue (` CO`/` PA`/` CA`) dans le JSX est de la dette (illisible, non i18n). `Coins.tsx` définit
//    l'unité (exclu). Migré au #310 (ConditionEditor/EffectList/PortView → formatMoney/<Coins>) : la
//    dette réelle est retombée à zéro — heuristique fail-closed, sans baseline. Les 4 faux positifs
//    restants (CharacterSheet/CharacterCreator/GameOpEditor/EquipmentPanel) ne sont PAS de la monnaie
//    (« PA » = Points d'Armure, LDB) : exemption nominative gelée en dur ci-dessous plutôt qu'en
//    baseline (aucun de ces sites n'est censé approcher zéro un jour).
const PRICE_PA_ARMOR_EXEMPT = new Set([
  'CharacterSheet.tsx',
  'creator/CharacterCreator.tsx',
  'editor/GameOpEditor.tsx',
  'EquipmentPanel.tsx',
  // #492 Lot 1b : `ActiveEffectsPanel`/`describeEffect` (« PA (toutes Localisations) », Points
  // d'Armure) déplacés tels quels de CharacterSheet.tsx — même faux positif, même exemption.
  'EtatPanel.tsx',
]);
const PRICE_BASELINE: Record<string, number> = {};

// ── (vii) `flex-wrap: wrap` hors `components.css` : le motif « rangée qui s'enroule » vit dans
//    `.bar`/primitives partagées de `components.css` (§charte-ui). Un `flex-wrap` codé en dur dans un
//    AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  // +1 : `.creator-band-right:has(.notch-gauge + .notch-gauge)` (registre État, `EtatPanel.tsx`) —
  // bande à DEUX jauges de quota (Mutations) collisionnant avec son titre dans la colonne bornée
  // `.sheet-main` (motif `.bar` non composable ici, c'est un slot droit de `Band`, pas un bandeau).
  'styles/band.css': 1,
  'styles/base.css': 4,
  'styles/codex-edit.css': 1,
  // -1 (#492 lot POSSESSIONS B) : mort de l'ancienne `.inv-row { flex-wrap: wrap }` (registre
  // `Band`/`PlaqueRow` désormais, `.inv-actionbar` reprend le motif dans sheet.css, en regard).
  // +2 (chartrage du bloc « dé fixé », juge vision) : `.prow-act` (zone d'actions d'une rangée de jet)
  // et `.rm-die-pick` (options de dé + champ) — deux rangées de contrôles de largeurs variables qui
  // doivent s'enrouler dès 360px ; motif `.bar` non composable (chrome d'en-tête d'écran).
  'styles/combat-modals.css': 8,
  'styles/combat-ui.css': 7,
  'styles/compendium.css': 3,
  // +1 : `.creator-race-lineages` (#393 P2, correction structurelle Race) — rangée de chips de
  // lignée en tête du détail, s'enroule (motif `.bar` non composable ici, boutons de largeur variable).
  // -2 : lot « ossature enforcée » (#393) — mort du bandeau fiche-vivante ≤1100px du rail 3 zones
  // (`.creator-shell > .creator-summary` et `.creator-derived` en rangée), l'empilement vit sur
  // le gabarit unique `.creator-step`.
  // -1 : purge du bloc MORT `.career-path` (superseded par CareerPath/`.cc-path`, 0 réf) — voir (xii).
  'styles/creator.css': 5,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  'styles/hud.css': 6,
  'styles/mass-battle.css': 2,
  'styles/merchant.css': 1,
  // +1 (#492 lot POSSESSIONS B) : `.inv-actionbar` — barre d'actions de la rangée ÉLUE du registre
  // Possessions (motif « contrôles qui s'enroulent », hérité 1:1 de l'ancienne `.inv-row`).
  // -1 (juge vision, correction d'alignement de la bande Seuils) : `.etat-destin-row` MEURT — les 3
  // jauges composent `.notch-gauge-stack` (grid, patron de groupe de `NotchGauge`, gauges.css) au
  // lieu du flex qui s'enroulait sans aligner les 3 compteurs entre eux.
  // +1 (tableau de bord État, arbitrage user 2026-07-17) : `.etat-chips` — rangée de chips codex-liées
  // des États actifs qui s'enroule ; motif `.bar` non composable ici (chrome de barre d'écran) et
  // `.plaque-fx` scopé DANS `PlaqueRow` (`.plaque-name > .plaque-fx`), même justification que ce dernier.
  'styles/sheet.css': 4,
  'styles/world-meta.css': 18,
  'styles/city-hub.css': 1,
  'styles/voyage.css': 3,
  // +1 (lot #492 « chevet ») : `.plaque-fx` (chips d'effet net sous le nom, `PlaqueRow.tsx`) — enroule
  // en rangée, motif `.bar` non composable ici (le `.bar` du canon porte fond/bordure/padding d'en-tête,
  // pas d'une puce compacte sous un titre de plaque).
  'styles/plaque-row.css': 1,
};

// ── (viii) Couleurs `fill=`/`stroke=` LITTÉRALES dans le JSX de `src/ui` : un fill/stroke codé en dur
//    (hex/rgb/hsl) hors token `var(--…)` est de la dette — hors thème, illisible quand la surface change
//    de fond (bug « texte noir sur noir » du hub de voyage, user 2026-07-11). BASELINE = surfaces d'ART /
//    de CARTE existantes (aperçu de personnage, canevas de l'éditeur, carte du monde parcheminée) gelées
//    nominativement ; tout NOUVEAU .tsx reste à ZÉRO. Les defs d'art de `gameIso` sont hors périmètre
//    (scan borné aux `.tsx` de `src/ui`). `fill="none"`/`url(#…)`/`currentColor` ne sont pas des littéraux.
const FILL_LITERAL_BASELINE: Record<string, number> = {
  'AppearancePanel.tsx': 1,
  // Restent les teintes de CARTE sans token dédié (vert d'entité de zone, cyan d'entrée et d'aperçu de
  // rectangle, rouge d'exclusion de toiture) ; le jaune de sélection et l'encre de texte composent
  // `--iso-active-halo` / `--shadow-ink`.
  'editor/EditorCanvas.tsx': 8,
  'editor/Inspector.tsx': 1,
};

// ── (ix) Redéfinition de `.panel` hors `components.css` : la primitive canonique (#306) n'a qu'UNE
//    définition — un module qui la redéclare la rend inerte EN SILENCE (override, seul l'ORDRE d'@import
//    décide à spécificité égale ; à spécificité SUPÉRIEURE le composé écrase toujours, @media du canon
//    compris). C'était le piège de la règle MORTE `base.css` `@media 700px .panel{padding}` (base.css
//    @import AVANT components.css → jamais appliquée), ET l'angle mort des composés `.interlude-hero.panel`
//    (0,2,0) que l'ancre `^\s*\.panel` ne voyait pas (le sélecteur ne COMMENCE pas par `.panel`). Le cliquet
//    couvre donc TOUT `.panel` porté par le MÊME élément : bare en tête de sélecteur (`^\s*\.panel`), OU
//    composé à une autre classe (`X.panel`, ex. `.interlude-hero.panel`), modificateurs `.mod`/`:pseudo`/
//    `[attr]` inclus jusqu'à la fin du sélecteur (`\s*[,{]`). EXCLUS : les DESCENDANTS/enfants (`.panel h3`,
//    `.panel-grid > .panel`) — `.panel` n'y est pas compound sur le même élément, ils scopent sans remplacer
//    la surface — et la classe distincte `.panel-grid` (`.panel` suivi de `-`). La densité mobile du canon
//    vit DANS components.css, APRÈS la base, pour gagner la cascade.
// BASELINE nominative : les 3 spécialisations LÉGITIMES de l'interlude (world-meta.css) — carte d'Activité
//    à liseré d'or (`.interlude-hero.panel`, densité resserrée assumée), son état actif, et le bandeau de
//    bataille à liseré rouge (`.interlude-battle-banner.panel`). Densité CONSTANTE voulue (déjà compacte
//    ≤700px) — plus jamais INVISIBLES au cliquet. Tout NOUVEAU composé `.panel` reste à ZÉRO.
const PANEL_REDEFINE_BASELINE: Record<string, number> = {
  'styles/world-meta.css': 3,
};

// ── (x) `<button` « nu » (#373) : un `<button` dont le `className` (littéral OU gabarit) ne porte
//    AUCUNE classe canon `.btn`/`.chip`/`.seg` est de la dette gelée — cas d'école du hub (noir-sur-
//    noir, feedback user 2026-07-12 verbatim « tu as tendance a ne pas utiliser les primitives et
//    objets React, c'est de la folie »). Un `className` totalement OPAQUE (aucun littéral de chaîne
//    dedans, ex. `className={fn(x)}`) est traité honnêtement à part (catégorie OPAQUE, jamais fondu
//    dans le compte « nu ») plutôt que jugé aveuglément conforme ou non-conforme. Les commentaires
//    (bloc et ligne) sont neutralisés avant le scan — un `<button>` cité en JSDoc n'est pas du markup.
//    EXEMPTÉS (fichiers-PRIMITIVES qui définissent légitimement leur propre rendu de bouton, à charge
//    à l'appelant de les composer — jamais à réécrire un `<button>` à la main) :
//      - OptionChooser.tsx / Tabs.tsx / RollShell.tsx : primitives canon de bouton/onglet/action de la
//        table `docs/architecture.md`, citées nommément par le ticket #373 comme patron d'exemption.
//      - PortraitTile.tsx : primitive canon d'affichage de personnage (`.ptile*`), sa propre famille de
//        classes.
//      - MediaSelect.tsx : primitive canon de champ média (`.ms-trigger`), sa propre classe déclencheur.
//      - ViewControls.tsx / PovControls.tsx : chrome de bouton PARTAGÉ (constante `BTN`) flottant en
//        overlay HTML par-dessus le canvas iso (jeu + éditeur) — l'exception « boutons de canvas »
//        nommée par le ticket #373, hors flux document donc hors `.panel`/`.btn` par nature.
//    TODO(#373) : cliquet (xi) « écran plein-champ sans `.panel` dans son sous-arbre » — heuristique
//    et fichiers cibles à définir au triage du programme #371.
const BARE_BUTTON_EXEMPT_FILES = new Set([
  'OptionChooser.tsx',
  'Tabs.tsx',
  'RollShell.tsx',
  'PortraitTile.tsx',
  'MediaSelect.tsx',
  'ViewControls.tsx',
  'PovControls.tsx',
  // MenuCard.tsx : primitive canon du bouton de MENU (`MenuButton`, table CLAUDE.md) — même famille
  // que OptionChooser/Tabs, à charge à l'appelant (MainMenu/GameMenu) de la composer, jamais de recoder
  // un `<button className="btn">` de menu à la main.
  'MenuCard.tsx',
  // FigTile.tsx : primitive canon de tuile-figurine cliquable (`.fig-tile`, #412) — même famille que
  // PortraitTile.tsx, sa propre classe de composant.
  'FigTile.tsx',
  // PlaqueRow.tsx : primitive canon de la rangée-plaque (`.plaque-row`, #393 amendement 3) — même
  // famille que FigTile/MenuCard, sa propre classe de composant ; la plaque d'ACTION de la planche
  // est cliquable (`.c-plate{cursor:pointer}`), la primitive rend alors un VRAI bouton plutôt que
  // de laisser chaque écran piéger un `div` au clic.
  'PlaqueRow.tsx',
  // ListRow.tsx : primitive canon de la RANGÉE DE LISTE sélectionnable (`.listrow` + famille
  // `insp-row`/`codex-row`, #841) — même famille que Tabs/MenuCard/PlaqueRow. Elle existe justement
  // pour que plus aucun panneau ne recode la rangée : 13 sites de l'éditeur la composent désormais,
  // et les 3 classes d'état concurrentes (`active`/`on`/`is-selected`, dont une jamais stylée) sont
  // tranchées ici.
  'ListRow.tsx',
]);
// `dicewell` : bouton-encrier canon de `CreatorDice` (#414, langage `.c-dicewell.act` du kit
// « Atelier du scribe ») — même famille que `.btn`/`.chip`, sa propre classe de composant.
// `cc-step` : médaillon-bouton canon de `CareerPath` (#393 P2, 2026-07-14) — même famille, chaîne
// explorable propre (langage `.cc-path`/`.cc-link`, pas un `.chip`/`.seg` recyclé).
const BARE_BUTTON_CANON = /\b(btn|chip|seg|dicewell|cc-step)\b/;
const BARE_BUTTON_BASELINE: Record<string, number> = {
  'ActionBar.tsx': 1,
  // +1 (LOT L, 2026-07-17) : titre de bande CLIQUABLE (`onTitleClick`, registre État → catégorie
  // Compendium) — bouton de RESET pur (`all: unset`) posé UNE fois dans la primitive PARTAGÉE
  // elle-même (`Band.tsx`), jamais recopié à l'appel : tout consommateur de `Band` hérite du patron.
  'Band.tsx': 1,
  'CityHubScreen.tsx': 1,
  // +1 (2026-07-16, #496) : carte-bouton de talent 5c (race « A ou B ») — bouton BESPOKE
  // `.talent-option` (creator.css), même famille que `.fig-tile`/`.plaque-row` mais sans
  // fichier-primitive dédié ; migration vers un patron FigTile différée (une entrée porte 2
  // options, pas 1:1 avec la carte — cf. #496).
  'creator/CharacterCreator.tsx': 1,
  'editor/EditorToolbar.tsx': 1,
  // -5 (EffectList 1→0, FlowEditor 3→0, GameOpEditor 1→0, entrées retirées) : les trois menus
  // d'ajout de l'atelier (« + Effet » / « + Bloc » / « + Op mécanique ») composent la primitive
  // UNIQUE `AddMenu`, dont les rangées sont des `ListRow` — plus un seul `<button>` recodé.
  // #830 : +1 bouton `.pal-item` (sélecteur de matériau de l'outil mur/porte) — même patron que les
  // 6 boutons `.pal-item` déjà comptés ci-dessus (prop/créature/engin).
  'editor/Palette.tsx': 7,
  'editor/StatblockEditor.tsx': 2,
  'ErrorCollectorBanner.tsx': 1,
  // #839 : -1 (1 → 0, entrée retirée) — la remise au défaut d'une règle (`↺`) compose désormais
  // `GatedAction` (bouton `.btn` + raison VISIBLE du verrou de combat), plus un `<button>` nu.
  'InitiativeStrip.tsx': 3,
  'MerchantPanel.tsx': 1,
  'ObjectiveBanner.tsx': 1,
  'VoyageScreen.tsx': 4,
};
// Baseline SÉPARÉE des `className` opaques (aucun littéral dedans) : au recensement, zéro site après
// exemption des primitives — tout `<button className={fn(...)}>` NOUVEAU doit désormais soit exposer un
// littéral `btn`/`chip`/`seg` dans son expression, soit vivre dans un fichier-primitive exempté ci-dessus.
const BARE_BUTTON_OPAQUE_BASELINE: Record<string, number> = {};

// ── (xii) Sélecteurs de classe DÉFINIS par module CSS de DOMAINE (doctrine user 2026-07-12, #373 —
//    « J'y crois pas une seule seconde à des classes mono-écrans, c'est une excuse à la dérive »).
//    Le stock de classes de domaine doit être GELÉ et DÉCROISSANT — hausse = échec, motif : « motif
//    partagé ? → couche atomique (charte, catalogue) ; vraiment spécifique → justifier ». Modules
//    scannés = les modules de DOMAINE (`base`/`components`/`tabs` EXCLUS, couche partagée gardée par
//    xiii ; `styles.css` orchestrateur d'`@import` gardé par xiii) : creator, combat-ui,
//    combat-modals, sheet, merchant, hud, world-meta, editor, compendium, codex-edit, house-rules,
//    mass-battle, ornaments, tavern, party, gauges (jauges navire). L'exhaustivité (xiv) garantit
//    qu'AUCUN .css n'échappe à xii OU xiii.
//    Comptage = NOMS de classes DISTINCTS apparaissant en position de définition (sélecteur), toute
//    forme confondue (bare, composé `X.foo`, descendant `.foo .bar`, modificateur `.foo:hover`,
//    dans un `@media`) — dédupliqué PAR MODULE. Parse par accumulation caractère-par-caractère : le
//    tampon de sélecteur courant se vide à chaque `{` (capturé si ce n'est pas un prélude `@…`, ex.
//    `@media (...)`) et à chaque `}` (referme la règle OU le bloc `@media` — le contenu de règle,
//    jamais un sélecteur, n'est donc jamais scanné). Les commentaires sont neutralisés en amont.
const DOMAIN_CSS_MODULES = [
  'creator',
  'combat-ui',
  'combat-modals',
  'sheet',
  'merchant',
  'hud',
  'world-meta',
  'editor',
  'compendium',
  'codex-edit',
  'house-rules',
  'mass-battle',
  'ornaments',
  'tavern',
  'party',
  'gauges',
  'city-hub',
  'voyage',
  'gallery',
  'rose',
  'hero-sheet',
  'frames',
  'creator-step',
  'plaque-row',
  'band',
  'celestial-wheel',
  'creator-presentation',
  'creator-shell',
  'test-scenarios',
];
const CLASS_SELECTOR_BASELINE: Record<string, number> = {
  'styles/codex-edit.css': 20,
  // LifeBar (#492, arbitrage 2026-07-17 « on sait gérer de vraies barres de blessures ») : +5
  // (27 → 32) — `.life-bar(-label|-track|-fill|-value)`, primitive dédiée (patron NotchGauge, même
  // module « jauges »), remplace `.ptile-gauge`/`.ptile-pv` (morts, contrepartie en hud.css).
  // +1 (juge vision, correction d'alignement bande Seuils) : `.notch-gauge-stack` — patron de GROUPE
  // de la primitive `NotchGauge` (colonnes label/piste/valeur alignées en `subgrid` entre N jauges
  // empilées), posé ICI (à côté de la primitive) et non dans `sheet.css` (appelant).
  'styles/gauges.css': 33,
  // #417 suite (consécration HeroSheet) : -6 — .candidate-detail-head/-fig/-id (bande
  // d'en-tête) + override .candidate-detail-pane .creator-derived (dérivées 2 colonnes) morts,
  // portés par hero-sheet.css (SOURCE UNIQUE partagée avec la fiche vivante du créateur).
  'styles/party.css': 66, // #417 passe finale : eyebrow .camp-plate-eyebrow (CAMPAGNE) + override scopé .entity-chip sous .card-roles (chips d'axes small-caps inline, jamais une boîte)
  // +5 : bande d'en-tête figurine+identité+rose du détail candidat (correction de cap 2026-07-14,
  // remplace `.candidate-detail-rose` par `.candidate-detail-head`/`-fig`/`-id`).
  // +6 : grille de sièges « Les contrats d'engagement » (compagnie-mock0.png, correction de cap
  // 2026-07-14) — `.party-acts-header`/`-title`/`-subtitle`, `.seat-card-seal`/`-contract`,
  // `.seat-contract-badge`/`.seat-empty-title`, `.party-actions-summary`/`-buttons`.
  // +6 : scène centrale du roulis + dé SVG au chiffre gravé sur la face (#396 v2-v4) — `.rm-scene`/
  // `.rm-die-landed`/`.rm-die-svg`/`.rm-die-gem`/`.rm-die-num`/`.rm-die-rolling` (primitive DiceRoll).
  // +1 (2026-07-16, #496) : `.rm-die-gold` — modificateur de matière DORÉE de `DieFace`/`DiceRoll`
  // (prop `tone`), SOURCE UNIQUE qui remplace les 3 scopes ancêtres dupliqués (creator-step.css/
  // plaque-row.css, purgés en regard).
  // Onglet Compétences & Talents composant `HeroSheet` (arbitrage 2026-07-17) : -5 (148 -> 143) -- `.skill-grid`/
  // `.skill-line`/`.sk-name`/`.sk-val`/`.sk-adv` MIGRENT vers hero-sheet.css (module de la primitive
  // qui rend la table à valeurs (source unique), contrepartie ASSUMÉE en regard.
  // Lot POSSESSIONS (A) : -2 (143 -> 141) -- mort du mannequin `.equip-doll`/`.equip-figure`
  // (EquipmentPanel, #492) : le rig grand format vit desormais dans la colonne de la fiche.
  // Lot POSSESSIONS (B) : -12 (141 -> 129) -- mort de l'ancienne rangée `.inv-row`/`.ir-*`
  // (Sac de l'onglet Possessions) : `.inv-rows`/`.inv-row`/`.kind-melee`/`.kind-ranged`/
  // `.kind-armor`/`.equipped`/`.ir-main`/`.ir-name`/`.ir-stats`/`.ir-enc`/`.ir-kind`/`.inv-nested`
  // migrent au registre `Band`/`PlaqueRow` (module sheet.css, patron EtatPanel) — `.ir-hand` reste
  // ici (HandPicker, composé DANS la nouvelle barre d'actions, inchangé).
  // Chartrage du bloc « dé fixé » (juge vision) : +4 (129 -> 133) -- `.prow`, `.prow-act` et
  // `.prow-fixed-mark` EXISTAIENT déjà dans le markup de `RollRow` SANS aucune règle (le défaut mesuré :
  // ferrage hérité de l'ambiance de la coquille, centré sous `.test-modal` / à gauche sous `.roll-modal`) ;
  // `.rm-die-pick` remplace le détournement de `.rm-loc-grid` (grille de 3 boutons) par le bloc propre du
  // sélecteur. Aucun nouveau motif d'écran : le champ COMPOSE `.field` (canon), sans classe de domaine.
  // +7 (#942 L7, verdict vision) : pied FIXE de `RollShell` (`.modal:has(> .rs-scroll)`, `.modal > .rs-scroll`,
  // sa barre d'actions), `.prow-line` (+ son 1er enfant) qui ancre la marque à SA ligne, `.rm-range`
  // (+ son cas sans libellé) pour la fourchette des tuiles, et l'allègement de voile DESCENDU ici
  // depuis la couche partagée (`.app-campaign .modal-overlay:has(.roll-modal)`).
  // +2 (#1078 LOT A1) : `.rm-subtitle`/`.rm-summary` — `.rm-vs` servait CINQ rôles (opposition
  // VsHeader, sous-titre de RollShell, bandeau d'issue agrégée) sous un seul nom : restyler l'un
  // repeignait les autres. Somme nulle VISUELLE (les trois classes partagent le MÊME bloc de
  // déclarations, combat-modals.css) ; la hausse achète la séparation des rôles, pas un motif d'écran.
  // +1 (#1078 LOT B2) : `.rm-spellinfo` — la PORTÉE d'un sort (gabarit de ZdE / « sur lui-même »,
  // CastModal) détournait `.rm-vs` alors qu'elle n'oppose personne. MÊME bloc de déclarations : somme
  // nulle visuelle, un rôle de plus nommé.
  'styles/combat-modals.css': 143,
  'styles/combat-ui.css': 112,
  // +1 : `.nb` (#393 P2) — note d'atelier non cliquable en fin de section chips (CodexRowView).
  'styles/compendium.css': 56,
  // +25 : charte « Atelier du scribe » (#412) — MetalStatus/WaxSeal+SealedPlaque/CareerPath/
  // FigTile/GroupedPickGrid/DetailFrame (primitives SANS canon préexistant).
  // +1 : `.creator-race-shell` (#393 P1) — gabarit deux-zones de l'étape Race (compose
  // `MasterDetail`, enfants ciblés par position pour ne pas re-déclarer ses classes).
  // +1 : `.rm-loc-grid` (#393 P1) — override responsive 360px scopé à l'étape Race, la primitive
  // `OptionChooser` (combat-modals.css) fige 3 colonnes quel que soit le conteneur.
  // +11 : peau « Atelier du scribe » LOT #414 (`.dicewell`/`.dicewell-tray`/`.dicewell-txt` —
  // encrier bordé-teinté de CreatorDice) + restructuration concurrente de l'étape Race (#393 P2,
  // `.creator-race-card`/`.creator-race-grid`/`.creator-race-lineages`/`.creator-race-lineage`…).
  // +5 : correction structurelle Race (#393 P3, verdict utilisateur 2026-07-14) — rangée recherche+
  // encrier (`.creator-race-toolbar`/`.creator-race-search`), copy titre+sous-titre de l'encrier
  // (`.dicewell-copy`/`.dicewell-sub`), état résolu (`.dicewell.done`) et liseré de borne
  // (`.creator-race-card.rolled`).
  // +6 : polish finale Race (#393 P4, rapport juge vision) — `.detail-frame-head`/`.detail-frame-sub`
  // (tagline sourcée), `.dicewell.emph` (encrier idle en emphase), override local
  // `.creator-race-card .charprev-lg` (figurine généreuse sans casser le zéro-scroll).
  // +2 net (#393 P2) : mort du call-site Carrière de `FacetedPickGrid` — `.pick-facets`/`.pick-grid`/
  // `.pick-card*` PARTENT (dernier consommateur), `.creator-race-shell/-toolbar/-search/-count`
  // deviennent `.creator-pick-*` (partagées Race+Carrière, renommage 1:1) + `.dicewell-die` (grands
  // losanges de l'encrier, correctif toolbar P1).
  // +2 : correctifs utilisateur 2026-07-14 (rang CareerPath explorable — `.cc-step.sel`/
  // `.cc-step:focus-visible` ; rangée filtres Carrière — `.creator-pick-filters`).
  // #417 suite (consécration HeroSheet) : -3 — .creator-summary .stat-val.boost (highlight
  // d'augmentation, plus rendu par la fiche vivante — HeroSheet ne le porte pas) et
  // .creator-summary .char-skills (bloc mort, remplacé par le corps HeroSheet) retirés.
  // #393 P3 (Caractéristiques/Signe astral, étalons finale-mock2/mock3) : +3 — `.char-die` (dés
  // permanents par rangée du tirage), `.star-wheel-col` (colonne roue, `.appear-panel`/`.appear-
  // controls` réutilisés pour le reste du layout) et `.cw-label` (noms de signe autour de la roue) ;
  // `.rolled`/`.row-flex`/`NotchGauge` réutilisés pour le surlignage de rangée et la jauge N/10.
  // Lot P3 final (retouches juge vision) : +2 — `.cw-label-dash` (tirets d'anneau à 23 signes),
  // `.creator-identity-roadmap` (chips signe/nom prospectives).
  // Lot P3bis+P4 (#393, écrans Caractéristiques/Compétences & Talents à la charte Atelier) : +17 —
  // scaffolding de layout des DEUX NOUVEAUX écrans plein-panneau (`Band` générique + gabarit
  // deux-zones panneau/fiche vivante, MÊME composition que Race/Carrière) : `.creator-band(-head|-right)`,
  // `.creator-chars-(screen|shell|main)`, `.creator-skills-(screen|shell|main|head|title|sub|card|tabnav)`,
  // `.creator-talents-cols`, `.skill-row(-grid|-label)` — widgets d'allocation composent `QtyStepper`
  // (canonique, mort du `Stepper` local), aucune classe recodée pour ça.
  // Migration FigTile (#430 phase 2, même lot) : -21 — purge de l'ancien motif `.creator-race-card*`
  // (tuile bois + charprev imbriqué, mort par cascade depuis be3fe9e0) au profit du cadre UNIQUE
  // `FigTile`/`frames.css` ; ne reste qu'un modificateur ADDITIF `.creator-race-grid .fig-tile.rolled`.
  // +3 : pastilles de suivi 5a (`.creator-skill-quota-gauges` + descendant `.notch-gauge`, compose
  // `.row-flex` en JSX — LOT clôture pieds étape 5) et séparateur « ou » des talents de race
  // (`.talent-option-ou`, arbitrage doc mémoire game-charte-talents-ou-chips-codex-lisibles).
  // #393 P5 (Possessions/Détails/Présentation, DERNIER lot du programme #393) : +18 — étend le
  // gabarit deux-zones aux étapes 6/7 (`.creator-trappings-(screen|shell|main)`,
  // `.creator-details-(screen|shell|main|toolbar)`) ; identité (`.identity-(grid|field|sex-toggle)`) ;
  // bourse (`.creator-purse-line`) ; gabarit DÉDIÉ 3 colonnes de l'étape 8, renommée « Présentation »
  // (`.creator-presentation-screen`, `.presentation-(col|left|center|right|fig|name|sub)`).
  // Correctif responsive PRÉSENTATION (agent-œil post-livraison, même lot) : +1 —
  // `.presentation-left .char-stats` (repli 3 colonnes ≤560px, la grille 5 colonnes canonique
  // débordait la colonne étroite mobile).
  // Lot « OSSATURE ENFORCÉE » (#393, croquis user 2026-07-15) : -18 NET (163 → 145, décrue
  // exigée par l'amendement 2 « revenir SOUS 123 » — premier maillon du lot). Le gabarit 2 zones
  // s'encode dans `CreatorStepFrame` (`.creator-step`, renommage 1:1 de `.creator-pick-shell`) :
  // MORT du rail 3 zones (`.creator-shell`/`.creator-rail`/`.creator-main` + overrides ParchmentCard
  // `.creator-main .tag|.talent-option|.talent-desc|.char-alloc|.path-node`, bandeau fiche ≤1100px),
  // des shells par-étape (`.creator-chars|skills|trappings|details-(screen|shell|main)`) et de
  // `.rail-line` ; la teinte dorée des dés vit dans creator-step.css (module de la primitive).
  // Consécration PlaqueRow (#393 amendement 3, même lot) : -8 (145 → 137) — les rangées de
  // caractéristiques de l'étape 3 composent la primitive (plaque-row.css) : `.char-alloc(-grid)`/
  // `.char-key`/`.char-name`/`.char-roll`/`.char-die`/`.char-total`/`.rm-die-num` morts ici.
  // Migration étape 1 (species, même lot) : -3 (137 → 134) — purge du bloc MORT `.career-path`/
  // `.path-node`(`.current`/`em`), ancien CareerPath superseded par la primitive `.cc-path`/`.cc-step`
  // (0 réf TSX) rencontré en auditant creator.css pour la décrue.
  // Migration étape 7 (details, même lot) : -5 (133 → 128) — l'état civil COMPOSE la rangée-plaque
  // (`PlaqueGrid`/`PlaqueRow`, planche `.idf` = la plaque à colonne de libellé gravée) : mort de
  // `.identity-(grid|field|sex-toggle)` et de `.input-dice` (la valeur éditable est une matière de
  // plaque, plaque-row.css) ; la bande d'action rejoint l'en-tête d'étape PARTAGÉ
  // (`.creator-skills-head`, topbar `.fam-topbar` de la planche) → `.creator-details-toolbar` MORTE.
  // Migration étape 6 (trappings, même lot) : -1 (134 → 133) — `.creator-purse-line` MORTE : le total
  // de la bourse s'ancre à droite de la barre (`Band.right`, motif `.cu-sechead .cnt` de la planche —
  // même rang que les « N objets » des dotations), les faces figées + la note passent en enfants
  // DIRECTS de la bande (valeurs `.c-note` déjà portées par `.creator-band > .hint`).
  // Consécration StepHeader (#393 amendement 3, clôture de la migration étape 7) : -3 (128 → 125) —
  // les 6 en-têtes de pas (étapes 3, 5a/5b/5c, 6, 7) COMPOSENT la primitive (creator-step.css, valeurs
  // `.fam-topbar`/`.c-dhead` de la planche : titre 26px + rubrique small-caps EN LIGNE à la baseline,
  // là où le markup recopié à la main les EMPILAIT) : `.creator-skills-head`/`-title`/`-sub` morts ici.
  // Migration étape 8 (presentation, clôture du lot) : -9 (125 → 116, sous l'objectif < 123 de
  // l'amendement 2) — tout le style de la mise en scène finale rejoint SON module dédié
  // (creator-presentation.css, patron rose.css/frames.css) : `.creator-presentation-screen`,
  // `.presentation-(col|center|fig|name|sub|left)` morts ici, et avec eux les deux descendants qui
  // n'existaient QUE pour cet écran (`.presentation-col .mini-title`, `.presentation-left .char-stats`
  // — d'où -9 et non -7 : le compte est par NOM de classe cité, pas par règle).
  // Migration étape 4 (star, lot ossature) : -2 (116 → 114). L'astrolabe rejoint SON module dédié
  // (celestial-wheel.css, patron plaque-row.css/creator-presentation.css) : `.celestial-wheel`,
  // `.cw-label`, `.cw-label-dash` morts ici ; et le corps de l'étape COMPOSE le patron
  // figure+contrôles déjà canon du fichier (`.appear-panel`/`.appear-controls`) au lieu des
  // `.star-body`/`.star-detail-col` que la migration avait d'abord recodés — seules `.star-wheel-col`
  // (l'astrolabe veut la moitié de la zone, `.appear-figure` est une vignette de 184px) et
  // `.star-apparence` (l'ambiance de la constellation) restent propres au pas.
  // Migration étape 5 (skills 5a/5b/5c, lot ossature) : -6 (114 → 108), SANS module neuf — la
  // réserve annoncée par l'amendement 3 (« rangées d'allocation de l'étape 5 : MÊME meuble » que
  // les caracs de l'étape 3 ; la planche le dit en clair, ses `.cs-row` et `.ck-cell` ont la MÊME
  // matière au hex près). Les trois volets composent `PlaqueGrid`/`PlaqueRow` : `.skill-row`,
  // `.skill-row-grid`, `.skill-row-label` morts ; `.creator-skills-card` morte (le gabarit porte le
  // layout) ; `.creator-talents-cols` morte au profit de la primitive GLOBALE `.panel-grid` (« deux
  // colonnes de même rang » de la planche mock6) ; `.creator-skill-quota-gauges` morte, les quotas
  // se comptant dans la tête de `Band` (`.cu-sechead .gauge` : « la réglette sertie compte les
  // quotas au même endroit, toujours »). La rubrique `.rf` de la planche (carac liée), portée à
  // l'identique par `.cs-row` ET `.ck-cell`, entre dans la primitive (prop `sub`) SANS classe neuve :
  // sélecteurs d'ÉLÉMENT sous la classe existante (`.plaque-name:has(> small)`, `.plaque-name > small`),
  // l'idiome que le module tenait déjà pour la plaque éditable (`.plaque-name > input`).
  // Vérification finale du lot ossature : -1 (108 → 107) — purge de `.tag-char`, MORTE (0 réf, la
  // marque « carrière » des rangées de caractéristiques porte `.tag.char` — classe DISTINCTE, bien
  // vivante, définie juste en dessous). Audit de décrue : les 4 autres classes sans consommateur
  // LITTÉRAL du fichier sont des faux positifs (`metal-status-chip|-plaque`, `st-argent|-or` sont
  // bâties par gabarit dans `MetalStatus.tsx` — `metal-status-${size}` / `st-${tier}`).
  // LOT « la tuile, aux valeurs » (#431) : -2 (107 → 105) — PURGE du doublon `.fig-tile*`, la dette
  // de la « phase 2 » annoncée par #430 et jamais payée (frames.css redéclarait la primitive « sans
  // toucher creator.css » : deux peaux se disputaient la tuile par cascade). `.fig-tile-name` et
  // `.fig-tile-sub` meurent ICI, frames.css devient la SEULE définition (+1 en regard, cf. plus bas).
  // `fig-tile` et `sel` restent comptés : le modificateur DOMAINE `.creator-race-grid .fig-tile.rolled`
  // et `.cc-step.sel` les gardent vivants dans ce module.
  // +2 (2026-07-16, #496) : sceau de cire des talents 5c (planche #393, patron `FigTile`) — la carte
  // EST la cible de clic (`.talent-option` devient tantôt le `<button>`, tantôt son enveloppe
  // `<div>` quand elle porte un `<select>` non imbricable dans un bouton) : `.talent-option-btn`
  // (reset de l'enfant cliquable côté carrière) et `.talent-option-seal` (médaillon du sceau) —
  // les 3 `<input type=radio>` des cartes race/carrière meurent au profit du bouton natif.
  // Onglet État — registre compact (#492 Lot 1c, arbitrage user 2026-07-17) : -4 (107 → 103) — la
  // bande titrée (`Band`) est EXTRAITE en primitive partagée (`Band.tsx`/`styles/band.css`, patron
  // plaque-row.css/frames.css) : `.creator-band(-head|-right)` meurent ici, contrepartie ASSUMÉE en
  // regard (band.css, plus bas).
  // Cue de bord de rail scrollable (#535, recette navigateur) : +1 (103 → 104) — `.master-detail-list`
  // (déjà comptée en couche partagée, `components.css`) réapparaît ICI comme fragment de sélecteur
  // `.creator-step > .master-detail-list::before/::after` (`docs/charte-ui.md` § « Cue de bord de
  // rail scrollable ») : nommer le RAIL RÉEL plutôt qu'un `:first-child` structurel opaque — la
  // recette a mesuré que l'ancien sélecteur, correct mais anonyme, ralentissait le diagnostic
  // navigateur (identification du conteneur ciblé). Coût assumé pour la diagnosticabilité.
  'styles/creator.css': 104,
  // +1 (113) : `.trace-layer-panel` — panneau flottant du CALQUE DE RÉFÉRENCE (décalquage d'une
  // planche de livre, #830), motif propre à l'éditeur (chargement/opacité/calage 2 points).
  // +3 (116) : `.trace-layer-panel-collapsed`/`-head`/`-chevron` — repli/dépli du panneau (#830 suite,
  // retour user 2026-07-25 « comment je ferme/ouvre le calque de référence ? »).
  // #834 audit-2 défaut 2 : + `.autosave-recovery-pill` (pastille de reprise masquée, sinon invisible).
  // -1 (117 → 116) : le menu d'ajout de l'atelier compose `ListRow` (cité ici pour sa densité de menu)
  // au lieu de ses deux classes propres `.eff-add-group`/`.eff-add-item`, mortes.
  // -1 (116 → 115) : `.eff-type` meurt — le CHANGEMENT de type d'un effet/d'une op se sert du même
  // menu que l'ajout (`TypeMenu` sur `AddMenu`), plus aucun `<select>` de type dans l'atelier.
  'styles/editor.css': 115,
  'styles/house-rules.css': 9,
  // LifeBar (#492, arbitrage 2026-07-17) : -2 (145 → 143) — `.ptile-gauge`/`.ptile-pv` MEURENT (le
  // marqueur `ptile-gauge` reste un className de compatibilité, sans style propre), le rendu vit
  // dans `LifeBar` (gauges.css).
  // #668 : +1 (143 → 144) — `.objective-deadline` (puce de compte à rebours du bandeau d'objectif).
  // #1078 LOT B1 : +1 (144 → 145) — `.info` complète le trio de tons de `.recap-line` (`ok`/`bad`
  // déjà ici) : le ton ATTÉNUÉ s'écrit, au lieu de dépendre de la couleur par défaut — un cadre qui
  // remet ses lignes à pleine couleur l'effaçait.
  'styles/hud.css': 145,
  'styles/mass-battle.css': 29,
  'styles/merchant.css': 53,
  'styles/ornaments.css': 13,
  // #492 Lot 1b : -9 (91 → 82) — extraction du bloc `.test-scenarios`/`.ts-*` (SON module dédié,
  // aucun rapport avec la fiche) ; +5 (82 → 87) — onglet État rédigé, silhouette organisatrice
  // (`.etat-body`/`-zones`/`-zone`/`-ras`/`.ras-title`, tonalité en attribut `data-tone` — pas de
  // classe par ton). Net -4.
  // #492 Lot 1c (registre compact, arbitrage user 2026-07-17) : -3 (87 → 84) — la silhouette
  // organisatrice (rig + zones par Localisation, jugée du bruit) MEURT : `.etat-body`/`-zones`/
  // `-zone` retirés. Ne reste que l'état calme (`.etat-ras`/`.ras-title`, composition validée
  // inchangée) — le registre affligé compose `Band`/`PlaqueRow`, aucune classe neuve ici.
  // +2 (#509 : .bg-favors/.favor-chip — Faveurs dues sur BackgroundPanel) — survivent (BackgroundPanel, hors fiche).
  // #492 LOT « colonne PRÉSENCE » (arbitrage 2026-07-17, 2e vague) : +1 (84 → 85) — SEULE hausse du
  // lot, malgré la mort de la rangée de compagnie (`.frame-row`, portée par `party.css`, pas ce
  // module) et le déplacement pur des blocs `.sheet-vitals`/`.sheet-resources`/`.sheet-stats` DANS
  // la colonne et les onglets (zéro classe neuve, ils sont RÉUTILISÉS — et restent VIVANTS pour
  // `ShipSheet.tsx`, qui les partage, donc non retirables). Le `+1` est `.plaque-row`, référencé ICI
  // pour les liserés de gravité (`[data-tone] .plaque-row`, pt.5) : `PlaqueRow.tsx` est hors périmètre
  // du lot (pas de prop `tone` à y ajouter, `data-tone` reste posé sur la bande `Section` englobante,
  // jamais une classe par ton) — cibler le sélecteur en DESCENDANT est le seul geste possible sans
  // sortir du périmètre. La gangrène du cadre (`data-corruption`, pt.6) et le dock au-dessus de
  // l'overlay (pt.2, `PartyDock.tsx`) sont à coût NUL ici (attributs / z-index inline contextuel).
  // Correction de jumeau (2026-07-17) : -3 (86 → 83) — `.sheet-headstats` (bornage 223px, écrit
  // contre le MAUVAIS jumeau) et `.sheet-stats`/`.sheet-resources` (morts : la tête de l'onglet
  // Compétences RÉUTILISE désormais `hero-sheet-stats`/`.hero-sheet-derived`, le patron du jumeau
  // CANONIQUE `HeroSheet` — hero-sheet.css, déjà importé globalement, aucune classe neuve). `.sheet-
  // vitals` reste (vivant pour Encombrement en Possessions ET pour `ShipSheet.tsx`).
  // Onglet Compétences & Talents composant `HeroSheet` (arbitrage 2026-07-17) : -1 (83 -> 82) -- `.sheet-skills`
  // (margin-bottom du wrapper 'competences' recodé a la main) MEURT : la rubrique vit desormais dans
  // la primitive, dont le flex `.hero-sheet{gap:10px}` espace deja ses sections.
  // #492 lot « colonne présence » (arbitrage user 2026-07-17, rig grand format + arc integre) :
  // +4 (82 -> 86) -- l'override mobile compose la primitive FigTile/VitalArc en DESCENDANT
  // (`.sheet-portrait .fig-tile.hero`/`.fig-tile-fig`, `.sheet-portrait .vital-arc svg`) : 4
  // classes CITEES ici (fig-tile, hero, fig-tile-fig, vital-arc), aucune definie EN PROPRE.
  // Onglet État sans figurine au repos (arbitrage user 2026-07-17) : +1 (86 -> 87) -- `.ras-sub`
  // (sous-ligne discrete du RAS), seule classe neuve ; `CharacterPreview` retiree de l'etat calme.
  // Lot POSSESSIONS (B), registre `Band`/`PlaqueRow` (#492) : +7 (87 -> 94) -- `.inv-rows` (déplacé
  // de combat-modals.css) + `.inv-item-nested`/`.inv-actionbar`/`.inv-skin`/`.inv-skin-body`/
  // `.inv-skin-remove`/`.inv-nested` (déplacé aussi) : la rangée-plaque élue déplie sa barre
  // d'actions EN PLACE, contrepartie ASSUMÉE des -12 de combat-modals.css.
  // Fix visuel (registre Possessions rétréci à son contenu vs jumeau État pleine largeur) : +1
  // (94 -> 95) -- `.inv-item` devient flex-column (même mécanisme d'étirement que `creator-band`
  // en État : la `PlaqueRow`/bouton n'est stretch que si elle est enfant direct d'un flex/grid).
  // Lot « corps-index » (#492, arbitrage 2026-07-17) : -1 (95 -> 94) -- purge de la plaque ENC.
  // (`.stat-chip.enc-over`, seule occurrence dans ce module) : la plaque MEURT sans remplaçant
  // (amendement en vol — l'Encombrement rejoint une barre de la colonne au geste suivant).
  // Geste « colonne au croquis » (2026-07-17) : +4 (94 -> 98) -- `VitalArc` MEURT (-1, `.vital-arc`
  // purgé de `.sheet-portrait .vital-arc svg`) ; la colonne compose désormais `NotchGauge` (Blessures
  // + Encombrement, jauge PARTAGÉE Coque/Moral/Soute) via `.sheet-portrait .notch-gauge` (+1) et les
  // rangées race/classe/statut via `.sheet-idrows`/`.sheet-idrow`/`.sheet-idrow-label`/`.sheet-idrow-
  // value` (+4), aucune classe neuve pour la jauge elle-même (SOURCE UNIQUE `gauges.css`).
  // Compteurs de DESTIN (pt.4, #492, arbitrage 2026-07-17) : +1 (98 → 99) — `.etat-threshold`
  // (« actives N/BE », « phys N/BE · ment M/BFM »), ton par palier en attribut `data-tone`.
  // Fix de composition (2026-07-17) : -1 (99 → 98) — `.etat-threshold` MEURT, les compteurs
  // composent désormais `NotchGauge` (primitive crantée, `gauges.css`), aucune classe ici.
  // Lot « chevet » — grammaire de carte + bande DESTIN (#492, 2026-07-17) : +6 (98 → 104) — noms CITÉS
  // dans ce module par les nouveaux sélecteurs DESCENDANTS/scopés (aucune n'y est DÉFINIE en propre,
  // le compte est par nom cité, pas par règle) : `.sheet-etat`/`.plaque-value` (valeur discrète du
  // registre, « ces textes énormes en gras, pourquoi ? »), `.etat-destin-row`/`.notch-gauge` (bande de
  // synthèse Destin), `.life-bar__label`/`.life-bar__value` (discipline d'alignement gauche/droite de
  // la colonne, patron `.sheet-idrow*` déjà tenu ici).
  // LOT L addendum pt.5 (durci, 2026-07-17) : -1 (104 → 103) — `.plaque-value` (valeur discrète)
  // MIGRE dans la primitive (`plaque-row.css`, variante `[data-value-muted]`) et ne se cite plus ICI.
  // Fix d'alignement de la bande Seuils (juge vision, 2026-07-17) : -1 (103 → 102) — `.etat-destin-row`
  // MEURT (règle purgée, cf. FLEX_WRAP_BASELINE ci-dessus) : les 3 jauges composent `.notch-gauge-stack`
  // (gauges.css, à côté de la primitive `NotchGauge`) au lieu d'un scope local à cet écran.
  // Fusion vague-2 + fiche : 106 (précédent fusionné) - 2 (LOT L+M) = 104.
  // Tableau de bord État (arbitrage user 2026-07-17) : +2 (`.reserves-seuils-grid` grille 2 colonnes
  // de la bande « Réserves & seuils », `.etat-chips` rangée de chips codex-liées qui s'enroule —
  // `.plaque-fx` scopé `.plaque-name >` dans `PlaqueRow`, non composable ici) ; -3 (`.etat-ras`/
  // `.ras-title`/`.ras-sub`, ancien état RAS mort). `.etat-buff`/`.etat-chip-clock` envisagées puis
  // ÉVITÉES (décrue avant hausse) : le ton de buff réutilise `.chip.tone-ok` (variante ajoutée à la
  // famille `.tone-warn`/`.tone-danger`, components.css) et le cumul/durée inline réutilise
  // `.entity-badge` (badge discret de fin de chip, déjà partagé par `EntityChip`, base.css) — zéro
  // classe neuve pour les deux. Net 104 → 104 (inchangé).
  // Renommage du titre AFFICHÉ de la bande de capacité (arbitrage user 2026-07-18, ancien titre
  // rejeté) : classe de grille renommée en écho — `.reserves-seuils-grid` (même sélecteur, nom
  // aligné). Net 104 → 104 (renommage, pas d'ajout).
  // #762 : `.inv-item-head` — tête de ligne du Registre des Possessions (plaque cliquable de gestion
  // + son lien Codex SIBLING, jamais imbriqué). Net 104 → 105.
  // #990 : `.masked` — ÉTAT de la primitive `RollLine` (jet figé caché jusqu'à la réponse), aux côtés
  // de `.ok`/`.fail`/`.pending` : liseré 3px neutre + empreintes réservées des colonnes dé/DR (la
  // révélation ne déplace rien). Classe de PRIMITIVE, jamais d'écran — aucun site ne la pose. 105 → 106.
  // #1072 : `.rm-roll-diff` — la Difficulté du Test sur la LIGNE (texte + valeur), classe de la
  // PRIMITIVE `RollLine`. MIGRATION, pas un ajout net : `.interlude-hint` (world-meta.css, 134 → 133)
  // meurt en regard — la Difficulté ne se peint plus écran par écran. 106 → 107.
  // #1078 LOT B1 : net NUL (107 → 107) — `.recap-line` est CITÉE ici (`.rm-journal .recap-line`,
  // aucune définition propre : l'issue d'un jet est une donnée rendue par le renderer UNIQUE dans le
  // cadre que ce module possède déjà) ; `.jr-line` n'est plus citée — aucune modale ne compose plus
  // le markup du journal, sa gouttière se reprend en sélecteur d'ÉLÉMENT (`.recap-line > svg`).
  // Finition B1 : +1 (107 → 108) — `.rm-await` (zone d'ATTENTE d'un verdict suspendu à une fenêtre
  // qui va s'interposer, #1004) : rôle distinct de l'issue, donc classe propre aux mêmes tokens de
  // bloc, jamais la note de pied `.rm-log`.
  'styles/sheet.css': 108,
  // #492 Lot 1b : écran-catalogue des scénarios de test, sa propre maison (extrait de sheet.css).
  'styles/test-scenarios.css': 9,
  'styles/tavern.css': 13,
  // +1 (#942 L7, verdict vision) : `.interlude-phase-actions .hint` — la raison d'un CTA fermé se pose
  // AU-DESSUS du bouton (il changeait d'ancrage entre gaté et actif). Aucune contre-règle de voile
  // ici : l'allègement est descendu dans son domaine (combat-modals.css), le voile plein redevient
  // le défaut partagé.
  // #1072 : -1 (134 → 133) — `.interlude-hint` mort, la Difficulté est rendue par `RollLine`.
  'styles/world-meta.css': 133,
  'styles/city-hub.css': 18,
  'styles/voyage.css': 30,
  // Galerie design system DEV (#412) — layout d'écran seul (les spécimens composent le canon).
  'styles/gallery.css': 17,
  // Rose des forces (#409) — `.rose`/`.rose text`/`.rose-corner` (`.rose-corner.sm .rose` réutilise
  // le sélecteur `.rose` déjà compté, dédoublonné par module).
  'styles/rose.css': 3,
  // Cadre-figurine UNIQUE (FigTile, #430) — `.fig-tile`/`-name`/`-sub`/`-seal`/`.sel`/`.charprev`
  // (descendant `.fig-tile-fig > .charprev`, dédoublonné) — module primitive dédiée, MÊME patron que
  // rose.css/hero-sheet.css.
  // Consolidation #431 (LOT « la tuile, aux valeurs ») : +1 (7 → 8) — le doublon `.fig-tile*` de
  // creator.css est PURGÉ (phase 2 de #430, jamais faite : deux peaux se disputaient la primitive
  // par cascade — ce que frames.css redéclarait gagnait, ce qu'il ignorait survivait), ce module
  // devient la SEULE définition. `.fig-tile-legend` (bandeau superposé) meurt au profit de
  // `.fig-tile-fig` (boîte-figurine à hauteur FIXE, patron `.fam-tile` de la planche) et de la
  // variante par PROP `.big` (172px pleine zone vs 104 compacte) — l'appelant choisit une taille,
  // jamais une classe par écran. Contrepartie : creator.css paie -2 en regard.
  // #492 lot « colonne présence » (arbitrage user 2026-07-17, rig grand format) : +1 (8 -> 9) --
  // `.fig-tile.hero` (boite-figurine PLEINE FORME 320px, presence STATIQUE de l'aside de la fiche)
  // rejoint `.big`/`.compact` comme 3e variante de taille de la MEME primitive.
  // Lot « corps-index » (#492, arbitrage 2026-07-17) : +2 (9 -> 11) -- `.fig-zone-badges`/
  // `.fig-zone-badge` (badges ANCRÉS par Localisation, position en attribut `data-loc`, ton en
  // `data-tone` — jamais une classe par zone/ton, patron déjà tenu par sheet.css/NotchGauge).
  'styles/frames.css': 11,
  // Corps de fiche héros (HeroSheet.tsx, #417 suite) — bande d'en-tête + dérivées 2 colonnes,
  // SOURCE UNIQUE partagée par la fiche vivante du créateur et le détail candidat.
  // Lot P3 final (retouches juge vision) : +1 — `.chip-roadmap` (chips prospectives par rubrique).
  // Onglet Compétences & Talents composant `HeroSheet` (`skillsVariant='valeurs'`, arbitrage 2026-07-17) : +5 —
  // `.skill-grid`/`.skill-line`/`.sk-name`/`.sk-val`/`.sk-adv` migrés depuis combat-modals.css (leur
  // rendu vit dans la primitive, contrepartie ASSUMÉE en regard).
  'styles/hero-sheet.css': 12,
  // Ossature 2 zones du créateur (CreatorStepFrame, lot « ossature enforcée » #393) — slots
  // `.creator-step-(action|choice|desc)` + dés DORÉS planche (`.rm-die-*` scopés au gabarit et aux
  // plateaux `.dicewell-tray`) ; le layout `.creator-step` vit dans creator.css (renommage 1:1).
  // Consécration StepHeader (#393 amendement 3, clôture étape 7) : +3 (8 → 11) — l'en-tête de pas
  // rejoint le module de SA primitive (`.step-head`/`-title`, + le bornage `.dicewell` de la topbar,
  // classe déjà définie en creator.css : le compte est par-module) ; creator.css paie -3 en regard.
  // +1 (11 → 12) : `.btn-step` — la MANIVELLE laiton de la planche (`.crank button`) reteint la
  // primitive PARTAGÉE `QtyStepper` DANS le gabarit d'étape, MÊME idiome que les dés dorés
  // (`.rm-die-*`) déjà scopés ici : la peau marchande (`--panel2` en aplat, components.css) reste le
  // canon de la table de négoce, aucun fork du composant. Lot « matières & proportions » #393.
  // -4 (2026-07-16, #496) : `.rm-die-gem`/`.rm-die-num`/`.rm-die-rolling` (scopes `.creator-step`/
  // `.dicewell-tray`) purgés — la matière DORÉE des dés est maintenant la prop `tone="gold"` de
  // `DieFace`/`DiceRoll` (modificateur `.rm-die-gold`, SOURCE UNIQUE combat-modals.css).
  'styles/creator-step.css': 8,
  // Mise en scène FINALE du créateur (`PresentationScreen`, migration étape 8 du lot ossature) —
  // l'étape EXEMPTÉE du gabarit 2 zones (user 2026-07-15 : « sauf sur le dernier écran ») porte son
  // style dans SON module, jamais dans creator.css (amendement 2 : décrue nette exigée). Valeurs de
  // `planche-creator-FINALE.html` § « Écran final » : `.fin-col` (registre), `.fin-stage` (la scène),
  // `.c-lamp` (la lampe), `.c-main` (gabarit). Contrepartie ASSUMÉE des -9 de creator.css.
  'styles/creator-presentation.css': 8,
  // Coquille « Atelier du scribe » du créateur (lot « matières & proportions » #393) — `.dirC` de la
  // planche FINALE : le SOL de l'écran, que `.screen` (base.css) ne pose pas et que le radial
  // générique du `body` tenait à sa place (mesuré : #1f180f → #100e0b, plus clair et plus froid).
  // Module DÉDIÉ et non creator.css (cliquet gelé à 107) ni la couche partagée (cliquet xiii —
  // `.screen.creator` est mono-consommateur, donc du DOMAINE) : idiome `.screen.codex` de
  // compendium.css. 2 = les deux noms du sélecteur composé `.screen.creator`.
  'styles/creator-shell.css': 2,
  // Rangée-plaque à rivets d'or (PlaqueRow/PlaqueGrid, #393 amendement 3) — matière `.c-plate` +
  // états `.ck-cell` de la planche FINALE, module primitive dédiée (patron rose.css/frames.css) :
  // `.plaque-(row|grid|prefix|name|meta|value)`, états `.sel`/`.rolling`, dés compacts ET dorés
  // scopés à la méta (`.rm-die`/`-num`/`-gem`/`-rolling` — la plaque rend or où qu'elle soit
  // montée, galerie comprise ; la gemme rouge de combat-modals.css reste le canon du combat).
  // Migration étape 7 (details, même lot) : +1 (12 → 13) — `.plaque-label` : la colonne de libellé
  // gravée de la planche (`.idf .lb`, 92px small-caps) rejoint la primitive, contrepartie ASSUMÉE
  // des -5 de creator.css (mécanisme voulu par l'amendement 3 : « les classes par-étape meurent
  // dans les primitives ») — la plaque ÉDITABLE (`.idf .vl` : trait pointillé) et la plaque
  // CLIQUABLE n'ont, elles, coûté aucune classe (sélecteurs d'élément `.plaque-name > input` /
  // `button.plaque-row`).
  // -2 (2026-07-16, #496) : `.rm-die-gem`/`.rm-die-rolling` (scope `.plaque-meta`) purgés — même
  // bascule que creator-step.css vers le modificateur `.rm-die-gold` de combat-modals.css.
  // +1 (lot « chevet », #492) : `.plaque-fx` — bloc de chips d'effet net SOUS le nom (registre État),
  // additif à `meta` (qui reste latérale pour les autres écrans, ex. badges Possessions).
  'styles/plaque-row.css': 12,
  // Bande titrée (`Band`, extraite du créateur #492 Lot 1c) — module primitive dédiée (patron
  // rose.css/frames.css) : `.creator-band(-head|-right)` + les descendants `.hint`/`.notch-gauge`
  // (jauge du tirage, complète la primitive `NotchGauge` sans fork).
  // +1 (LOT L, 2026-07-17) : `.creator-band-title-link` — reset du bouton-titre CLIQUABLE
  // (`onTitleClick`, registre État → catégorie Compendium), posé UNE fois dans la primitive.
  // +1 (juge vision, 2026-07-17) : `.creator-band-title-affordance` — glyphe d'affordance codex
  // (discret au repos, plein contraste au survol/focus), posé UNE fois dans la primitive.
  'styles/band.css': 7,
  // Astrolabe de la roue céleste (`CelestialWheel`, migration étape 4 du lot ossature) : les MATIÈRES
  // du cadran aux valeurs du `svg` « 4 — Signe astral » de la planche FINALE. 14 pour 3 qui vivaient
  // dans creator.css : contrepartie ASSUMÉE de la fidélité (l'ancienne roue était un croquis à deux
  // anneaux — pas d'aiguille, pas de rayons gravés, pas de bornes d100, pas de moyeu), tenue au plus
  // court par mutualisation — un SEUL filet laiton (`.cw-ring-fine`) pour l'anneau intérieur, l'anneau
  // pointillé (dash en attribut) et le liseré du moyeu ; les deux `<stop>` de la gemme portent leur
  // `stop-color` en attribut `var(--…)` ; la note du moyeu et l'invite du cadran vide partagent
  // `.cw-hub-note`. Le reste est un nœud = une matière, sans descendant décoratif.
  'styles/celestial-wheel.css': 14,
};

// ── (xiii) FUITE DE DOMAINE dans la COUCHE PARTAGÉE (#371) : le cliquet (xii) ne scanne que les modules
//    de DOMAINE — `base.css`/`components.css` (couche atomique partagée) en sont EXCLUS. C'était le trou :
//    44 classes `.party-*`/`.candidate-*`/`.seat-*` s'étaient planquées dans base.css pour échapper au gel
//    (feedback user 2026-07-13 « elle réinvente la roue, on a des guards mais elle passe à travers »). Une
//    classe de la couche partagée n'est LÉGITIME que si elle est VRAIMENT partagée : soit DOCUMENTÉE au
//    catalogue de `docs/charte-ui.md` (contrat de couche atomique — inclut les primitives React qui posent
//    leurs classes), soit UTILISÉE par ≥2 modules `.tsx` distincts (usage transversal réel). Une classe
//    définie là, mono-consommateur ET non cataloguée = du DOMAINE déguisé → elle doit vivre dans un module
//    de domaine (cliqueté par xii). BASELINE par fichier, GELÉE et DÉCROISSANTE : sortir une famille de
//    domaine (ex. `.city-hub-*`/`.voyage-*` → leur module) ABAISSE la baseline ; en ajouter une la fait
//    monter → échec. Mesure STRUCTURELLE (pas une liste de noms) — la baseline est un COMPTE, pas un
//    allowlist nominatif. L'usage TSX se lit dans les valeurs `className` (littéraux, gabarits, ternaires).
// Couche PARTAGÉE gardée par xiii (chemins relatifs à `src/ui/`) : la couche atomique
// (`base`/`components`), la primitive d'onglets `tabs`, et l'orchestrateur d'`@import` `styles.css`
// (top-level) qui porte aussi les règles TRANSVERSES manette + le bandeau DEV du collecteur d'erreurs.
const SHARED_CSS_FILES = ['styles/base.css', 'styles/components.css', 'styles/tabs.css', 'styles.css'];
const SHARED_LEAK_BASELINE: Record<string, number> = {
  'styles/base.css': 16, // #417 : `.hero-present-sec` reste croisée (PartyScreen+HeroPresentation) ; `.lore-chip`/
  // `.hero-present-chips` repassent mono-consommateur — le détail candidat compose désormais `SkillChip`/
  // `TalentChip`/`EntityRef` + `.skill-tags` (recalage utilisateur 2026-07-14, primitives de fiche vivante)
  // #839 : INCHANGÉ à 11 — le partage de l'écran Options déplace deux fuites sans en retirer :
  // `.game-menu-overlay` devient transversal (GameMenu + OptionsScreen, −1) mais `.menu-sub-body`
  // redevient mono-consommateur (le corps à onglets n'a qu'un porteur, `OptionsScreen`, +1).
  'styles/components.css': 11,
  'styles/tabs.css': 1,
  'styles.css': 6,
};

/** Classes `.foo` citées entre backticks dans le catalogue de la charte (contrat de couche atomique). */
function catalogueClasses(): Set<string> {
  const doc = readFileSync(fileURLToPath(new URL('../../docs/charte-ui.md', import.meta.url)), 'utf8');
  const names = new Set<string>();
  for (const m of doc.matchAll(/`([^`]*)`/g)) {
    for (const c of m[1].match(/\.[a-zA-Z_-][\w-]*/g) ?? []) names.add(c.slice(1));
  }
  return names;
}

/** class → nombre de modules `.tsx` distincts qui la citent dans une valeur `className` (littéral,
 *  gabarit, ternaire — on collecte les tokens des sous-chaînes quotées de l'attribut). */
function classUsageByModule(): Map<string, Set<string>> {
  const uses = new Map<string, Set<string>>();
  const files = walk(fileURLToPath(new URL('../', import.meta.url)), (e) => /\.tsx$/.test(e) && !/\.test\./.test(e));
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const re = /className\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*'|`[^`]*`)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      for (const seg of m[1].matchAll(/(["'`])([^"'`]*)\1/g)) {
        for (const tok of seg[2].split(/\s+/)) {
          if (/^[a-zA-Z][\w-]*$/.test(tok)) (uses.get(tok) ?? uses.set(tok, new Set()).get(tok)!).add(f);
        }
      }
    }
  }
  return uses;
}

function classNamesDefined(css: string): Set<string> {
  const names = new Set<string>();
  let buf = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const sel = buf.trim();
      if (sel && !sel.startsWith('@')) {
        const matches = sel.match(/\.[a-zA-Z_-][\w-]*/g) || [];
        for (const m of matches) names.add(m.slice(1));
      }
      buf = '';
    } else if (c === '}') {
      buf = '';
    } else {
      buf += c;
    }
  }
  return names;
}

function scanBareButtons(files: string[]) {
  const bare: Record<string, number> = {};
  const opaque: Record<string, number> = {};
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    // Neutralise les commentaires bloc `/* ... */` (dont JSDoc/`{/* JSX */}`) et ligne `//…` avant le
    // scan — un `<button>` cité en prose ne doit pas polluer le compte.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
    const re = /<button\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // Fin de la balise ouvrante = premier `>` hors accolades (les expressions `{…}` d'attribut
      // peuvent contenir des `>` de comparaison/générique).
      let depth = 0;
      let tagEnd = -1;
      for (let i = m.index; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) { tagEnd = i; break; }
      }
      if (tagEnd === -1) continue;
      const tag = src.slice(m.index, tagEnd + 1);
      const cls = tag.match(/className\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*'|`[^`]*`)/);
      const r = rel(f);
      if (!cls) {
        bare[r] = (bare[r] ?? 0) + 1;
        continue;
      }
      const clsVal = cls[1];
      if (BARE_BUTTON_CANON.test(clsVal)) continue; // conforme (littéral btn/chip/seg présent)
      if (!/["'`]/.test(clsVal)) {
        opaque[r] = (opaque[r] ?? 0) + 1; // expression opaque, catégorisée à part — pas un échec aveugle
        continue;
      }
      bare[r] = (bare[r] ?? 0) + 1;
    }
  }
  return { bare, opaque };
}

// ── (xv) Rangées TÉMOINS (`interactive:false`) porteuses d'une VALEUR inline (`d:`/`pending:`) hors
//    du builder `opposedFrozen.ts` (#990) : toute rangée qui affiche le jet FIGÉ d'un adversaire doit
//    passer par le calendrier de découverte UNIQUE (`frozenOpposedRow`) — sinon un site ré-affiche un
//    jet masqué ailleurs. Le stock recensé au #990 est gelé et décroissant.
//    COUVERTURE du détecteur (à énoncer, pas à supposer) : il ne voit que les littéraux de rangée
//    portant la valeur EN PLACE (`d:`/`d,`/`pending:`) ; une rangée assemblée depuis une variable
//    (`row: r` de `witnessRows`, `row: pr`) lui échappe. Commentaires exclus du scan.
//    Chaque entrée restante est un témoin dont le jet ne PEUT PAS précéder la réponse (construit
//    `rolled &&`, ou jet du même acteur) : rien à masquer. Les jets figés À L'OUVERTURE (Empoignade,
//    Au Contact, Distraire, Désengagement) sont passés au builder au #990 — d'où 12 → 8.
const FROZEN_WITNESS_BASELINE: Record<string, number> = {
  // 2ᵉ Compétence du MÊME acteur (Test combiné) + « Puissance » ennemie construite `rolled &&` (l.93).
  'ActivityModal.tsx': 2,
  'BargainModal.tsx': 1,           // Marchandage du marchand : jet tiré à la résolution (ligne opaque, `mask:'value'`)
  'CascadeModal.tsx': 1,           // rangée-participant FIGÉE d'un pas batch DÉJÀ validé (pile des étapes)
  'jetProps/useAttackJetProps.tsx': 2, // défense adverse : aperçu SANS valeur (pré-jet) + résultat post-jet
  'MultiRollList.tsx': 1,          // bilan de jets déjà résolus
  // Vue PURE (sans store, donc sans calendrier possible) ET rangée construite `rolled && sr.opposed`
  // (l.64) : le jet de la source n'existe qu'après la réponse de l'acteur.
  'StateRecoveryModal.tsx': 1,
};

/** Portée d'une occurrence : le littéral `{…}` englobant (forme objet) ou la balise JSX (forme `={false}`). */
function rowScope(src: string, idx: number, jsx: boolean): string {
  if (jsx) {
    const start = src.lastIndexOf('<', idx);
    const end = src.indexOf('>', idx);
    return src.slice(start < 0 ? 0 : start, end < 0 ? src.length : end);
  }
  let depth = 0;
  let i = idx;
  for (; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') { if (depth === 0) break; depth--; }
  }
  const open = Math.max(0, i);
  depth = 0;
  let j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(open, j + 1);
}

function scanFrozenValueRows(files: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const re = /interactive(:\s*|=\{)false/g;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(src))) {
      if (/\bd\s*[,:]|\bpending\s*[,:]/.test(rowScope(src, m.index, m[1] === '={'))) n++;
    }
    if (n > 0) counts[rel(f)] = n;
  }
  return counts;
}

describe('#236 — cliquets d’hygiène UI', () => {
  it('(iv) hex hors tokens : aucune hausse par module CSS (base.css exclu)', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'base.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      // Commentaires exclus du scan : un « #304 » de réf de ticket n'est pas une couleur.
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, HEX_BASELINE, 'hex hors tokens');
  });

  it('(v) prix ⇒ <Coins> : aucune composition manuelle de monnaie (fail-closed, exemptions PA nominatives)', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e))
      .filter((f) => !f.endsWith('Coins.tsx'))
      .filter((f) => !PRICE_PA_ARMOR_EXEMPT.has(rel(f)));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/\}[^<>{}]{0,4} (?:CO|PA|CA)\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PRICE_BASELINE, 'prix sans <Coins>');
  });

  it('(vii) flex-wrap: wrap hors components.css : aucune hausse par module CSS', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'components.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/flex-wrap:\s*wrap/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FLEX_WRAP_BASELINE, 'flex-wrap hors components.css');
  });

  it('(viii) fill/stroke littéraux hors token var(--…) : aucune hausse par fichier .tsx', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/(?:fill|stroke)=("|')(?:#|rgb|hsl)/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FILL_LITERAL_BASELINE, 'fill/stroke littéral hors token');
  });

  it('(ix) .panel non redéfini hors components.css (#306)', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'components.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // `.panel` porté par le MÊME élément : soit en TÊTE de sélecteur (`^\s*\.panel`, capture aussi les
      // redéfinitions indentées d'un `@media` — le piège #306), soit COMPOSÉ à une autre classe (`X.panel`,
      // ex. `.interlude-hero.panel` — l'angle mort de l'ancre seule). Les modificateurs du même élément
      // (`.mod`/`:pseudo`/`[attr]`) sont tolérés jusqu'à la FIN du sélecteur (`\s*[,{]`) ; les descendants
      // (`.panel h3`, `.panel-grid > .panel`) et la classe distincte `.panel-grid` (suivi de `-`) sont exclus.
      const n = (css.match(/(?:^\s*|[a-z0-9-])\.panel(?:[.:][\w-]+|\[[^\]]*\])*\s*[,{]/gm) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PANEL_REDEFINE_BASELINE, '.panel redéfini hors components.css');
  });

  it('(x) <button> nu : aucune hausse par fichier .tsx (composer .btn/.chip ou une primitive — feedback user 2026-07-12, #373)', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e)).filter(
      (f) => !BARE_BUTTON_EXEMPT_FILES.has(rel(f)),
    );
    const { bare, opaque } = scanBareButtons(files);
    assertRatchet(bare, BARE_BUTTON_BASELINE, '<button> nu — composer .btn/.chip ou une primitive (feedback user 2026-07-12, #373)');
    assertRatchet(opaque, BARE_BUTTON_OPAQUE_BASELINE, '<button> className opaque — exposer un littéral btn/chip/seg ou passer par une primitive (feedback user 2026-07-12, #373)');
  });

  it('(xii) sélecteurs de classe DÉFINIS par module CSS de domaine : gelé et décroissant (doctrine user 2026-07-12, #373)', () => {
    const counts: Record<string, number> = {};
    for (const mod of DOMAIN_CSS_MODULES) {
      const f = join(UI, 'styles', `${mod}.css`);
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      counts[rel(f)] = classNamesDefined(css).size;
    }
    assertRatchet(counts, CLASS_SELECTOR_BASELINE, 'sélecteurs de classe définis (stock de classes de domaine, #373)');
  });

  it('(xiii) fuite de domaine en couche partagée : classe base/components mono-consommateur ET non cataloguée = gelée et décroissante (#371)', () => {
    const catalogue = catalogueClasses();
    const usage = classUsageByModule();
    const counts: Record<string, number> = {};
    for (const file of SHARED_CSS_FILES) {
      const f = join(UI, file);
      const defined = classNamesDefined(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
      let leaks = 0;
      for (const c of defined) {
        if (catalogue.has(c)) continue; // documentée au catalogue = contrat de couche atomique
        if ((usage.get(c)?.size ?? 0) >= 2) continue; // usage transversal réel (≥2 modules)
        leaks++;
      }
      counts[rel(f)] = leaks;
    }
    assertRatchet(counts, SHARED_LEAK_BASELINE, 'classe de domaine planquée en couche partagée — la déplacer dans un module de domaine (cliqueté par xii) ou la documenter au catalogue de charte-ui.md (#371)');
  });

  // ── (xiv) EXHAUSTIVITÉ (#371, gap gauges.css) : les cliquets xii (domaine) et xiii (partagé) ne
  //    valent QUE pour les fichiers listés — un module CSS oublié (ex. `gauges.css`, ~40 classes de
  //    domaine naval) échappait aux DEUX en silence. Ce test STRUCTUREL refuse tout `.css` de
  //    `src/ui/**` non couvert : il doit appartenir soit à `DOMAIN_CSS_MODULES` (xii, `styles/<mod>.css`)
  //    soit à `SHARED_CSS_FILES` (xiii). Ajouter un module CSS force donc à le classer et à poser sa
  //    baseline — plus de fichier hors radar.
  it('(xiv) exhaustivité : chaque .css de src/ui est couvert par xii (domaine) OU xiii (partagé)', () => {
    const all = walk(UI, (e) => e.endsWith('.css')).map(rel);
    const accounted = new Set<string>([...DOMAIN_CSS_MODULES.map((m) => `styles/${m}.css`), ...SHARED_CSS_FILES]);
    const orphans = all.filter((f) => !accounted.has(f)).sort();
    expect(orphans, `CSS hors radar (ni cliquet de domaine xii, ni garde partagée xiii) — l’ajouter à DOMAIN_CSS_MODULES ou SHARED_CSS_FILES :\n${orphans.join('\n')}`).toEqual([]);
  });

  it('(xv) rangée TÉMOIN porteuse de valeur hors `opposedFrozen.ts` : gelée et décroissante (#990)', () => {
    const files = walk(UI, (e) => /\.tsx?$/.test(e) && !/\.test\./.test(e)).filter((f) => rel(f) !== 'opposedFrozen.ts');
    assertRatchet(scanFrozenValueRows(files), FROZEN_WITNESS_BASELINE, 'rangée témoin à valeur figée hors du calendrier de découverte `frozenOpposedRow` (#990)');
  });
});
