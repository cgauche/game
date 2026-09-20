import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { FEUILLES_PARTAGEES, declarations, reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';
import { comparerPoids } from '../../scripts/guards/lib/cssConservation.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import {
  mesureCssCouches,
  modulesDEcran,
  modulesDePrimitive,
  sitesEspacementHorsEchelle,
  sitesIdentiteEcran,
  sitesStyleInline,
  type Fichier as FichierMesure,
} from '../../scripts/guards/lib/cssCouchesAudit';
import {
  CSS_ESPACEMENT_RATCHET,
  CSS_IDENTITE_ECRAN_RATCHET,
  STYLE_INLINE_RATCHET,
} from '../../scripts/guards/lib/cssCouchesStock.mjs';
import { cleDeSite, ecartDuVolet } from '../../scripts/guards/lib/stock.mjs';

/**
 * Cliquets d'hygiène UI (#236) — même patron que `combat-hardcode-guard`/`no-emoji-affordance` : une
 * BASELINE gèle, PAR FICHIER, la dette tolérée au recensement ; toute HAUSSE échoue (régression) et
 * toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE. On ne PURGE pas la dette
 * ici — on interdit sa croissance et on impose la décrue.
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

/** Un fichier du corpus tel que `readCorpus` le rend : chemin POSIX depuis la racine + texte. */
type Fichier = { rel: string; text: string };

/** Tout `src/ui`, tests compris — UNE clé de corpus pour les seize mesures de ce fichier ; chacune
 *  applique ENSUITE son propre périmètre (extension, exemption nominative), qui fait partie de ce
 *  qu'elle mesure. */
const FICHIERS_UI = (): readonly Fichier[] => readCorpus(['src/ui'], { exts: ['.css', '.ts', '.tsx'], tests: true });
/** Chemin depuis `src/ui/` — la clé des baselines et des exemptions. */
const rel = (f: Fichier) => f.rel.slice('src/ui/'.length);
const nomDe = (f: Fichier) => f.rel.slice(f.rel.lastIndexOf('/') + 1);
const estTest = (f: Fichier) => estFichierVitest(f.rel);
const estCss = (f: Fichier) => f.rel.endsWith('.css');
const estTsx = (f: Fichier) => f.rel.endsWith('.tsx');

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

// ── (vii) `flex-wrap: wrap` hors couche partagée : le motif « rangée qui s'enroule » vit dans `.bar`
//    (`components.css`) et dans `Row` (`layout.css`, qui s'enroule PAR CONSTRUCTION). Un `flex-wrap`
//    codé en dur dans un AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa
//    hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  // +1 : `.creator-band-right:has(.notch-gauge + .notch-gauge)` (registre État, `EtatPanel.tsx`) —
  // bande à DEUX jauges de quota (Mutations) collisionnant avec son titre dans la colonne bornée
  // `.sheet-main` (motif `.bar` non composable ici, c'est un slot droit de `Band`, pas un bandeau).
  'styles/band.css': 1,
  // -1 (#1834) : l'enroulement du titre de section suit `.panel h3` en couche PARTAGÉE
  // (`components.css`, hors cliquet) — une base et sa tranche dans la MÊME feuille.
  'styles/base.css': 3,
  // +1 (#1388 C4) : `.de-reflrow` (rangée dense de réfs de l'atelier Codex) s'enroule dès 360 px —
  // motif `.bar` non composable ici (c'est une rangée de CHAMPS d'un formulaire d'édition, pas un
  // bandeau d'écran) ; le `flex-wrap` seul ne suffisait pas, il va de pair avec `min-width: 0`.
  'styles/codex-edit.css': 2,
  // `.prow-act` a rejoint la couche partagée (hors cliquet) ; les six autres rangées enroulées de la
  // famille JET sont keyées aux modules de leurs primitives, en regard (#1806 2c).
  // -2 (#1806 2d) : `.fx-chips` suit sa primitive (`styles/fx-chip.css`, +1 en regard) ; `.derived`,
  // règle MORTE sans aucun poseur dans le dépôt, est supprimée — le TOTAL baisse de 1.
  // -2 (#1806 2d γ) : `.victory-rewards` et `.vl-assign` suivent leurs primitives
  // (`styles/reward-recap.css` et `styles/gear-assign-list.css`, +1 chacune en regard) — TOTAL stable.
  // -1 (#1806 2d γ2) : la rangée des vaincus compose `Row`, qui s'enroule PAR CONSTRUCTION —
  // `.victory-defeated` MEURT, rien en regard.
  'styles/combat-ui.css': 2,
  'styles/gear-assign-list.css': 1,
  'styles/reward-recap.css': 1,
  'styles/compendium.css': 3,
  // +1 : `.creator-race-lineages` (#393 P2, correction structurelle Race) — rangée de chips de
  // lignée en tête du détail, s'enroule (motif `.bar` non composable ici, boutons de largeur variable).
  // -2 : lot « ossature enforcée » (#393) — mort du bandeau fiche-vivante ≤1100px du rail 3 zones
  // (`.creator-shell > .creator-summary` et `.creator-derived` en rangée), l'empilement vit sur
  // le gabarit unique `.creator-step`.
  // -1 : purge du bloc MORT `.career-path` (superseded par CareerPath/`.cc-path`, 0 réf).
  // -1 (#1800) : mort de la redéfinition locale de la rangée qui s'enroule — le créateur compose `Row`.
  'styles/creator.css': 4,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  // -1 (R-M1, bande de groupe) : `.party-dock` ne s'enroule plus — une seule rangée qui DÉFILE à
  // tuiles pleines. Baisse ASSAINIE, pas une tolérance.
  // -1 (#1806 2c) : `.crit-stats` suit sa primitive `RevealBody`.
  // -3 (#1806 2a) : `.medic-patients` suit son écran (world-meta.css, +1 en regard) ; `.frame-row`
  // et le repeint `.modal-actions` ≤700 MEURENT — les quatre sites de rangée de tuiles composent
  // `Row`, et le pied d'une modale qui s'enroule est un comportement de la couche partagée.
  'styles/hud.css': 1,
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
  // -1 (#1806 2c) : `.rm-roll-mods` (rangée de chips d'une ligne de jet) suit sa primitive `RollLine`.
  'styles/sheet.css': 3,
  // -1 : le roster de postes porte sa matière dans `postes-roster.css`, la feuille de sa primitive.
  // +3 (#1806 2c) : `.ship-crew-row`, `.poste-layout`, `.poste-chips` — le PLACEMENT de l'écran de
  // navire vit au module de CET écran.
  // +1 (#1806 2a) : `.medic-patients` (bandeau de patients de l'infirmerie, qui s'enroule) a suivi
  // son écran depuis `hud.css` — même site, autre foyer, -3 en regard côté HUD.
  'styles/world-meta.css': 21,
  'styles/city-hub.css': 1,
  'styles/voyage.css': 3,
  // +1 (lot #492 « chevet ») : `.plaque-fx` (chips d'effet net sous le nom, `PlaqueRow.tsx`) — enroule
  // en rangée, motif `.bar` non composable ici (le `.bar` du canon porte fond/bordure/padding d'en-tête,
  // pas d'une puce compacte sous un titre de plaque).
  'styles/plaque-row.css': 1,
  // Famille JET (#1806 2c) : chaque rangée de contrôles/chips de largeurs variables s'enroule dès
  // 360px depuis le module de sa primitive — `.rm-roll-mods` (chips de modificateurs), `.rm-die-pick`
  // (options de dé + champ), `.crit-stats` (valeurs d'un Coup Critique), `.insp-badges` (badges de
  // camp/états), `.set-card-body` (carte de set d'armes). Une rangée de foule s'enroule par la
  // primitive de placement `Row` (`layout.css`), sans règle propre.
  'styles/roll-line.css': 1,
  'styles/forced-roll-picker.css': 1,
  'styles/reveal-body.css': 1,
  'styles/inspect-panel.css': 1,
  'styles/equipment-panel.css': 1,
  // +1 : `.pr-cases` (`PostesRoster`/`AssignRow`) — les portraits d'un poste s'enroulent quand ils
  // débordent de la colonne de cases ; motif `.bar` non composable ici (`.bar` porte fond/bordure/
  // padding d'une barre d'écran, pas d'une case DANS une rangée de grille).
  'styles/postes-roster.css': 1,
  // `.fx-chips` (#1806 2d) : la rangée de pastilles d'États s'enroule dès qu'elle déborde de son
  // rack — la même règle qu'avant, keyée au module de sa primitive.
  'styles/fx-chip.css': 1,
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
  // -1 (8 → 7) : baseline PÉRIMÉE constatée le 2026-08-14 (mesure `git show HEAD:…` = 7 avant comme
  // après le lot C5a du #1176, qui ne touche aucun `fill`/`stroke` de ce fichier) — le cliquet exige
  // l'abaissement d'une baseline devenue plus haute que le réel.
  'editor/EditorCanvas.tsx': 7,
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
//    `.grid > .panel`) — `.panel` n'y est pas compound sur le même élément, ils scopent sans remplacer
//    la surface — et toute classe distincte dont le nom commence par `.panel` (`.panel` suivi de `-`). La densité mobile du canon
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
  // MenuCard.tsx : primitive canon du bouton de MENU (`MenuButton`, table `docs/primitives.md`) — même famille
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
  // ListRow.tsx : primitive canon de la RANGÉE DE LISTE sélectionnable (`.listrow` et ses variantes
  // `data-variant`, #841/#1806) — même famille que Tabs/MenuCard/PlaqueRow. Elle existe justement
  // pour que plus aucun panneau ne recode la rangée : 13 sites de l'éditeur la composent désormais,
  // et l'ÉLECTION s'y dit `aria-current`, une seule grammaire pour tous.
  'ListRow.tsx',
]);
// `dicewell` : bouton-encrier canon de `CreatorDice` (#414, langage `.c-dicewell.act` du kit
// « Atelier du scribe ») — même famille que `.btn`/`.chip`, sa propre classe de composant.
// `cc-step` : médaillon-bouton canon de `CareerPath` (#393 P2, 2026-07-14) — même famille, chaîne
// explorable propre (langage `.cc-path`/`.cc-link`, pas un `.chip`/`.seg` recyclé).
const BARE_BUTTON_CANON = /\b(btn|chip|seg|dicewell|cc-step)\b/;
const BARE_BUTTON_BASELINE: Record<string, number> = {
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
  // #1135 : baseline abaissée (3 → 2), bouton nu retiré au commit 9bae13b3 — détecteur inchangé.
  'InitiativeStrip.tsx': 2,
  'MerchantPanel.tsx': 1,
  'ObjectiveBanner.tsx': 1,
  'VoyageScreen.tsx': 4,
};
// Baseline SÉPARÉE des `className` opaques (aucun littéral dedans) : au recensement, zéro site après
// exemption des primitives — tout `<button className={fn(...)}>` NOUVEAU doit désormais soit exposer un
// littéral `btn`/`chip`/`seg` dans son expression, soit vivre dans un fichier-primitive exempté ci-dessus.
const BARE_BUTTON_OPAQUE_BASELINE: Record<string, number> = {};


