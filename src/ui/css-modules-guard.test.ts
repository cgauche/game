import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reglesCss, FEUILLES_PARTAGEES, declarations, estPlacement, modulesDePrimitive } from '../../scripts/guards/lib/cssCouches.mjs';
import { imageDuDisque } from '../../scripts/guards/lib/cssCouchesAudit.js';

/**
 * #1806 — le module CSS d'une PRIMITIVE est le SEUL foyer de ce qu'elle peint (règle A1,
 * `docs/charte-ui.md` § Architecture CSS). Deux gardes, deux défauts distincts que le stock (xxi) ne voit PAS :
 *
 *   §5.3 REPEINT — une classe DÉFINIE ailleurs (couche partagée ou module d'une autre primitive) est
 *   repeinte depuis une feuille tierce : la cascade décide alors du rendu selon l'ordre d'import, et
 *   la même classe n'a plus une seule matière. Un DESCENDANT sous un contexte de PRIMITIVE reste une
 *   spécialisation légitime (la primitive sait ce qu'elle héberge) ; un contexte d'ÉCRAN, non.
 *
 *   §5.4 DESTINATION NOMMÉE — une famille de classes migrée vers le module de sa primitive ne se
 *   RECRÉE pas dans un module d'écran : le préfixe porte sa destination, la garde la nomme.
 *
 * Les deux stocks sont NOMINATIFS et DÉCROISSANTS : une entrée soldée doit être retirée.
 */

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lire = (rel: string) => readFileSync(`${RACINE}${rel}`, 'utf8');

const classesDe = (sel: string): string[] => (sel.match(/\.[a-zA-Z_-][\w-]*/g) ?? []).map((x) => x.slice(1));
/** Le sélecteur SANS les arguments de ses pseudo-classes fonctionnelles : `:has(> .x .y)` porte des
 *  combinateurs et des classes qui ne sont PAS le sujet de la règle — les garder ferait passer
 *  `label:has(> .btn)` pour une règle de `.btn`. Les arguments restent lisibles à part (contexte). */
const sansArguments = (sel: string): string => {
  let prof = 0;
  let out = '';
  for (const c of sel) {
    if (c === '(') { prof++; if (prof === 1) out += '()'; continue; }
    if (c === ')') { prof--; continue; }
    if (prof === 0) out += c;
  }
  return out;
};
/** Les parties d'un sélecteur, combinateurs retirés — la DERNIÈRE est ce que la règle vise. */
const parties = (sel: string): string[] => sansArguments(sel).trim().split(/\s+|>|\+|~/).filter(Boolean);
/** Les classes citées DANS les arguments d'une pseudo-classe (`:has(.roll-modal)`) : du contexte. */
const classesInternes = (sel: string): string[] =>
  (sel.match(/\(([^()]*)\)/g) ?? []).flatMap((arg) => classesDe(arg));

/** Les classes DÉFINIES par une feuille : celles d'un sélecteur SANS combinateur (un descendant
 *  spécialise un contexte, il ne définit rien). La première classe du compound porte le domaine. */
function classesDefinies(rel: string): Set<string> {
  const out = new Set<string>();
  for (const r of reglesCss(lire(rel))) {
    for (const sel of r.selecteurs) {
      const p = parties(sel);
      if (p.length !== 1) continue;
      const c = classesDe(p[0])[0];
      if (c) out.add(c);
    }
  }
  return out;
}

/** classe → feuille PROPRIÉTAIRE (couche partagée d'abord, puis modules de primitive). */
function proprietaires(): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of [...FEUILLES_PARTAGEES, ...modulesDePrimitive(imageDuDisque().manifeste)]) {
    if (!existsSync(`${RACINE}${f}`)) continue;
    for (const c of classesDefinies(f)) if (!map.has(c)) map.set(c, f);
  }
  return map;
}

/**
 * Stock MESURÉ des repeints (2026-09-18, #1806 2c) : chacun est un écran qui redéfinit la matière
 * d'une classe qu'il ne possède pas. Clé = `feuille|sélecteur`, valeur = la feuille propriétaire.
 * Aucun n'appartient à la vague JET : ils se soldent à leur propre lot, et la garde interdit le
 * SUIVANT.
 */
