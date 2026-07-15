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
]);
const PRICE_BASELINE: Record<string, number> = {};

// ── (vii) `flex-wrap: wrap` hors `components.css` : le motif « rangée qui s'enroule » vit dans
//    `.bar`/primitives partagées de `components.css` (§charte-ui). Un `flex-wrap` codé en dur dans un
//    AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  'styles/base.css': 4,
  'styles/codex-edit.css': 1,
  'styles/combat-modals.css': 7,
  'styles/combat-ui.css': 7,
  'styles/compendium.css': 3,
  // +1 : `.creator-race-lineages` (#393 P2, correction structurelle Race) — rangée de chips de
  // lignée en tête du détail, s'enroule (motif `.bar` non composable ici, boutons de largeur variable).
  'styles/creator.css': 8,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  'styles/hud.css': 6,
  'styles/mass-battle.css': 2,
  'styles/merchant.css': 1,
  'styles/sheet.css': 2,
  'styles/world-meta.css': 18,
  'styles/city-hub.css': 1,
  'styles/voyage.css': 3,
};

// ── (viii) Couleurs `fill=`/`stroke=` LITTÉRALES dans le JSX de `src/ui` : un fill/stroke codé en dur
//    (hex/rgb/hsl) hors token `var(--…)` est de la dette — hors thème, illisible quand la surface change
//    de fond (bug « texte noir sur noir » du hub de voyage, user 2026-07-11). BASELINE = surfaces d'ART /
//    de CARTE existantes (aperçu de personnage, canevas de l'éditeur, carte du monde parcheminée) gelées
//    nominativement ; tout NOUVEAU .tsx reste à ZÉRO. Les defs d'art de `gameIso` sont hors périmètre
//    (scan borné aux `.tsx` de `src/ui`). `fill="none"`/`url(#…)`/`currentColor` ne sont pas des littéraux.
const FILL_LITERAL_BASELINE: Record<string, number> = {
  'AppearancePanel.tsx': 1,
  'EquipmentPanel.tsx': 1,
  'editor/EditorCanvas.tsx': 9,
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
]);
// `dicewell` : bouton-encrier canon de `CreatorDice` (#414, langage `.c-dicewell.act` du kit
// « Atelier du scribe ») — même famille que `.btn`/`.chip`, sa propre classe de composant.
// `cc-step` : médaillon-bouton canon de `CareerPath` (#393 P2, 2026-07-14) — même famille, chaîne
// explorable propre (langage `.cc-path`/`.cc-link`, pas un `.chip`/`.seg` recyclé).
const BARE_BUTTON_CANON = /\b(btn|chip|seg|dicewell|cc-step)\b/;
const BARE_BUTTON_BASELINE: Record<string, number> = {
  'ActionBar.tsx': 1,
  'CityHubScreen.tsx': 1,
  'compendium/CompendiumScreen.tsx': 1,
  'editor/DialogueDetail.tsx': 1,
  'editor/EditorToolbar.tsx': 1,
  'editor/EffectList.tsx': 1,
  'editor/FlowEditor.tsx': 3,
  'editor/GameOpEditor.tsx': 1,
  'editor/Inspector.tsx': 5,
  'editor/LogicDock.tsx': 4,
  'editor/Palette.tsx': 7,
  'editor/StatblockEditor.tsx': 2,
  'ErrorCollectorBanner.tsx': 1,
  'HouseRulesModal.tsx': 1,
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
];
const CLASS_SELECTOR_BASELINE: Record<string, number> = {
  'styles/codex-edit.css': 20,
  'styles/gauges.css': 27,
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
  'styles/combat-modals.css': 147,
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
  'styles/creator.css': 145,
  'styles/editor.css': 112,
  'styles/house-rules.css': 9,
  'styles/hud.css': 145,
  'styles/mass-battle.css': 29,
  'styles/merchant.css': 53,
  'styles/ornaments.css': 13,
  'styles/sheet.css': 91,
  'styles/tavern.css': 13,
  'styles/world-meta.css': 133,
  'styles/city-hub.css': 18,
  'styles/voyage.css': 30,
  // Galerie design system DEV (#412) — layout d'écran seul (les spécimens composent le canon).
  'styles/gallery.css': 17,
  // Rose des forces (#409) — `.rose`/`.rose text`/`.rose-corner` (`.rose-corner.sm .rose` réutilise
  // le sélecteur `.rose` déjà compté, dédoublonné par module).
  'styles/rose.css': 3,
  // Cadre-figurine UNIQUE (FigTile, #430) — `.fig-tile`/`-legend`/`-name`/`-sub`/`-seal`/`.sel`/`.charprev`
  // (descendant `.fig-tile > .charprev`, dédoublonné) — module primitive dédiée, MÊME patron que
  // rose.css/hero-sheet.css (creator.css hors périmètre agent, collision #430).
  'styles/frames.css': 7,
  // Corps de fiche héros (HeroSheet.tsx, #417 suite) — bande d'en-tête + dérivées 2 colonnes,
  // SOURCE UNIQUE partagée par la fiche vivante du créateur et le détail candidat.
  // Lot P3 final (retouches juge vision) : +1 — `.chip-roadmap` (chips prospectives par rubrique).
  'styles/hero-sheet.css': 7,
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
});