// ── (xiii) FUITE DE DOMAINE dans la COUCHE PARTAGÉE (#371) : la couche partagée est la SEULE que le
//    cliquet d'identité (xxi) ne juge pas — elle porte l'identité PAR CONSTRUCTION. C'était le trou :
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
// #1411 P2-C : `../gameIso/anim.css` entre au radar — c'est la feuille du CHROME DU MONDE (marques de
// jeton, pastille d'état de fin, pastille d'ENTITÉ), consommée par plusieurs modules de `gameIso`, et
// elle échappait aux DEUX cliquets (xii ne voit que `src/ui/styles/`, xiv ne parcourt que `src/ui`).
// Une classe qui s'y planquerait sans être partagée ni cataloguée compte donc désormais comme fuite.
const SHARED_CSS_FILES = [
  ...FEUILLES_PARTAGEES.map((f) => f.slice('src/ui/'.length)),
  'styles.css',
  '../gameIso/anim.css',
];
const SHARED_LEAK_BASELINE: Record<string, number> = {
  // #1372 : 16 → 15 — `.lazy-fallback` cesse d'être mono-consommateur (le voile d'entrée en scène du
  // monde volumique le REPREND au lieu de définir sa propre classe, `stage/VolumetricWorld.tsx`).
  // #1806 2c : 15 → 14 — `.codex-ref` (enveloppe du déclencheur de popover, `CodexRef`) entre au
  // catalogue de `charte-ui.md` : c'est un contrat de couche, pas une fuite de domaine.
  'styles/base.css': 14, // #417 : `.hero-present-sec` reste croisée (PartyScreen+HeroPresentation) ; `.lore-chip`/
  // `.hero-present-chips` repassent mono-consommateur — le détail candidat compose désormais `SkillChip`/
  // `TalentChip`/`EntityRef` + `.skill-tags` (recalage utilisateur 2026-07-14, primitives de fiche vivante)
  // #839 : INCHANGÉ à 11 — le partage de l'écran Options déplace deux fuites sans en retirer :
  // `.game-menu-overlay` devient transversal (GameMenu + OptionsScreen, −1) mais `.menu-sub-body`
  // redevient mono-consommateur (le corps à onglets n'a qu'un porteur, `OptionsScreen`, +1).
  // #1318 V10 (2026-08-16) : 11 → 10 — DÉCROISSANCE mesurée après la migration des recopies de markup
  // vers leurs primitives (garde `primitive-owners-guard`). Stock restant, mesuré : `alert`, `col-name`,
  // `col-stat`, `col-emph`, `col-enc`, `col-price`, `col-buy`, `detail-row`, `group-row`, `rm-roll`.
  // #1806 2c : 10 → 9 — `rm-roll` suit sa primitive `RollLine` (`roll-line.css`) ; la couche partagée
  // ne déclare plus de ligne de jet.
  'styles/components.css': 9,
  'styles/tabs.css': 1,
  // Couche LAYOUT (#1800) : TOLÉRANCE ZÉRO d'entrée — chacune de ses classes est cataloguée à la
  // charte (`.stack`/`.row`/`.grid`/`.split`/`.screen`/`.screen-body`/`.screen-scroll`/
  // `.master-detail-list`), aucune n'est mono-consommateur planqué.
  'styles/layout.css': 0,
  'styles.css': 6,
  // Chrome du MONDE : les classes y sont mono-consommateur PAR NATURE (un peintre unique par marque —
  // `TokenChromeMarks`, `PastilleEntite`, les animations de FX). Baseline posée à l'entrée au radar,
  // GELÉE et DÉCROISSANTE comme les autres.
  // #1806 2c : 26 → 22 — la feuille est celle de la primitive `GameStage` ; `.glow` et `.dmg-float`
  // sont cataloguées à la charte avec `.iso-stage`, et les règles à ZÉRO poseur (`.bob`, `.gush`,
  // `.crow` + `.crow .wing`) sont purgées (garde §5.2 de `primitive-owners-guard`).
  '../gameIso/anim.css': 22,
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
  for (const { rel: f, text: raw } of readCorpus(['src'], { exts: ['.tsx'] })) {
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

function scanBareButtons(files: readonly Fichier[]) {
  const bare: Record<string, number> = {};
  const opaque: Record<string, number> = {};
  for (const f of files) {
    const raw = f.text;
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
//    Au Contact, Distraire, Désengagement) sont passés au builder au #990 ; le Marchandage les a
//    rejoints au #1153 (sa rangée adverse existe désormais dès l'ouverture, masquée par le calendrier).
const FROZEN_WITNESS_BASELINE: Record<string, number> = {
  // 2ᵉ Compétence du MÊME acteur (Test combiné) ; la « Puissance » ennemie passe par `opposedLines`.
  'ActivityModal.tsx': 1,
  'CascadeModal.tsx': 1,           // rangée-participant FIGÉE d'un pas batch DÉJÀ validé (pile des étapes)
  'jetProps/useAttackJetProps.tsx': 2, // défense adverse : aperçu SANS valeur (pré-jet) + résultat post-jet
  'MultiRollList.tsx': 1,          // bilan de jets déjà résolus
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

/** Portée d'un APPEL : l'argument, de la parenthèse ouvrante (indice `open`) à sa fermante équilibrée. */
function callScope(src: string, open: number): string {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return src.slice(open);
}

/** Constructeurs de la porte `rollRowBuild.ts` (le montage y prend son 1ᵉʳ argument et ses EXTRAS au 2ᵉ). */
const PORTE_CTOR = /\b(buildRollRow|participantRow|tableRow|drawRow|worldRow|witnessRow|frozenOpposedRow)$/;

/** Appel de la PORTE englobant l'indice donné — sa portée est l'APPEL ENTIER (les deux arguments).
 *  Sans lui, `interactive:false` posé dans les EXTRAS (2ᵉ argument) se lirait seul, sans le `d:`/`pending:`
 *  resté au 1ᵉʳ : une rangée sortirait du radar en passant par la porte, sans que le stock ait bougé. */
function enclosingPorteCall(src: string, idx: number): string | null {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const c = src[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) return PORTE_CTOR.test(src.slice(Math.max(0, i - 32), i)) ? callScope(src, i) : null;
      depth--;
    }
  }
  return null;
}

function scanFrozenValueRows(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const src = f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Deux ÉCRITURES d'une rangée témoin, une seule population : le champ posé à la main
    // (`interactive:false`) et le constructeur `witnessRow(` de la porte (#1262), qui le pose pour
    // le site. Sans la seconde, la migration d'un site vers la porte VIDERAIT ce cliquet sans que
    // le stock réel (une valeur figée affichée hors calendrier) ait bougé d'une ligne.
    const re = /interactive(:\s*|=\{)false|witnessRow\(/g;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(src))) {
      // La portée d'un appel de constructeur est SON argument (jusqu'à la parenthèse équilibrée) —
      // pas le bloc englobant, qui ferait compter la ligne d'un voisin.
      const scope = m[0].startsWith('witnessRow')
        ? callScope(src, re.lastIndex - 1)
        : (enclosingPorteCall(src, m.index) ?? rowScope(src, m.index, m[1] === '={'));
      if (/\bd\s*[,:]|\bpending\s*[,:]/.test(scope)) n++;
    }
    if (n > 0) counts[rel(f)] = n;
  }
  return counts;
}

describe('#236 — cliquets d’hygiène UI', () => {
  it('(iv) hex hors tokens : aucune hausse par module CSS (base.css exclu)', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'base.css')) {
      // Commentaires exclus du scan : un « #304 » de réf de ticket n'est pas une couleur.
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, HEX_BASELINE, 'hex hors tokens');
  });

  it('(v) prix ⇒ <Coins> : aucune composition manuelle de monnaie (fail-closed, exemptions PA nominatives)', () => {
    const files = FICHIERS_UI()
      .filter((f) => estTsx(f) && !estTest(f))
      .filter((f) => nomDe(f) !== 'Coins.tsx')
      .filter((f) => !PRICE_PA_ARMOR_EXEMPT.has(rel(f)));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (f.text.match(/\}[^<>{}]{0,4} (?:CO|PA|CA)\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PRICE_BASELINE, 'prix sans <Coins>');
  });

  it('(vii) flex-wrap: wrap hors components.css/layout.css : aucune hausse par module CSS', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'components.css' && nomDe(f) !== 'layout.css')) {
      const n = (f.text.match(/flex-wrap:\s*wrap/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FLEX_WRAP_BASELINE, 'flex-wrap hors components.css/layout.css');
  });

  it('(viii) fill/stroke littéraux hors token var(--…) : aucune hausse par fichier .tsx', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estTsx(f) && !estTest(f))) {
      const n = (f.text.match(/(?:fill|stroke)=("|')(?:#|rgb|hsl)/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FILL_LITERAL_BASELINE, 'fill/stroke littéral hors token');
  });

  it('(ix) .panel non redéfini hors components.css (#306)', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'components.css')) {
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      // `.panel` porté par le MÊME élément : soit en TÊTE de sélecteur (`^\s*\.panel`, capture aussi les
      // redéfinitions indentées d'un `@media` — le piège #306), soit COMPOSÉ à une autre classe (`X.panel`,
      // ex. `.interlude-hero.panel` — l'angle mort de l'ancre seule). Les modificateurs du même élément
      // (`.mod`/`:pseudo`/`[attr]`) sont tolérés jusqu'à la FIN du sélecteur (`\s*[,{]`) ; les descendants
      // (`.panel h3`, `.grid > .panel`) et toute classe dont le nom commence par `.panel-` sont exclus.
      const n = (css.match(/(?:^\s*|[a-z0-9-])\.panel(?:[.:][\w-]+|\[[^\]]*\])*\s*[,{]/gm) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PANEL_REDEFINE_BASELINE, '.panel redéfini hors components.css');
  });

  it('(x) <button> nu : aucune hausse par fichier .tsx (composer .btn/.chip ou une primitive — feedback user 2026-07-12, #373)', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !estTest(f) && !BARE_BUTTON_EXEMPT_FILES.has(rel(f)));
    const { bare, opaque } = scanBareButtons(files);
    assertRatchet(bare, BARE_BUTTON_BASELINE, '<button> nu — composer .btn/.chip ou une primitive (feedback user 2026-07-12, #373)');
    assertRatchet(opaque, BARE_BUTTON_OPAQUE_BASELINE, '<button> className opaque — exposer un littéral btn/chip/seg ou passer par une primitive (feedback user 2026-07-12, #373)');
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
      counts[file] = leaks; // clé = le chemin DÉCLARÉ (une feuille partagée peut vivre hors `src/ui`)
    }
    assertRatchet(counts, SHARED_LEAK_BASELINE, 'classe de domaine planquée en couche partagée — la déplacer dans le module de sa primitive ou la documenter au catalogue de charte-ui.md (#371)');
  });

  // ── (xiv) EXHAUSTIVITÉ (#371, gap gauges.css ; recalée #1800) : une feuille de `src/ui/**` a un
  //    statut — PARTAGÉE (`SHARED_CSS_FILES`, gardée par xiii), de PRIMITIVE (une entrée du
  //    manifeste la nomme par son champ `css`), ou d'ÉCRAN (soumise à (xxi)). Le défaut fondateur :
  //    un module CSS oublié (`gauges.css`, ~40 classes de domaine naval) échappait à TOUT en
  //    silence. Toute feuille hors de `src/ui/styles/` doit donc être déclarée nommément, et les
  //    trois statuts couvrent `src/ui/styles/` par construction — ce que l'union vérifie.
  it('(xiv) exhaustivité : chaque .css de src/ui est PARTAGÉ, de PRIMITIVE ou d’ÉCRAN', () => {
    const primitives = modulesDePrimitive();
    const toutes = FICHIERS_UI().filter(estCss).map((f) => f.rel);
    const partagees = new Set(SHARED_CSS_FILES.map((f) => (f.startsWith('..') ? f.replace('../', 'src/') : `src/ui/${f}`)));
    const sansStatut = toutes.filter((f) => !partagees.has(f) && !primitives.has(f) && !f.startsWith('src/ui/styles/')).sort();
    expect(sansStatut, `CSS hors radar (ni partagé, ni de primitive, ni sous src/ui/styles/) :\n${sansStatut.join('\n')}`).toEqual([]);
    const couverts = new Set([...partagees, ...primitives, ...modulesDEcran().map((f) => f.rel)]);
    const oublies = toutes.filter((f) => !couverts.has(f)).sort();
    expect(oublies, `CSS qu'aucun des trois statuts ne prend :\n${oublies.join('\n')}`).toEqual([]);
  });

  it('(xv) rangée TÉMOIN porteuse de valeur hors `opposedFrozen.ts` : gelée et décroissante (#990)', () => {
    const files = FICHIERS_UI().filter((f) => /\.tsx?$/.test(f.rel) && !estTest(f) && rel(f) !== 'opposedFrozen.ts');
    assertRatchet(scanFrozenValueRows(files), FROZEN_WITNESS_BASELINE, 'rangée témoin à valeur figée hors du calendrier de découverte `frozenOpposedRow` (#990)');
  });

  // ── (xvi) LARGEUR d'une classe de MODALE : elle appartient à la COQUILLE partagée (`.modal`,
  //    `components.css`), jamais à une variante d'enveloppe. Défaut mesuré : `.test-modal { width:
  //    340px }`, importée APRÈS la couche partagée, écrasait `min(520px, 94vw)` pour SEPT modales —
  //    les rangées de jet (bâties pour ~520px) s'empilaient et débordaient horizontalement. Deux
  //    volets, tous deux structurels : une largeur en px doit rester BORNÉE à la fenêtre
  //    (`max-width` en vw dans la MÊME règle), et aucune ne descend SOUS la largeur standard —
  //    rétrécir est le travail du contenu, pas d'une classe d'enveloppe.
  it('(xvi) largeur d’une classe de modale : bornée à la fenêtre et jamais plus étroite que la coquille standard', () => {
    const shared = readFileSync(join(UI, 'styles', 'components.css'), 'utf8');
    const standard = shared.match(/\.modal\s*\{[^}]*?width:\s*min\((\d+)px/);
    expect(standard, '`.modal` ne pose plus `width: min(<n>px, …)` dans components.css : le standard de largeur a bougé, cette garde le lit.').toBeTruthy();
    const standardPx = Number(standard![1]);
    const offenders: string[] = [];
    for (const f of FICHIERS_UI().filter(estCss)) {
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim().replace(/\s+/g, ' ');
        if (!/\.[a-z0-9-]*modal\b/i.test(sel)) continue;
        const body = m[2];
        const px = body.match(/(?<![a-z-])width:\s*(\d+)px/i);
        if (!px) continue;
        if (!/max-width:\s*[\d.]+(?:vw|vmin|%)/i.test(body)) offenders.push(`${rel(f)} — ${sel} : width: ${px[1]}px sans max-width relatif à la fenêtre`);
        if (Number(px[1]) < standardPx) offenders.push(`${rel(f)} — ${sel} : width: ${px[1]}px < ${standardPx}px (coquille standard \`.modal\`)`);
      }
    }
    expect(offenders, `Largeur FIXE posée par une classe de modale — la largeur appartient à la coquille (\`.modal\`, components.css) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

/** Corps d'une tranche `@media` (accolades appariées). Les invariants ci-dessous s'énoncent sur la
 *  PRÉSENCE d'une règle dans SA tranche, et sur les GRANDEURS dont une valeur fausse casse une
 *  atteignabilité (réserve d'une colonne recouvrante) — jamais sur une esthétique en pixels. Le
 *  verdict de rendu, lui, se mesure au navigateur : `scripts/recette/hud-clickables.mjs`. */
function mediaBlock(css: string, query: string): string {
  const at = css.indexOf(query);
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}
/** Le module PRIVÉ de toutes ses tranches `@media` : ce qui doit valoir à TOUTE largeur se trouve
 *  ici. Une règle glissée dans une tranche disparaît de cette vue — c'est ce que l'invariant traque. */
function baseSection(css: string): string {
  let out = '';
  for (let i = 0; i < css.length; i++) {
    if (css.startsWith('@media', i)) {
      const open = css.indexOf('{', i);
      let depth = 0;
      let j = open;
      for (; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) break;
      }
      i = j;
      continue;
    }
    out += css[i];
  }
  return out;
}
/** Valeur en px de la propriété `prop` dans la règle de sélecteur `selector`, ou `null`. */
function pxOf(css: string, selector: string, prop: string): number | null {
  const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  if (!rule) return null;
  const v = new RegExp(`${prop}:\\s*(-?[\\d.]+)px`).exec(rule[1]);
  return v ? Number(v[1]) : null;
}
const occurrences = (s: string, needle: string) => s.split(needle).length - 1;

const TRANCHES_CANON = ['@media (max-width: 900px)', '@media (max-width: 700px)', '@media (max-width: 560px)', '@media (pointer: coarse)'];
const LARGEURS_CANON = ['900', '700', '560'];

/** Écarts au canon responsive MESURÉS sur tout module de `src/ui/styles` : `module|tranche` → nombre
 *  d'écritures de la tranche quand il dépasse 1, `module|<largeur>` → 1 pour un breakpoint hors canon. */
function ecartsResponsive(): Record<string, number> {
  const dir = join(UI, 'styles');
  const ecarts: Record<string, number> = {};
  for (const m of listerDossier(dir).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(dir, m), 'utf8');
    for (const q of TRANCHES_CANON) {
      const n = occurrences(css, q);
      if (n > 1) ecarts[`${m}|${q}`] = n;
    }
    const largeurs = new Set([...css.matchAll(/@media[^{]*max-width:\s*(\d+)px/g)].map((x) => x[1]));
    for (const w of largeurs) if (!LARGEURS_CANON.includes(w)) ecarts[`${m}|${w}`] = 1;
  }
  return ecarts;
}

/** Stock DÉCROISSANT, au site, mesuré le 2026-09-19 — aucun module de la famille Combat (#1806) n'y
 *  figure ; chaque entrée se solde au lot de son écran sous l'épic #1811. */
const ECARTS_RESPONSIVE_STOCK: Record<string, number> = {
  'base.css|@media (max-width: 700px)': 2,
  'components.css|@media (max-width: 560px)': 2,
  'components.css|@media (max-width: 700px)': 2,
  'creator-presentation.css|1100': 1,
  'creator.css|@media (max-width: 560px)': 2,
  'creator.css|@media (max-width: 700px)': 5,
  'layout.css|@media (max-width: 700px)': 2,
  'party.css|@media (max-width: 700px)': 3,
  'party.css|@media (max-width: 900px)': 2,
  'sheet.css|@media (max-width: 700px)': 2,
  'world-meta.css|@media (max-width: 560px)': 6,
  'world-meta.css|@media (max-width: 700px)': 2,
  'world-meta.css|@media (max-width: 900px)': 3,
};

describe('matrice responsive canonique (design 2026-07-31 §12)', () => {
  const read = (m: string) => readFileSync(join(UI, 'styles', m), 'utf8');

  it('TOUT module écrit chaque tranche du canon au plus UNE fois, et aucun breakpoint hors de 900 / 700 / 560', () => {
    expect(ecartsResponsive(), 'écart NEUF : une section responsive ordonnée ne pose chaque tranche qu’une fois (360 et 420 sont des largeurs de RECETTE) ; écart SOLDÉ : retirer son entrée du stock').toEqual(ECARTS_RESPONSIVE_STOCK);
  });

  it('≤700 : la frise d’initiative devient une bande horizontale défilable, contrainte et dégagée', () => {
    // La frise est une PRIMITIVE (#1806 2a) : sa tranche vit dans SON module ; l'ancrage de l'ouvreur
    // du rail dissous reste à l'ÉCRAN qui monte le rail. Les deux blocs se lisent CONCATÉNÉS.
    const at700 = mediaBlock(read('initiative-strip.css'), '@media (max-width: 700px)')
      + mediaBlock(read('hud.css'), '@media (max-width: 700px)');
    expect(at700).toMatch(/\.is-tiles\s*\{[^}]*flex-direction:\s*row/);
    expect(at700).toMatch(/\.is-tiles\s*\{[^}]*overflow-x:[ \t\r\n]*auto/);
    // `overflow-x` ne mord que sur une piste BORNÉE : alignée en `flex-start`, elle prend la largeur
    // de son contenu, déborde du HUD et ne défile jamais (défaut mesuré : piste 633px dans une bande
    // de 294px à 360). `stretch` la ramène à la largeur de la bande.
    expect(at700).toMatch(/\.initiative-strip\s*\{[^}]*align-items:\s*stretch/);
    // LE HAUT-DROITE EST LIBRE : la plaque de caméra a quitté l'écran de jeu et le rail dégraissé
    // (journal + dossier de navire) s'ancre EN BAS à cette largeur — la frise va jusqu'au bord, comme
    // à gauche. Elle réservait 168px pour une colonne de 144px qui n'existe plus.
    const reserve = pxOf(at700, '.initiative-strip', 'right');
    expect(reserve, 'la frise ≤700 déclare son bord droit en px').not.toBeNull();
    expect(reserve!).toBeLessThanOrEqual(8);
    // Ce qui remplace la réserve : le rail DISSOUT à cette largeur ne porte plus l'ancrage de ses
    // enfants — son ouvreur d'écran se pose lui-même en bas, sinon il retombe dans le flux du stage.
    expect(at700).toMatch(/\.hud-rail\s*>\s*\.worldmap-btn\s*\{[^}]*position:\s*absolute/);
    expect(at700).toMatch(/\.hud-rail\s*>\s*\.worldmap-btn\s*\{[^}]*bottom:\s*\d+px/);
  });

  it('≤560 : le groupe tient sur une ligne, la console prend la largeur, la sortie de tour reste en bout de rangée d’arche', () => {
    // La bande de groupe tient sur UNE ligne à TOUTE largeur depuis la passe de matière (spécimen B) :
    // l'assertion monte donc dans la section de base — une bande qui s'enroulait mangeait 21 % de
    // l'écran à 1280 (grief vision). La lire dans la tranche ≤560 seulement laisserait le retour à la
    // ligne revenir au-dessus de 560. Le défilement vit sur la PISTE (`.pd-track`) depuis le repli
    // de la bande : le cadre porte l'ancrage, la piste porte la rangée.
    const hudBase = baseSection(read('party-dock.css'));
    expect(hudBase).toMatch(/\.pd-track\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(hudBase).toMatch(/\.pd-track\s*\{[^}]*overflow-x:[ \t\r\n]*auto/); // débordement de secours (combat naval)
    const barAt560 = mediaBlock(read('combat-console.css'), '@media (max-width: 560px)');
    // Le pont PREND LA LARGEUR (grille, pas une rangée qui déborde) : les deux travées s'empilent sous
    // la rangée d'arête. Sans `width: 100%`, la grille se rétracte à son contenu et les cases sortent.
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*display:\s*grid/);
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*width:\s*100%/);
    // La SORTIE DE TOUR (le coin) reste EN BOUT DE LA RANGÉE D'ARCHE : le gabarit la nomme, elle ne
    // retombe pas sous les travées où il faudrait défiler pour l'atteindre.
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*grid-template-areas:\s*'arch corner'/);
    expect(barAt560).toMatch(/\.cc-corner\s*\{[^}]*grid-area:\s*corner/);
  });

  it('≤560 : la bande basse réserve la hauteur de la CONSOLE (caméra et tiroir hors de son emprise)', () => {
    // Tiroir et rangée de caméra sont deux PRIMITIVES distinctes depuis #1806 2a : la garantie est
    // CROISÉE, les deux tranches se lisent CONCATÉNÉES — jamais « si trouvé ici, sinon là », qui
    // rendrait l'assertion verte quand l'un des deux modules perd son ancrage.
    const hudAt560 = mediaBlock(read('log-drawer.css'), '@media (max-width: 560px)')
      + mediaBlock(read('view-controls.css'), '@media (max-width: 560px)');
    // La console compacte monte à 265px du bas (4px d'ancrage + 261px mesurés au navigateur,
    // scénario magie 360×640, passe d'ASSEMBLAGE). Toute surface posée plus bas passe SOUS elle et
    // cesse de recevoir ses clics. Le tiroir du journal réserve donc cette hauteur ; la rangée de
    // caméra, elle, est ancrée par le HAUT (bandeau haut, au-dessus du terrain) et doit alors
    // dégager la COLONNE du tiroir (chevauchement mesuré 30×16 quand elle prenait toute la largeur).
    const px = (sel: string, prop: string) => {
      const rule = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(hudAt560);
      const v = rule && new RegExp(`${prop}:\\s*(?:calc\\()?\\s*(\\d+(?:\\.\\d+)?)px`).exec(rule[1]);
      return v ? Number(v[1]) : null;
    };
    const tiroir = px('.log-drawer', 'bottom');
    expect(tiroir, 'le tiroir du journal ≤560 doit déclarer sa réserve du bas en px').not.toBeNull();
    expect(tiroir!).toBeGreaterThanOrEqual(265);
    const cameraBas = px('.view-controls', 'bottom');
    const cameraHaut = px('.view-controls', 'top');
    if (cameraBas != null) expect(cameraBas).toBeGreaterThanOrEqual(tiroir! + 44);
    else {
      expect(cameraHaut, 'la rangée de caméra ≤560 s’ancre par le haut ou par le bas, jamais ni l’un ni l’autre').not.toBeNull();
      // Ancrée en haut : elle vit dans le BANDEAU HAUT (groupe replié + frise), au-dessus du
      // terrain — jamais au milieu du champ (640 − 265 de console − 44 de bouton au doigt).
      expect(cameraHaut!).toBeLessThanOrEqual(640 - 265 - 44);
      // … et laisser au tiroir sa colonne de gauche (44px de bouton + son ancrage).
      const cameraGauche = px('.view-controls', 'left');
      expect(cameraGauche, 'la rangée de caméra ancrée en haut doit déclarer sa réserve de gauche').not.toBeNull();
      expect(cameraGauche!).toBeGreaterThanOrEqual(48);
    }
  });

  it('pointeur grossier : les commandes de caméra offrent une cible de 44px', () => {
    // La cible tactile suit la PEAU partagée `.skin-tole` (components.css) : une seule définition
    // pour les quatre commandes vissées du HUD (caméra, journal, menu ☰, ouvreurs du pont).
    const coarse = mediaBlock(readFileSync(join(UI, 'styles', 'components.css'), 'utf8'), '@media (pointer: coarse)');
    expect(coarse).toMatch(/\.skin-tole\[data-ton\]\s*\{[^}]*min-width:\s*44px/);
    expect(coarse).toMatch(/\.skin-tole\[data-ton\]\s*\{[^}]*min-height:\s*44px/);
    // … et la garantie n'a de sens que si les commandes la PORTENT : sans cette assertion positive,
    // « les commandes de vue offrent 44px » se dégraderait en « la peau fait 44px ».
    // Lu aux LITTÉRAUX de `className` (commentaires blanchis) : CHAQUE pose de la classe de commande
    // porte la peau, et le fichier en pose au moins une.
    const COMMANDES: [string, string][] = [
      ['ViewControls.tsx', 'vc-btn'],
      ['LogDrawer.tsx', 'ld-btn'],
      ['GameMenu.tsx', 'gm-btn'],
      ['ExplorationDock.tsx', 'worldmap-btn'],
      ['CampaignView.tsx', 'worldmap-btn'],
    ];
    for (const [f, classe] of COMMANDES) {
      const code = readFileSync(join(UI, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const poses = [...code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .map((m) => (m[1] ?? m[2]).split(/\s+/))
        .filter((classes) => classes.includes(classe));
      expect(poses.length, `${f} pose « ${classe} »`).toBeGreaterThan(0);
      expect(poses.filter((classes) => !classes.includes('skin-tole')), `${f} : « ${classe} » posée SANS la peau`).toEqual([]);
    }
  });

  it('≤560, bande DÉPLIÉE : son rang passe devant le fil d’événements, et la règle BAT l’ancrage de repos', () => {
    const hud = readFileSync(join(UI, 'styles', 'hud.css'), 'utf8');
    const rang = (css: string, selecteur: string) => {
      const regle = reglesCss(css).find((r) => r.selecteurs.includes(selecteur) && declarations(r.corps).some((d) => d.prop === 'z-index'));
      return regle ? Number(declarations(regle.corps).find((d) => d.prop === 'z-index')!.valeur) : null;
    };
    const depliee = reglesCss(hud).find((r) => r.media?.includes('max-width: 560px') && r.selecteurs.includes('.stage > .party-dock.on'));
    expect(depliee, 'la tranche ≤560 de `hud.css` porte le rang de la bande dépliée').toBeDefined();
    const rangDeplie = Number(declarations(depliee!.corps).find((d) => d.prop === 'z-index')?.valeur);
    const fil = rang(readFileSync(join(UI, 'styles', 'combat-banner.css'), 'utf8'), '.combat-feed');
    expect(fil, '`.combat-feed` porte un rang').not.toBeNull();
    expect(rangDeplie).toBeGreaterThan(fil!);
    // À poids ÉGAL c'est l'ordre qui tranche, et l'ancrage de repos (`.stage > .party-dock`) suit
    // la primitive dans le graphe d'imports : le rang déplié se lit donc à un poids SUPÉRIEUR.
    expect(comparerPoids('.stage > .party-dock.on', '.stage > .party-dock')).toBe(1);
    expect(rang(hud, '.stage > .party-dock'), 'rang de repos').toBeLessThan(rangDeplie);
  });

  // Une PEAU se pose À CÔTÉ d'une classe de module : les deux visent le MÊME élément. Toute
  // propriété que le module redéclare et que la peau déclare AUSSI se tranche à la cascade — si le
  // delta PERD, c'est la peau qu'on voit et le module ment (défaut mesuré : `.vc-btn` à 0-1-0
  // perdait `font-size: 20px` contre `.skin-tole[data-ton]` à 0-2-0, glyphes de caméra à 19px).
  // Mesure STRUCTURELLE, jamais une liste de noms — à DEUX titres : les PEAUX sont toutes les
  // classes `.skin-*` que la couche partagée définit (une peau neuve entre sous la garde en
  // naissant), et les classes surveillées sont celles qui ne sont JAMAIS posées sans leur peau —
  // une classe posée aussi SANS elle est une BASE, que la peau repeint légitimement.
  it('peaux `.skin-*` : le DELTA d’un module BAT sa peau sur toute propriété qu’elle déclare aussi', () => {
    const lire = (rel: string) => readFileSync(join(UI, '..', '..', rel), 'utf8');
    const base = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);
    /** Poids de cascade : classes + attributs (ni id ni élément dans ces feuilles). */
    const poids = (sel: string) => (sel.match(/\.[\w-]+|\[[^\]]*\]/g) ?? []).length;
    /** Famille de propriété : une longhand de bordure se fait écraser par la shorthand `border`. */
    const famille = (p: string) => (p.startsWith('border-') && p !== 'border-radius' ? 'border' : p);
    /** Rang d'`@import` : à poids ÉGAL, la feuille la plus tardive gagne. */
    const orchestrateur = readFileSync(join(UI, 'styles.css'), 'utf8');
    const rang = (rel: string) => orchestrateur.indexOf(`/${base(rel)}'`);
    const rangPeau = Math.max(...FEUILLES_PARTAGEES.map(rang));
    const modules = [...modulesDEcran().map((f) => f.rel), ...modulesDePrimitive()];

    // 0. Les PEAUX de la couche partagée, DÉRIVÉES de ses sélecteurs.
    const PEAUX = new Set<string>();
    for (const f of FEUILLES_PARTAGEES) {
      for (const { selecteurs } of reglesCss(lire(f))) {
        for (const sel of selecteurs) for (const m of sel.matchAll(/\.(skin-[\w-]+)/g)) PEAUX.add(m[1]);
      }
    }
    expect(PEAUX.size, 'aucune peau `.skin-*` dans la couche partagée : la mesure serait vide').toBeGreaterThan(0);

    const perdants: string[] = [];
    const vues: string[] = [];
    for (const PEAU of PEAUX) {
      // 1. Les classes posées EXCLUSIVEMENT avec la peau, lues aux valeurs `className` du corpus.
      const avec = new Set<string>();
      const sans = new Set<string>();
      for (const { text } of readCorpus(['src/ui'], { exts: ['.tsx'] })) {
        for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          const classes = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean);
          for (const c of classes) if (c !== PEAU) (classes.includes(PEAU) ? avec : sans).add(c);
        }
      }
      const vissees = [...avec].filter((c) => !sans.has(c));
      vues.push(`${PEAU} : ${vissees.length}`);

      // 2. Ce que la peau déclare, et à quel poids.
      const peau = new Map<string, number>();
      for (const f of FEUILLES_PARTAGEES) {
        for (const { selecteurs, corps } of reglesCss(lire(f))) {
          for (const sel of selecteurs) {
            if (!sel.includes(`.${PEAU}`)) continue;
            for (const d of corps.split(';')) {
              const prop = famille(d.split(':')[0].trim());
              if (prop) peau.set(prop, Math.max(peau.get(prop) ?? 0, poids(sel)));
            }
          }
        }
      }
      // Une peau au CORPS vide ne peut battre aucun delta : la comparaison serait verte par vacuité,
      // peau par peau (une peau déclarante ne couvre pas la voisine muette).
      expect(peau.size, `la peau .${PEAU} ne déclare AUCUNE propriété`).toBeGreaterThan(0);

      // 3. Tout delta d'un module sur une classe vissée, comparé au poids de la peau.
      for (const rel of modules) {
        for (const { selecteurs, corps } of reglesCss(lire(rel))) {
          for (const sel of selecteurs) {
            const dernier = sel.split(/[\s>+~]+/).filter(Boolean).pop() ?? '';
            if (!vissees.some((c) => dernier.includes(`.${c}`))) continue;
            for (const d of corps.split(';')) {
              const [prop, ...reste] = d.split(':');
              const attendu = peau.get(famille(prop.trim()));
              if (attendu === undefined) continue;
              const gagne = poids(sel) > attendu || (poids(sel) === attendu && rang(rel) > rangPeau);
              if (!gagne) {
                perdants.push(`${rel} :: ${sel} { ${prop.trim()}: ${reste.join(':').trim()} } — poids ${poids(sel)} contre ${attendu} (peau .${PEAU})`);
              }
            }
          }
        }
      }
    }
    // Aucune peau ne doit rester SANS porteur : la mesure serait verte par vacuité.
    expect(vues.filter((v) => v.endsWith(': 0')), `Peau SANS aucune classe vissée — personne ne la pose :\n${vues.join('\n')}`).toEqual([]);
    expect(
      perdants,
      `DELTA PERDANT contre la peau — c'est la peau qu'on voit, pas ces valeurs. Porter le delta sous`
        + ` son conteneur (poids ≥ celui de la peau) ou le retirer :\n${perdants.join('\n')}`,
    ).toEqual([]);
  });

  it('la colonne d’États est ancrée dans la carte de SON héros, à TOUTE largeur', () => {
    // L'ancrage se lit hors de toute tranche : glissé dans un `@media`, il cesserait de valoir aux
    // largeurs qui ne l'atteignent pas et les pastilles reflotteraient entre deux portraits.
    // Planche USER 2026-08-17 : la colonne est SŒUR du portrait dans `.ptile-wrap` (rangée flex) —
    // à CÔTÉ de lui, plus posée dessus — et son emprise est UNE colonne d'alvéole, fixe.
    const base = baseSection(read('party-dock.css'));
    expect(base).toMatch(/\.party-dock\s+\.ptile-wrap\s*\{[^}]*display:\s*flex/);
    expect(base).toMatch(/\.party-dock\s+\.ptile-wrap\s*\{[^}]*flex-direction:\s*row/);
    expect(base).toMatch(/\.party-dock\s+\.ptile-states\s*\{[^}]*display:\s*grid/);
    // Une colonne d'alvéole FIXE, pas une grille libre : sans ce gabarit, une tuile portant 3 États
    // s'élargirait et la bande se décalerait d'un héros à l'autre.
    expect(base).toMatch(/\.party-dock\s+\.ptile-states\s*\{[^}]*grid-template-columns:\s*var\(--alv\)/);
  });

  // `--alv` est une variable de CONTEXTE : `state-chips.css` en pose la valeur de BASE
  // (`.ptile-states[data-reserve]`, 15px) et ses hôtes la leur (`.party-dock .ptile-states`, 20px ;
  // la console) — à spécificité ÉGALE (0-2-0). C'est donc l'ORDRE D'IMPORT qui décide, et il se
  // GARDE : `state-chips.css` importée APRÈS reprendrait la main et ramènerait les alvéoles de la
  // bande à la taille du rack de liste.
  it('`--alv` : les poseurs de CONTEXTE s’importent APRÈS la primitive qui pose sa base', () => {
    const orchestrateur = readFileSync(join(UI, 'styles.css'), 'utf8');
    const rang = (f: string) => {
      const i = orchestrateur.indexOf(`styles/${f}`);
      expect(i, `${f} est importée par \`src/ui/styles.css\``).toBeGreaterThan(-1);
      return i;
    };
    const socle = rang('state-chips.css');
    for (const f of ['party-dock.css', 'combat-console.css']) {
      expect(rang(f), `${f} pose sa valeur de \`--alv\` APRÈS la base`).toBeGreaterThan(socle);
    }
  });

  // La barre d'actions est une primitive de la couche d'identité : sa tranche ≤700 (enroulement et
  // centrage, pour que deux boutons ne débordent pas d'une fenêtre étroite) vit AVEC elle. Posée
  // dans un module d'ÉCRAN, elle ne valait que tant que cet écran gardait la règle — et TOUTES les
  // modales la perdaient avec lui.
  it('≤700 : la barre d’actions des modales s’enroule et se centre, chez sa primitive', () => {
    const at700 = reglesCss(readFileSync(join(UI, 'styles', 'components.css'), 'utf8'))
      .filter((r) => r.media?.includes('max-width: 700px') && r.selecteurs.includes('.modal-actions'));
    expect(at700.length, '`.modal-actions` a une tranche ≤700 dans `components.css`').toBe(1);
    expect(at700[0].corps).toMatch(/flex-wrap:\s*wrap/);
    expect(at700[0].corps).toMatch(/justify-content:\s*center/);
  });

  it('les modales de jet occupent l’écran sous 560, corps défilable et pied fixe', () => {
    const css = read('roll-shell.css');
    expect(css).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*\{[^}]*overflow:\s*hidden/); // le corps défile, pas la boîte
    expect(css).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*>\s*\.modal-actions/); // pied hors du scrollport
    const at560 = mediaBlock(css, '@media (max-width: 560px)');
    expect(at560).toContain('.rs-scroll');
    // Le cadre tombe SUR LA MODALE de jet : `border-radius: 0` posé sur n'importe quelle autre règle
    // de la tranche satisfaisait l'ancienne formulation sans que la fenêtre prenne l'écran.
    expect(at560).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*\{[^}]*border-radius:\s*0/);
  });
});