const REPEINTS_STOCK: readonly string[] = [
  "src/ui/styles/compendium.css|.chip.codex-facet.on",
  "src/ui/styles/compendium.css|.codex-cat.on .count",
  "src/ui/styles/creator-shell.css|.screen.creator",
  "src/ui/styles/creator.css|.creator-race-grid .fig-tile.rolled",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list::after",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list::before",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list[data-at-bottom]::after",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list[data-at-top]::before",
  "src/ui/styles/creator.css|.main-head .hint",
  "src/ui/styles/creator.css|.tag.char",
  "src/ui/styles/editor.css|.insp-fold .fold-title",
  "src/ui/styles/merchant.css|.merchant-body .empty",
  "src/ui/styles/party.css|.candidate-fig > .charprev",
  "src/ui/styles/party.css|.card-roles .entity-chip",
  "src/ui/styles/party.css|.card-roles .entity-chip:focus-within",
  "src/ui/styles/party.css|.card-roles .entity-chip:hover",
  "src/ui/styles/party.css|.party-actions .btn",
  // RÉVÉLÉ (pas créé) au 2d de #1806 : déclarer `rigPortrait` donne un propriétaire à `.rig-portrait`,
  // et la fiche PEINT le visage en médaillon depuis son écran (rayon 999px, ombre portée). Mesuré au
  // site : `width`/`height: 112px` y sont MORTS (`.ptile .ptile-face .rig-portrait`, 0-3-0, les bat),
  // et `border-width: 3px` y est redondant — restent un rayon et une ombre, qui appellent un TON de la
  // primitive et une prop traversant `PortraitTile`. Soldé au lot de la fiche (épic #1811).
  "src/ui/styles/sheet.css|.sheet-portrait .rig-portrait",
  "src/ui/styles/sheet.css|[data-tone] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='ambre'] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='sang'] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='violet'] .plaque-row",
  "src/ui/styles/world-meta.css|.btn.ghost",
  "src/ui/styles/world-meta.css|.worldmap-overlay > .scene-backdrop",
];

/** Un site de repeint mesuré : `feuille|sélecteur` + la feuille qui possède la classe. */
export function sitesRepeint(feuilles: readonly { rel: string; text: string }[]): string[] {
  const proprio = proprietaires();
  const primitives = modulesDePrimitive(imageDuDisque().manifeste);
  const classesDePrimitive = new Set([...primitives].filter((f) => existsSync(`${RACINE}${f}`)).flatMap((f) => [...classesDefinies(f)]));
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    if (FEUILLES_PARTAGEES.includes(rel)) continue;
    const siennes = primitives.has(rel) ? new Set(classesDe(text)) : new Set<string>();
    for (const r of reglesCss(text)) {
      if (!declarations(r.corps).some((d) => !estPlacement(d.prop))) continue;
      for (const sel of r.selecteurs) {
        const p = parties(sel);
        const droite = p.pop() ?? '';
        const c = classesDe(droite)[0];
        if (!c) continue;
        const chez = proprio.get(c);
        if (!chez || chez === rel) continue;
        // Contexte = ce qui est à GAUCHE, plus ce qu'un `:has()`/`:not()` de la règle nomme.
        const contexte = [...p.flatMap(classesDe), ...classesInternes(sel)];
        if (contexte.some((x) => classesDePrimitive.has(x) || siennes.has(x))) continue;
        out.push(`${rel}|${sel}`);
      }
    }
  }
  return out;
}

/** Préfixe de la vague JET → module de destination. La famille a un FOYER, nommé ici. */
const FAMILLES_JET: readonly (readonly [string, string])[] = [
  ['rm-', 'le module de la primitive qui pose la classe (roll-shell, roll-line, dice-roll, option-chooser, vs-header)'],
  ['prow', 'roll-row.css'],
  ['rr-', 'roll-panel.css'],
  ['mrl', 'multi-roll-list.css'],
  ['crit-', 'reveal-body.css'],
  ['recap-', 'recap-line.css'],
  ['insp-', 'inspect-panel.css'],
  ['eq-', 'equipment-panel.css'],
  ['equip-', 'equipment-panel.css'],
  ['set-', 'equipment-panel.css'],
  ['jr-', 'log-drawer.css'],
  ['cb-', 'combat-banner.css'],
  ['nm-', 'team-segments.css'],
  ['d100', 'dice-roll.css'],
  ['rs-', 'roll-shell.css'],
];

/**
 * EXEMPTIONS AU SITE (`feuille|classe`, jamais au FICHIER) : une collision de PRÉFIXE n'est pas une
 * famille. Les trois classes de l'inspecteur d'éditeur sont posées par le seul `editor/Inspector.tsx`
 * et ne servent AUCUN panneau d'inspection de jeu — l'en-tête, lui, est bien partagé (`.insp-head`,
 * `inspect-panel.css`).
 */