// ── (xvii) `<input type="number">` codé à la main (#1318 V5) — volet JUMEAU du cliquet (x) `<button>`
//    nu : la primitive canonique du champ nombre borné est `NumberField` (`docs/primitives.md`
//    — saisie clavier + `QtyStepper` + plage dite). Un `<input type="number">` posé
//    directement rejoue à la main la borne, les pas et l'affordance. BASELINE PAR FICHIER DÉCROISSANTE :
//    stock COURANT mesuré par le scan ci-dessous : 26 balises / 2 fichiers, `editor/Inspector.tsx` et
//    `editor/Palette.tsx` (migration #1318 E1, tranche 3). EXEMPTÉ : `NumberField.tsx`, la primitive elle-même (c'est elle qui a le
//    droit — et le devoir — de poser l'`<input type="number">` canonique).
//    COUVERTURE du détecteur (à énoncer, pas à supposer) : il lit la balise OUVRANTE `<input …>` et
//    compte `type="number"` en littéral OU en expression CALCULÉE (`type={kind}`, `type={t ? 'number'
//    : 'text'}`) — un `type` dynamique PEUT valoir `"number"`, et le compter au pire cas ferme le trou
//    des wrappers locaux (`IdentityField` du créateur, dont les champs Âge/Taille étaient invisibles au
//    compte). L'unité mesurée est la BALISE ÉCRITE, pas le champ rendu : un wrapper local posé une fois
//    et appelé N fois vaut 1 (c'était le cas d'`IdentityField`, 1 balise pour 4 champs dont 2 nombres),
//    et un `<input>` produit par une FABRIQUE (`createElement('input')`) échappe au scan — 0 occurrence
//    mesurée. Les commentaires sont neutralisés avant le scan ; les `.test.tsx` sont hors périmètre (un
//    harnais qui pilote un champ n'est pas une réinvention de primitive).
const NUMBER_INPUT_EXEMPT_FILES = new Set(['NumberField.tsx']);
const NUMBER_INPUT_BASELINE: Record<string, number> = {
  // -2 (25 → 23) : les deux `<input type="number">` de l'empreinte de décor disparaissent avec le
  // champ lui-même (empreinte verrouillée à la source). Stock baissé, détecteur inchangé.
  // -1 (23 → 22, #1507) : le rayon d'éclairage d'une instance compose `NumberField` — l'écran touché
  // par le passage du rayon en mètres a rendu son champ à la primitive.
  // -1 (22 → 21, #1715) : la pente et le comble d'un corps composent `NumberField` (vide = suit la scène).
  'editor/Inspector.tsx': 21,
  'editor/Palette.tsx': 1,
};