const FAMILLE_EXEMPT_SITES = new Map<string, string>([
  ['src/ui/styles/editor.css|insp-title', 'titre de l’inspecteur d’ÉDITEUR (`editor/Inspector.tsx`), pas du panneau d’inspection'],
  ['src/ui/styles/editor.css|insp-actions', 'barre d’actions de l’inspecteur d’ÉDITEUR'],
  ['src/ui/styles/editor.css|insp-content', 'corps défilant de l’inspecteur d’ÉDITEUR'],
]);

/** Les classes d'une famille JET définies dans un module d'ÉCRAN, avec leur destination. */
export function sitesFamilleEgaree(feuilles: readonly { rel: string; text: string }[]): string[] {
  const primitives = modulesDePrimitive(imageDuDisque().manifeste);
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    if (FEUILLES_PARTAGEES.includes(rel) || primitives.has(rel)) continue;
    for (const r of reglesCss(text)) {
      for (const sel of r.selecteurs) {
        const p = parties(sel);
        if (p.length !== 1) continue;
        const c = classesDe(p[0])[0];
        if (!c || FAMILLE_EXEMPT_SITES.has(`${rel}|${c}`)) continue;
        const fam = FAMILLES_JET.find(([prefixe]) => c.startsWith(prefixe));
        if (fam) out.push(`${rel} : .${c} → ${fam[1]}`);
      }
    }
  }
  return out;
}

describe('#1806 — un module de primitive est le seul foyer de ce qu’il peint', () => {
  const feuilles = imageDuDisque().fichiers;

  it('§5.3 aucun REPEINT neuf d’une classe possédée ailleurs (stock nominatif)', () => {
    const mesures = sitesRepeint(feuilles);
    const neufs = mesures.filter((s) => !REPEINTS_STOCK.includes(s));
    expect(neufs, `Classe REPEINTE hors de son module propriétaire — la matière doit rester UNIQUE :\n${neufs.join('\n')}`).toEqual([]);
    const soldes = REPEINTS_STOCK.filter((s) => !mesures.includes(s));
    expect(soldes, `Entrée(s) SOLDÉE(s) du stock de repeints — retirer la ligne :\n${soldes.join('\n')}`).toEqual([]);
  });

  it('§5.3 preuve par mutation — un écran qui repeint une classe partagée rougit', () => {
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.faux-panneau .btn { color: var(--gold) }' }];
    expect(sitesRepeint(faux)).toEqual(['src/ui/styles/faux-ecran.css|.faux-panneau .btn']);
    const placement = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.faux-panneau .btn { margin-top: var(--sp-md) }' }];
    expect(placement.length && sitesRepeint(placement), 'un PLACEMENT sous contexte d’écran reste légitime').toEqual([]);
  });

  it('§5.3 le SUJET d’une règle n’est pas ce que son `:has()` nomme', () => {
    // `label:has(> .btn)` peint le LABEL, pas le bouton : compter `.btn` pour sujet inventerait un
    // repeint (et la découpe naïve sur `,` inventait en plus une règle « `> .btn)` »).
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: "label:has(> a, > .btn) { color: var(--gold) }" }];
    expect(sitesRepeint(faux)).toEqual([]);
  });

  it('§5.4 aucune famille JET recréée dans un module d’écran', () => {
    const egarees = sitesFamilleEgaree(feuilles);
    expect(egarees, `Famille migrée RECRÉÉE hors du module de sa primitive — sa destination est nommée :\n${egarees.join('\n')}`).toEqual([]);
  });

  it('§5.4 preuve par mutation — une classe de la famille JET dans un module d’écran rougit', () => {
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.rm-neuf { color: var(--gold) }' }];
    expect(sitesFamilleEgaree(faux).length, 'la famille `.rm-*` doit être renvoyée à son module').toBe(1);
  });

  it('§5.4 chaque exemption est un SITE encore RÉEL — une ligne périmée se retire', () => {
    const reels = new Set(
      feuilles.flatMap(({ rel, text }) =>
        reglesCss(text).flatMap((r) =>
          r.selecteurs.flatMap((sel) => {
            const p = parties(sel);
            const c = p.length === 1 ? classesDe(p[0])[0] : undefined;
            return c ? [`${rel}|${c}`] : [];
          }),
        ),
      ),
    );
    const perimees = [...FAMILLE_EXEMPT_SITES.keys()].filter((k) => !reels.has(k));
    expect(perimees, `Exemption(s) PÉRIMÉE(S) — la classe a bougé ou a été migrée :\n${perimees.join('\n')}`).toEqual([]);
  });
});