/** Balise ouvrante `<input …>` complète (les `{…}` d'attribut peuvent contenir des `>`). */
function openTags(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let end = -1;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    if (end !== -1) out.push(src.slice(m.index, end + 1));
  }
  return out;
}

function scanNumberInputs(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const r = rel(f);
    if (NUMBER_INPUT_EXEMPT_FILES.has(r)) continue;
    const src = f.text
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
    for (const tag of openTags(src, 'input')) {
      if (!/type\s*=\s*(["']number["']|\{)/.test(tag)) continue;
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

// ── (xviii) Breakpoints de LARGEUR hors canon, sur TOUS les modules CSS (#1318 V5) — le volet
//    responsive du HUD ne regardait que `hud.css`/`combat-ui.css`/`roll-shell.css` ; la règle
//    stricte 4 du CLAUDE.md vaut pour tout `src/ui`. Canon VERS LE BAS : `max-width` ∈ {900,700,560}.
//    Canon VERS LE HAUT : `min-width` ∈ {561,701,901} (complément exact d'une tranche basse) et 1440
//    (docs/charte-ui.md § « Politique grand écran (≥1440px) »).
//    EXEMPTIONS NOMINATIVES (2026-08-16) — chacune porte sa raison, aucune n'est un blanc-seing :
//      - `creator-presentation.css` @media (max-width: 1100px) : ramener ce seuil à 900 changerait la
//        GÉOMÉTRIE de l'écran de présentation entre 900 et 1100px (grille ⇄ colonne, `order` de la
//        scène, hauteur de figurine) — une décision d'écran, hors lot d'outillage.
const WIDTH_CANON_MAX = ['900', '700', '560'];
const WIDTH_CANON_MIN = ['561', '701', '901', '1440'];
const BREAKPOINT_EXEMPT = new Map<string, string[]>([['styles/creator-presentation.css', ['max:1100']]]);

/** TOUTES les conditions de largeur de CHAQUE prélude `@media` — une règle peut en porter
 *  plusieurs (`@media (min-width: 561px) and (max-width: 900px)`) : ne lire que la première
 *  laisserait la seconde hors du canon sans que rien ne le dise. */
function widthBreakpoints(css: string): string[] {
  return [...css.matchAll(/@media[^{]*/g)].flatMap((p) =>
    [...p[0].matchAll(/(max|min)-width:\s*(\d+)px/g)].map((m) => `${m[1]}:${m[2]}`),
  );
}

// ── (xix) RAISON D'UN REFUS : un `<button disabled … title=…>` est une raison MUETTE (#1689 T2) —
//    `disabled` retire le bouton de l'ordre de tabulation et lui coupe tout événement de pointeur, et
//    un `title` natif n'atteint ni le lecteur d'écran, ni la manette, ni le doigt. Le bouton
//    d'engagement unique qui porte une raison est `GatedAction` (`aria-disabled` + `CodexRef refus` +
//    copie `aria-describedby`), et pour une option des TROIS layouts d'`OptionChooser` (grille, barre
//    d'actions, segment — tous composés par `OptionBouton`), la prop `refus`/`refusId`.
//    Baseline JOUEUR = 0 (les 53 sites appelants migrés) ; l'ATELIER reste gelé à son stock, dont la
//    migration est un lot à part (les outils d'édition n'ont pas la même contrainte manette/tactile).
//    EXEMPTIONS AU SITE (`fichier:ligne`, jamais au FICHIER — un fichier blanchi cache le site NEUF
//    qu'on y ajouterait) : un MODÈLE DE PROPS de socle n'est PAS un site de refus — le composant
//    expose `disabled`/`title` dans son API, et c'est l'APPELANT qui déciderait d'une raison. Chaque
//    ligne porte sa raison ; une ligne périmée (le site a bougé ou a été migré) échoue aussi.
const REFUS_MUET_EXEMPT_SITES = new Map<string, string>([
  ['GatedAction.tsx:155', 'la primitive elle-même : `title={ariaLabel}` y est le NOM accessible, pas une raison'],
  ['OptionChooser.tsx:108', '`OptionBouton` : la composition partagée des trois layouts, dont la branche gatée compose déjà `GatedAction`'],
  ['RollShell.tsx:299', 'modèle de props de la coquille de jet — passage à `GatedAction` = train T9'],
  ['MenuCard.tsx:133', 'modèle de props du menu — train T9'],
  ['MediaSelect.tsx:59', 'modèle de props du sélecteur média — train T9'],
  ['QtyStepper.tsx:64', 'modèle de props du stepper (décrément) — train T9'],
  ['QtyStepper.tsx:72', 'modèle de props du stepper (incrément) — train T9'],
]);
const REFUS_MUET_BASELINE: Record<string, number> = {
  'editor/Editor.tsx': 1,
  'editor/EditorToolbar.tsx': 3,
  'editor/EffectList.tsx': 2,
  'editor/FlowEditor.tsx': 2,
  'editor/GameOpEditor.tsx': 4,
  'editor/Inspector.tsx': 2,
  'editor/NarratifEditor.tsx': 3,
  'editor/Palette.tsx': 1,
  'editor/StatblockEditor.tsx': 2,
  'editor/WorldMapEditor.tsx': 1,
};

/** Balises ouvrantes d'un fichier, avec leur LIGNE — l'exemption se pose au site, pas au fichier. */
function tagsAvecLigne(src: string, tag: string): { tag: string; ligne: number }[] {
  const propre = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
  const out: { tag: string; ligne: number }[] = [];
  for (const t of openTags(propre, tag)) {
    const at = propre.indexOf(t);
    out.push({ tag: t, ligne: propre.slice(0, at).split('\n').length });
  }
  return out;
}

/** Un littéral d'OPTION qui route un refus par PROP (`{ disabled: …, title: … }` d'un `RollOption`) :
 *  le refus n'y est pas dans une balise, il y est en DONNÉE — et finit rendu en `disabled` + `title`
 *  par le layout. Le contrat est `refus`/`refusId` (`OptionChooser`), d'où sa mesure ici. Forme
 *  DÉTERMINISTE : un objet littéral portant les deux clés à la fois, sur la même accolade. */
function optionsRefusMuet(src: string): number[] {
  const lignes: number[] = [];
  // APPARIEMENT d'accolades, pas `[^{}]*` : une option porte des valeurs à accolades (template
  // literal `${…}`, `onSelect` à corps, `content` JSX). Le motif plat perdait tous ces littéraux —
  // et donc les refus qu'ils routent.
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '{') continue;
    let prof = 0;
    let fin = -1;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') prof++;
      else if (src[j] === '}') { prof--; if (prof === 0) { fin = j; break; } }
    }
    if (fin === -1) continue;
    const bloc = src.slice(i, fin + 1);
    // Clés du PREMIER niveau seulement : un objet imbriqué ne prête pas ses clés à son parent.
    const niveau1 = (cle: string) => {
      let p = 0;
      for (let k = 0; k < bloc.length; k++) {
        if (bloc[k] === '{') p++;
        else if (bloc[k] === '}') p--;
        else if (p === 1 && bloc.startsWith(cle, k) && /[\s,{]/.test(bloc[k - 1] ?? '{') && /^\s*:/.test(bloc.slice(k + cle.length))) return true;
      }
      return false;
    };
    if (!niveau1('disabled') || !niveau1('title')) continue;
    if (!niveau1('key') && !niveau1('onSelect')) continue; // c'est bien une OPTION, pas un objet quelconque
    // ÉCHAPPATOIRE : une option qui porte DÉJÀ `refus`/`refusId` n'est PAS un refus muet — sa raison
    // passe par la primitive, son `disabled` résiduel sert au comptage de l'appelant et son `title`
    // décrit l'état OFFERT (grille de table de `CascadeModal`). Cherchée dans TOUT le bloc, pas au
    // seul premier niveau : ces deux clés arrivent souvent par un SPREAD conditionnel
    // (`...(x ? { refusId } : {})`). Le déclencheur, lui, reste strict au premier niveau : une
    // échappatoire permissive ne crée aucun faux négatif de refus MUET.
    if (/\brefusId?\s*:/.test(bloc)) continue;
    lignes.push(src.slice(0, i).split('\n').length);
    i = fin; // pas de double comptage d'un littéral imbriqué
  }
  return lignes;
}

/** Un REFUS MUET : `<button>` portant À LA FOIS `disabled` et `title` (la raison qu'aucun lecteur
 *  d'écran, aucune manette et aucun doigt n'atteint), OU un `title` de refus posé sur un élément
 *  `aria-hidden` — forme PIRE encore, l'arbre a11y ne voit même plus le porteur —, OU un refus routé
 *  en PROP d'option (`{disabled, title}`), qui échappait au scan de balises. Les trois se mesurent
 *  sur la FORME, jamais sur un nom de variable. */
function sitesRefusMuet(f: Fichier): { cle: string; ligne: number }[] {
  const r = rel(f);
  const src = f.text;
  const out: { cle: string; ligne: number }[] = [];
  for (const tag of ['button', 'span', 'div', 'a'] as const) {
    for (const { tag: t, ligne } of tagsAvecLigne(src, tag)) {
      if (!/\btitle\s*=/.test(t)) continue;
      const muet = tag === 'button' ? /\bdisabled\b/.test(t) : /\baria-hidden\b/.test(t);
      if (muet) out.push({ cle: `${r}:${ligne}`, ligne });
    }
  }
  const propre = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
  for (const ligne of optionsRefusMuet(propre)) out.push({ cle: `${r}:${ligne}`, ligne });
  return out;
}

function scanRefusMuet(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const r = rel(f);
    for (const s of sitesRefusMuet(f)) {
      if (REFUS_MUET_EXEMPT_SITES.has(s.cle)) continue;
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

describe('#1318 V5 — cliquets d’hygiène UI (champ nombre, breakpoints)', () => {
  it('(xvii) <input type="number"> à la main : aucune hausse par fichier (composer NumberField)', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !estFichierVitest(f.rel));
    assertRatchet(scanNumberInputs(files), NUMBER_INPUT_BASELINE, '`<input type="number">` (primitive `NumberField`)');
  });

  it('(xix) raison de refus MUETTE (`<button disabled title=…>`) : aucune hausse, zéro côté joueur', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !estFichierVitest(f.rel));
    assertRatchet(scanRefusMuet(files), REFUS_MUET_BASELINE, '`<button disabled title=…>` (primitive `GatedAction`)');
  });

  it('(xix) le stock restant est ENTIÈREMENT dans l’atelier — aucun écran joueur ne porte de refus muet', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !estFichierVitest(f.rel));
    const joueur = Object.entries(scanRefusMuet(files))
      .filter(([f]) => !/^(editor|compendium|gallery)\//.test(f))
      .map(([f, n]) => `${f} : ${n}`);
    expect(joueur, `Refus MUET sur un écran JOUEUR — composer \`GatedAction\` (ou \`OptionChooser\` prop \`refus\`) :\n${joueur.join('\n')}`).toEqual([]);
  });

  it('(xix) chaque exemption est un SITE encore RÉEL — une ligne périmée se retire', () => {
    const reels = new Set(
      FICHIERS_UI().filter((f) => estTsx(f) && !estFichierVitest(f.rel)).flatMap((f) => sitesRefusMuet(f).map((s) => s.cle)),
    );
    const perimees = [...REFUS_MUET_EXEMPT_SITES.keys()].filter((k) => !reels.has(k));
    expect(perimees, `Exemption(s) PÉRIMÉE(S) — le site a bougé ou a été migré, retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('(xix) un site NEUF dans un fichier déjà exempté rougit — l’exemption est au SITE, pas au fichier', () => {
    // `GatedAction.tsx` porte une exemption (sa propre balise) : un SECOND refus muet dans ce
    // fichier ne doit PAS en hériter. On l'éprouve sur la source réelle du fichier exempté.
    const src = readFileSync(join(UI, 'GatedAction.tsx'), 'utf8');
    const dejaExempt = [...REFUS_MUET_EXEMPT_SITES.keys()].filter((k) => k.startsWith('GatedAction.tsx:'));
    expect(dejaExempt).toHaveLength(1);
    const neuf = `${src}\nexport const Faux = () => <button disabled title="raison muette">x</button>;\n`;
    const sites = tagsAvecLigne(neuf, 'button')
      .filter(({ tag }) => /\bdisabled\b/.test(tag) && /\btitle\s*=/.test(tag))
      .map(({ ligne }) => `GatedAction.tsx:${ligne}`)
      .filter((cle) => !REFUS_MUET_EXEMPT_SITES.has(cle));
    expect(sites, 'le site NEUF doit rester compté malgré l’exemption du site voisin').toHaveLength(1);
  });

  it('(xix) le détecteur voit un refus muet, et ne confond pas `disabled` seul ni `title` seul', () => {
    // Le scan travaille sur des BALISES ouvrantes : on l'éprouve sur une source en mémoire plutôt que
    // sur un fichier fantôme — `openTags` est la seule dépendance de forme.
    const tags = (src: string) => openTags(src, 'button').filter((t) => /\bdisabled\b/.test(t) && /\btitle\s*=/.test(t));
    expect(tags('<button disabled={x} title="pourquoi">a</button>')).toHaveLength(1);
    expect(tags('<button disabled={x}>a</button>')).toHaveLength(0);
    expect(tags('<button title="nom accessible">a</button>')).toHaveLength(0);
    // Un `title` DANS une accolade d'attribut (ternaire) ne coupe pas la balise trop tôt.
    expect(tags('<button disabled={a ? b : c} title={a ? "x > y" : undefined}>a</button>')).toHaveLength(1);
  });

  it('(xix) le détecteur voit les DEUX autres formes : `title` sur `aria-hidden`, et refus en PROP d’option', () => {
    // Bras `aria-hidden` : un refus écrit dans un `title` posé sur un élément retiré de l'arbre a11y.
    const cache = (src: string) => openTags(src, 'span').filter((t) => /\btitle\s*=/.test(t) && /\baria-hidden\b/.test(t));
    expect(cache('<span className="x" aria-hidden title="verrouillé">·</span>')).toHaveLength(1);
    expect(cache('<span className="x" title="nom">·</span>')).toHaveLength(0);
    expect(cache('<span className="x" aria-hidden>·</span>')).toHaveLength(0);
    // Bras PROP d'option : le refus routé en donnée, que le layout rend en `disabled` + `title`.
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', disabled: !ok, title: 'Bourse insuffisante' };")).toHaveLength(1);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', refus: 'Bourse insuffisante.' };")).toHaveLength(0);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', disabled: !ok };")).toHaveLength(0);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', title: 'description' };")).toHaveLength(0);
    // Un objet quelconque qui porte les deux clés sans être une option ne compte pas.
    expect(optionsRefusMuet("const cfg = { disabled: true, title: 'x' };")).toHaveLength(0);
  });

  it('(xix) le bras PROP ne perd pas une option à valeurs ACCOLADÉES (le motif plat en ratait 16 sur 19)', () => {
    // 1. `title` en TEMPLATE LITERAL : `${…}` ouvre une accolade DANS la valeur.
    expect(optionsRefusMuet('const o = { key: \'a\', label: \'A\', disabled: !ok, title: `Coût ${n} Av.` };')).toHaveLength(1);
    // 2. `onSelect` à CORPS : le corps de flèche ouvre une accolade.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'x', onSelect: () => { go(); } };")).toHaveLength(1);
    // 3. `content` JSX imbriquant une expression accoladée.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'x', content: <span>{n}</span> };")).toHaveLength(1);
    // 4. Clés d'un objet IMBRIQUÉ : elles ne comptent pas pour le parent (pas de faux positif).
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', meta: { disabled: true, title: 'x' } };")).toHaveLength(0);
    // 5. `refus` déjà posé : la raison passe par la primitive, l'option n'est PAS muette.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'desc', refusId: 'cause' };")).toHaveLength(0);
    // 6. … y compris arrivé par SPREAD conditionnel (la forme réelle de `CascadeModal`).
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'desc', ...(x ? { refusId: 'c' } : {}) };")).toHaveLength(0);
  });

  it('(xviii) aucun breakpoint hors canon dans TOUT src/ui (900/700/560 bas, 561/701/901/1440 haut)', () => {
    const hors: string[] = [];
    for (const f of FICHIERS_UI().filter(estCss)) {
      const r = rel(f);
      const exempt = BREAKPOINT_EXEMPT.get(r) ?? [];
      for (const bp of new Set(widthBreakpoints(f.text))) {
        if (exempt.includes(bp)) continue;
        const [sens, px] = bp.split(':');
        const canon = sens === 'max' ? WIDTH_CANON_MAX : WIDTH_CANON_MIN;
        if (!canon.includes(px)) hors.push(`${r} : @media (${sens}-width: ${px}px)`);
      }
    }
    expect(hors, `Breakpoint(s) hors canon (règle stricte 4 ; grand écran : docs/charte-ui.md) :\n${hors.join('\n')}`).toEqual([]);
  });

  it('(xviii) le parseur lit TOUTES les conditions d’un même @media, pas seulement la première', () => {
    expect(widthBreakpoints('@media (min-width: 561px) and (max-width: 1234px) { .a { color: red } }')).toEqual([
      'min:561',
      'max:1234',
    ]);
  });

  it('(xviii) chaque exemption nominative de breakpoint est encore RÉELLE', () => {
    for (const [r, bps] of BREAKPOINT_EXEMPT) {
      const réels = new Set(widthBreakpoints(readFileSync(join(UI, r), 'utf8')));
      for (const bp of bps) expect([...réels], `${r} : exemption ${bp} périmée — la retirer`).toContain(bp);
    }
  });
});

/** Propriétés de BOÎTE d'un contrôle : celles qu'une règle de module posée sur un `input` non typé
 *  peut écraser (cascade) ou clamper (`min-*`/`max-*`, hors cascade — d'où `!important` sur les deux). */
const PROPRIETES_DE_BOITE = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'padding', 'box-sizing', 'flex'] as const;
/** Propriétés de boîte déclarées `!important` par la règle globale case/radio de base.css. */
function boiteImmune(): Set<string> {
  const base = readFileSync(join(UI, 'styles/base.css'), 'utf8');
  const estCase = (s: string) => /\[type=["']checkbox["']\]/.test(s);
  const estRadio = (s: string) => /\[type=["']radio["']\]/.test(s);
  const regle = reglesCss(base).find((r) => r.selecteurs.some(estCase) && r.selecteurs.some(estRadio));
  const immunes = new Set<string>();
  for (const decl of regle?.corps.split(';') ?? []) {
    const [prop, valeur] = decl.split(':').map((x) => x?.trim());
    if (prop && valeur && /!important$/.test(valeur)) immunes.add(prop);
  }
  return immunes;
}

describe('#1792 — la boîte des contrôles custom est immune aux règles de module', () => {
  it('(xx) base.css : chaque propriété de boîte de la règle case/radio est `!important`', () => {
    const immunes = boiteImmune();
    const manquantes = PROPRIETES_DE_BOITE.filter((p) => !immunes.has(p));
    expect(manquantes, 'propriété(s) de boîte de la case/radio sans `!important` — une règle de module ou le `min-height` tactile la déformerait').toEqual([]);
  });

  it('(xx) toute propriété de boîte posée par un module sur un `input` NON typé est couverte par l’immunité', () => {
    const immunes = boiteImmune();
    const decouvertes: string[] = [];
    for (const f of FICHIERS_UI().filter(estCss)) {
      for (const { selecteurs, corps } of reglesCss(f.text)) {
        if (!selecteurs.some((s) => /(^|[\s>+~])input(:[a-z-]+(\([^)]*\))?)*$/.test(s) && !/\[type=/.test(s))) continue;
        for (const decl of corps.split(';')) {
          const prop = decl.split(':')[0]?.trim();
          if ((PROPRIETES_DE_BOITE as readonly string[]).includes(prop) && !immunes.has(prop)) decouvertes.push(`${rel(f)} : ${selecteurs.join(', ')} { ${prop} }`);
        }
      }
    }
    expect(decouvertes, 'règle(s) de module qui déforment une case/radio (propriété de boîte non immune) :').toEqual([]);
  });

  it('(xx) preuve — une règle posée APRÈS une at-rule DÉCLARATION reste vue par `reglesCss`', () => {
    // `styles.css` est une SUITE d'`@import …;` puis des règles : si le lexer n'oubliait pas le
    // prélude d'une at-rule sans bloc, tout ce qui suit sortirait du champ du cliquet.
    const styles = FICHIERS_UI().find((f) => rel(f) === 'styles.css');
    const vues = reglesCss(styles!.text).filter((r) => r.selecteurs.includes('.btn:focus-visible'));
    expect(vues, '`.btn:focus-visible` de styles.css est mesurée').toHaveLength(1);
    expect(vues[0].media, 'au premier niveau').toBe(null);

    const fixture = reglesCss('@import "a.css"; .x { color: red }');
    expect(fixture.map((r) => r.selecteurs)).toEqual([['.x']]);
    expect(fixture[0].media).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// (xxi)/(xxii) — LES TROIS COUCHES (#1800). La MESURE et le STOCK vivent dans
// `scripts/guards/lib/` (`cssCouchesAudit.ts`, `cssCouchesStock.mjs`), partagés avec le
// régénérateur `scripts/ui/regen-css-couches-stock.mts` ; ICI vit le VERDICT. Rien ne joue les
// régénérateurs en CI : ces `it` SONT le `--check`.
//
// Doctrine utilisateur du 2026-07-12 (#373) : « J'y crois pas une seule seconde à des classes
// mono-écrans personnellement, c'est une excuse à la dérive ». Ce que ce cliquet compte n'est plus
// le NOMBRE de classes d'un module (une classe de PLACEMENT est une composition légitime par
// écran, arbitrage A1 du 2026-09-18) mais l'IDENTITÉ qu'un module d'écran redéclare, l'espacement
// qu'il pose hors de l'échelle, et le `style=` qu'il écrit à la main.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Une fixture de mesure : même forme qu'un fichier de `readCorpus`, jamais le disque. */
const fixture = (rel: string, text: string): FichierMesure => ({ rel, text });

/** Les réfs d'une liste de sites — ce qu'un `it` de preuve compare. */
const refs = (sites: { file: string; ref: string }[]) => sites.map((s) => s.ref);

/** Spécificité (classes+attributs, éléments) d'un sélecteur SIMPLE (sans combinateur). */
function specificite(selecteur: string): number {
  return (selecteur.match(/\.[\w-]+|\[[^\]]*\]/g) ?? []).length;
}

/** Un sélecteur SIMPLE (que des `.classe` et des `[attr]`/`[attr='v']`) matche-t-il cet élément ? */
function matcheElement(selecteur: string, classes: string[], attrs: Record<string, string>): boolean {
  if (/[\s>+~:,]/.test(selecteur)) return false; // combinateur ou pseudo : hors du cas mesuré
  const morceaux = selecteur.match(/\.[\w-]+|\[[^\]]*\]/g) ?? [];
  if (morceaux.join('') !== selecteur) return false;
  return morceaux.every((m) => {
    if (m.startsWith('.')) return classes.includes(m.slice(1));
    const [, nom, valeur] = /^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]$/.exec(m) ?? [];
    if (!nom || !(nom in attrs)) return false;
    return valeur === undefined || attrs[nom] === valeur;
  });
}

/** La règle GAGNANTE pour `prop` sur un élément donné, selon la cascade réelle (spécificité, puis
 *  ORDRE d'`@import` de `styles.css`). Les blocs `@media` sont hors du cas mesuré (pleine largeur). */
function regleGagnante(
  feuilles: readonly { nom: string; text: string }[],
  prop: string,
  classes: string[],
  attrs: Record<string, string>,
): { origine: string; selecteur: string; valeur: string } | null {
  let meilleure: { origine: string; selecteur: string; valeur: string; poids: number } | null = null;
  for (const { nom, text } of feuilles) {
    for (const { selecteurs, corps, media } of reglesCss(text)) {
      if (media) continue;
      const decl = corps.split(';').map((d) => d.split(':').map((x) => x.trim()));
      const posee = decl.find(([p]) => p === prop);
      if (!posee) continue;
      for (const sel of selecteurs) {
        if (!matcheElement(sel, classes, attrs)) continue;
        const poids = specificite(sel);
        // À poids ÉGAL, la feuille la plus tardive gagne — c'est tout l'enjeu de l'ordre d'`@import`.
        if (!meilleure || poids >= meilleure.poids) meilleure = { origine: nom, selecteur: sel, valeur: posee[1], poids };
      }
    }
  }
  return meilleure ? { origine: meilleure.origine, selecteur: meilleure.selecteur, valeur: meilleure.valeur } : null;
}

describe('#1800 — trois couches CSS : un module d’écran ne pose que du PLACEMENT', () => {
  it('(xxi) identité en module d’écran : stock nominatif, décroissant', () => {
    const { neuves, perimees } = ecartDuVolet({
      sites: mesureCssCouches().identite,
      stock: CSS_IDENTITE_ECRAN_RATCHET,
      ou: 'scripts/guards/lib/cssCouchesStock.mjs (CSS_IDENTITE_ECRAN_RATCHET)',
    });
    expect(neuves, `Identité NEUVE dans un module d’ÉCRAN — la porter dans le module de sa primitive (manifeste, champ \`css\`) :\n${neuves.join('\n')}`).toEqual([]);
    expect(perimees, `Entrée(s) SOLDÉE(s) — relancer \`npx tsx scripts/ui/regen-css-couches-stock.mts\` :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('(xxi) espacement hors échelle : stock nominatif, décroissant', () => {
    const { neuves, perimees } = ecartDuVolet({
      sites: mesureCssCouches().espacement,
      stock: CSS_ESPACEMENT_RATCHET,
      ou: 'scripts/guards/lib/cssCouchesStock.mjs (CSS_ESPACEMENT_RATCHET)',
    });
    expect(neuves, `Espacement NEUF hors de l’échelle \`--sp-*\` (base.css) :\n${neuves.join('\n')}`).toEqual([]);
    expect(perimees, `Entrée(s) SOLDÉE(s) — relancer le régénérateur :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('(xxii) style inline hors variable CSS : stock nominatif, décroissant', () => {
    const { neuves, perimees } = ecartDuVolet({
      sites: mesureCssCouches().inline,
      stock: STYLE_INLINE_RATCHET,
      ou: 'scripts/guards/lib/cssCouchesStock.mjs (STYLE_INLINE_RATCHET)',
    });
    expect(neuves, `\`style=\` NEUF (arbitrage user A2, 2026-09-18 : la seule forme légale est un objet dont TOUTES les clés sont des variables CSS) :\n${neuves.join('\n')}`).toEqual([]);
    expect(perimees, `Entrée(s) SOLDÉE(s) — relancer le régénérateur :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('(xxi) le manifeste classe chaque module : un css de primitive existe, et n’est pas une feuille partagée', () => {
    const fautes: string[] = [];
    for (const css of modulesDePrimitive()) {
      if (!css.endsWith('.css')) fautes.push(`${css} — n’est pas une feuille CSS`);
      if (!existsSync(join(UI, '..', '..', css))) fautes.push(`${css} — absent du disque`);
      if (FEUILLES_PARTAGEES.includes(css)) fautes.push(`${css} — feuille PARTAGÉE, aucune primitive ne la possède`);
    }
    expect(fautes, `Champ \`css\` fautif au manifeste des primitives — il déclasserait un module d’écran entier :\n${fautes.join('\n')}`).toEqual([]);
  });

  it('(xxi) le balayage n’est pas vide : des modules d’écran, et chacun hors couche partagée', () => {
    const ecrans = modulesDEcran().map((f) => f.rel);
    expect(ecrans.length, 'aucun module d’ÉCRAN mesuré — le cliquet serait vert par vacuité').toBeGreaterThan(0);
    expect(ecrans.filter((f) => FEUILLES_PARTAGEES.includes(f))).toEqual([]);
  });

  it('(xxi) preuve par mutation — une couleur dans une classe MAL NOMMÉE d’un module d’écran rougit', () => {
    const sites = sitesIdentiteEcran([fixture('src/ui/styles/faux.css', '.layout-truc { color: var(--gold) }')]);
    expect(sites).toEqual([{ file: 'src/ui/styles/faux.css', ref: '.layout-truc :: color' }]);
  });

  it('(xxi) preuve — une classe de placement NEUVE est verte', () => {
    expect(sitesIdentiteEcran([
      fixture('src/ui/styles/faux.css', '.x { display: flex; gap: var(--sp-md); min-width: 0; grid-template-columns: 1fr 2fr }'),
    ])).toEqual([]);
  });

  it('(xxi) preuve — chaque famille d’identité est vue, et aucun placement ne l’est', () => {
    const peint = ['border-radius: 8px', 'box-shadow: none', 'font-weight: 600', 'opacity: 0.5',
      'background: red', 'border-color: red', 'cursor: pointer', 'transition: 0.15s'];
    for (const decl of peint) {
      expect(refs(sitesIdentiteEcran([fixture('src/ui/styles/faux.css', `.x { ${decl} }`)])), decl).toHaveLength(1);
    }
    for (const decl of ['--ma-var: 3px', 'list-style: none', 'touch-action: none', 'user-select: none']) {
      expect(sitesIdentiteEcran([fixture('src/ui/styles/faux.css', `.x { ${decl} }`)]), decl).toEqual([]);
    }
  });

  it('(xxi) preuve — le contexte @media n’abrite rien, et la réf porte le sélecteur SEUL', () => {
    expect(refs(sitesIdentiteEcran([
      fixture('src/ui/styles/faux.css', '@media (max-width: 700px) { .x { font-size: 12px } }'),
    ]))).toEqual(['.x :: font-size']);
  });

  it('(xxi) preuve — le même texte en module de PRIMITIVE est VERT (la frontière vient du manifeste)', () => {
    const feuilles = [fixture('src/ui/styles/faux.css', '.x { color: red }')];
    const manifeste = [{ id: 'fausse', css: 'src/ui/styles/faux.css' }];
    expect(modulesDEcran(feuilles, modulesDePrimitive(manifeste))).toEqual([]);
    expect(modulesDEcran(feuilles, modulesDePrimitive([{ id: 'autre' }]))).toEqual(feuilles);
  });

  it('(xxi) preuve — l’échelle : un littéral px est un site, un token n’en est pas un', () => {
    const espacement = (css: string) => refs(sitesEspacementHorsEchelle([fixture('src/ui/styles/faux.css', css)]));
    expect(espacement('.x { gap: 10px }')).toEqual(['.x :: gap :: 10px']);
    expect(espacement('.x { gap: var(--sp-md) }')).toEqual([]);
    expect(espacement('.x { margin: 0 auto }')).toEqual([]);
    expect(espacement('.x { padding: 0 max(12px, env(safe-area-inset-left)) }'))
      .toEqual(['.x :: padding :: 0 max(12px, env(safe-area-inset-left))']);
  });

  it('(xxi) preuve — l’exemption est au SITE : une 2ᵉ déclaration homonyme est une occurrence NEUVE', () => {
    const sites = sitesIdentiteEcran([fixture('src/ui/styles/faux.css', '.x { color: red; color: blue }')]);
    const { neuves } = ecartDuVolet({
      sites,
      stock: [{ fichier: 'src/ui/styles/faux.css', ref: '.x :: color', occurrence: 1 }],
      ou: 'fixture',
    });
    expect(neuves).toHaveLength(1);
    expect(neuves[0]).toContain(cleDeSite({ fichier: 'src/ui/styles/faux.css', ref: '.x :: color', occurrence: 2 }));
  });

  it('(xxi) preuve — la CASCADE : `.stack[data-pad]` n’est écrasé ni par `.panel` ni par `.panel.flush`', () => {
    // Méthode : calcul de SPÉCIFICITÉ puis d'ORDRE sur les règles RÉELLES des deux feuilles, dans
    // l'ordre d'`@import` de `styles.css` (jsdom ne résout pas `var()`, il ne pourrait rien dire ici).
    const feuilles = [
      { nom: 'components.css', text: readFileSync(join(UI, 'styles/components.css'), 'utf8') },
      { nom: 'layout.css', text: readFileSync(join(UI, 'styles/layout.css'), 'utf8') },
    ];
    const avecPad = regleGagnante(feuilles, 'padding', ['panel', 'flush', 'stack'], { 'data-pad': 'md' });
    expect(avecPad?.origine, 'avec `pad`, c’est la couche LAYOUT qui pose le padding').toBe('layout.css');
    expect(avecPad?.valeur).toBe('var(--pad)');
    const sansPad = regleGagnante(feuilles, 'padding', ['panel', 'stack'], {});
    expect(sansPad?.origine, 'sans `pad`, le panel garde SON padding').toBe('components.css');
    expect(sansPad?.valeur).toBe('16px');
  });

  it('(xxii) preuve — formes de `style=`', () => {
    const inline = (tsx: string) => refs(sitesStyleInline([fixture('src/ui/Faux.tsx', tsx)]));
    expect(inline('<i style={{ width: w }} />')).toEqual(['i :: width']);
    expect(inline("<i style={{ '--x': w }} />")).toEqual([]);
    expect(inline("<i style={{ '--x': w } as CSSProperties} />")).toEqual([]);
    expect(inline("<i style={{ '--x': 1, width: 2 }} />")).toEqual(['i :: --x,width']);
    expect(inline('<i style={s} />')).toEqual(['i :: expr']);
    expect(inline('<i style={c ? { top } : undefined} />')).toEqual(['i :: expr']);
    expect(inline('<i style={{}} />')).toEqual(['i :: vide']);
    expect(inline('<i style={{ ...base }} />')).toEqual(['i :: expr']);
    expect(inline('<i className="dr-bar-fill" style={{ width: w }} />')).toEqual(['i.dr-bar-fill :: width']);
  });

  it('(xxii) preuve — un commentaire n’est pas du markup', () => {
    expect(sitesStyleInline([fixture('src/ui/Faux.tsx', '{/* style={{ color }} */}')])).toEqual([]);
    expect(sitesStyleInline([fixture('src/ui/Faux.tsx', '// style={{ color }}')])).toEqual([]);
  });
});
