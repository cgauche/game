import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skills } from '../data';
import { CHAR_LABELS } from '../engine/types';

/**
 * CLIQUET LEXICAL du LIBELLÉ D'ACTION d'un jet (#1078 LOT C1) — « un signe, un sens »
 * (`docs/charte-ui.md`, section « Contrat d'affichage d'un jet ») : dans le libellé d'étape composé
 * par `composeRollLabel` (`src/state/rollSeam.ts`), la PARENTHÈSE est le détail DÉRIVÉ par le moteur
 * (la compétence) et le TIRET LONG le séparateur acteur/action. Un libellé d'action qui porte
 * lui-même l'un de ces deux signes rend la même ligne ambiguë : « Ilsa — Mal de mer — mauvais temps
 * (Résistance) », « Ilsa — Tonneau d'eau (boire) (Résistance) ».
 *
 * COUVERTURE (un détecteur ne mesure que la sienne) : les deux entrées du slot ACTION, en LITTÉRAL —
 * `actionLabel:` (`RollRequest`/`openPartyTest`/`openWorldTest`) et le 2ᵉ argument de
 * `composeRollLabel(`. Ce que ce scan ne voit PAS : un libellé venu de la DONNÉE (`def.label` d'une
 * Activité, `game.label` d'un jeu de taverne, `hazard.label` d'un péril) — mesuré à la main au
 * 2026-08-05, conforme côté `activities.json` (contexte `mer`) et `tavernGames.json` ; les deux
 * libellés à tiret d'`activities.json` (`semer-dissension-*`) sont de contexte `interlude`, qui
 * n'atteint pas ce slot.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Les deux signes RÉSERVÉS du libellé composé : parenthèse (compétence dérivée) et tiret long
 *  (séparateur acteur/action). La ponctuation restante n'est PAS traquée ici — un nom de règle cité
 *  au Source en porte (« Ça va lâcher, capitaine ! », MDG 13 l.121). */
const RESERVED = /[()—]/;

/** Littéraux en position de LIBELLÉ D'ACTION : `actionLabel: '…'` et `composeRollLabel(x, '…', …)`.
 *  Les trois formes de chaîne sont couvertes ; une interpolation `${…}` n'est PAS un signe réservé
 *  (« Évaluer ${offer.label} » est conforme), seuls les signes ÉCRITS comptent. */
const ACTION_LABEL_RX = /(?:actionLabel:\s*|composeRollLabel\(\s*[^,()]+,\s*)(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

export interface ActionLabelHit { line: number; text: string }

/** Scanne un source et rend les libellés d'action porteurs d'un signe réservé (exporté pour la
 *  preuve fail-closed ci-dessous : le scanner se mesure sur du code SYNTHÉTIQUE, pas seulement sur
 *  l'arbre — un détecteur muet passerait vert sur un arbre déjà propre). */
export function scanActionLabels(src: string): ActionLabelHit[] {
  const hits: ActionLabelHit[] = [];
  for (const m of src.matchAll(ACTION_LABEL_RX)) {
    if (!RESERVED.test(m[2])) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text: m[2] });
  }
  return hits;
}

/**
 * EXEMPTION AU SITE (jamais au fichier) — un seul site, motivé : le péril à dégager est une DONNÉE
 * (`sea-perils.json` : Iceberg / Débris marins / Rocher / Bas-fonds) sans article, et aucune
 * composition nominale ne le recolle sans en inventer un. Le libellé reste tel quel tant que
 * l'arbitrage n'est pas rendu ; l'entrée porte le FICHIER et le TEXTE exact (pas une ligne, qui
 * dérive, ni un fichier entier, qui blanchirait tout ce qu'il contiendra).
 */
const ACTION_LABEL_STOCK: { file: string; text: string }[] = [
  { file: 'src/state/seaVoyageFlow.ts', text: 'Dégagement — ${label}' },
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

describe('CLIQUET — le libellé d’ACTION d’un jet ne porte ni parenthèse ni tiret long (#1078)', () => {
  it('aucun libellé d’action hors stock ne porte un signe réservé', () => {
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, 'src'))) {
      const rel = relative(ROOT, f).split('\\').join('/');
      for (const h of scanActionLabels(readFileSync(f, 'utf8'))) {
        if (ACTION_LABEL_STOCK.some((s) => s.file === rel && s.text === h.text)) continue;
        offenders.push(`${rel}:${h.line} — « ${h.text} »`);
      }
    }
    expect(
      offenders,
      'Libellé d’action à signe réservé : la parenthèse est la compétence DÉRIVÉE, le tiret long le séparateur acteur/action — écrire un groupe nominal capitalisé (docs/charte-ui.md) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('fail-closed : une parenthèse d’usage SYNTHÉTIQUE est détectée', () => {
    expect(scanActionLabels(`label: composeRollLabel(h, "Tonneau d'eau (boire)", test),`)).toHaveLength(1);
    expect(scanActionLabels(`  actionLabel: 'Recherche active (au port)',`)).toHaveLength(1);
  });

  it('fail-closed : un tiret long de situation SYNTHÉTIQUE est détecté', () => {
    expect(scanActionLabels(`label: composeRollLabel(h, 'Mal de mer — mauvais temps', test),`)).toHaveLength(1);
  });

  it('un groupe nominal conforme passe — l’interpolation n’est pas un signe', () => {
    expect(scanActionLabels(`actionLabel: 'Recherche d’acheteur',`)).toEqual([]);
    expect(scanActionLabels('actionLabel: `Évaluer ${offer.label}`,')).toEqual([]);
    expect(scanActionLabels(`label: composeRollLabel(h, 'Mal de mer par mauvais temps', test),`)).toEqual([]);
  });
});

/**
 * VOLET 2 (#1109) — le LIBELLÉ DE LIGNE d'un pas qui lance (`CascadeStep.rollLabel`) nomme la
 * COMPÉTENCE lancée, jamais la SITUATION : zone Z5 du contrat (`docs/charte-ui.md`). « Mal de mer »,
 * « Scorbut », « Tonneau contaminé » sont des situations — la ligne du jet, elle, dit « Résistance »
 * (précédents mesurés : `state/approach-fear.test.ts`, `state/combat/venin-test.test.ts`).
 *
 * MESURE : un `rollLabel` littéral de `src/state` (les `rollLabel` de `src/ui` sont le libellé du
 * BOUTON « Lancer », `RollRowProps` — autre champ, hors périmètre) doit être un libellé du CATALOGUE
 * — compétence (`skills`), caractéristique (`CHAR_LABELS`), ou compétence + spécialisation entre
 * parenthèses (« Métier (Cartographe) ») — apostrophes normalisées (le catalogue écrit `'`, les sites
 * écrivent parfois `’`). Sinon : entrée NOMINATIVE au stock ci-dessous, plafond COLLÉ et décroissant.
 *
 * ANGLE MORT assumé du volet : un `rollLabel` calculé (`refLabel('skills', …)`, ternaire, variable)
 * n'est pas lu — il est déjà, par construction, un libellé du catalogue.
 */
const norm = (s: string): string => s.replace(/[’‘]/g, "'").trim();
const CATALOGUE_LABELS = new Set<string>([...skills.map((s) => norm(s.label)), ...Object.values(CHAR_LABELS).map(norm)]);

/** Libellé de COMPÉTENCE (ou carac), spécialisation entre parenthèses comprise. */
export function isCompetenceLabel(text: string): boolean {
  const n = norm(text);
  return CATALOGUE_LABELS.has(n) || CATALOGUE_LABELS.has(n.replace(/\s*\([^)]*\)$/, ''));
}

const ROLL_LABEL_RX = /rollLabel:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g;

/** Rend les `rollLabel` littéraux qui nomment autre chose qu'une Compétence (exporté pour la preuve
 *  fail-closed : le scanner se mesure aussi sur du code SYNTHÉTIQUE). */
export function scanRollLabels(src: string): ActionLabelHit[] {
  const hits: ActionLabelHit[] = [];
  for (const m of src.matchAll(ROLL_LABEL_RX)) {
    if (isCompetenceLabel(m[2])) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text: m[2] });
  }
  return hits;
}

/** STOCK NOMINATIF (#1109) — les six sites mesurés le 2026-08-05, chacun nommé par son fichier et son
 *  TEXTE exact. Plafond COLLÉ (longueur exacte) : un site assaini l'abaisse, un site neuf rougit nominativement. */
const ROLL_LABEL_SITUATION_STOCK: { file: string; text: string }[] = [
  { file: 'src/state/seaVoyageFlow.ts', text: 'Tonneau contaminé' },
  { file: 'src/state/seaVoyageFlow.ts', text: "Tonneau d'eau" },
  { file: 'src/state/seaVoyageFlow.ts', text: 'Mal de mer' }, // deux sites (premier voyage / mauvais temps)
  { file: 'src/state/seaVoyageFlow.ts', text: 'Scorbut' },
  { file: 'src/state/seaVoyageFlow.ts', text: 'Épuisement' },
];
const ROLL_LABEL_SITUATION_PLAFOND = 6;

describe('CLIQUET — un `rollLabel` nomme la COMPÉTENCE, pas la situation (#1109)', () => {
  const situationSites = (): string[] => {
    const out: string[] = [];
    for (const f of walk(join(ROOT, 'src', 'state'))) {
      const rel = relative(ROOT, f).split('\\').join('/');
      for (const h of scanRollLabels(readFileSync(f, 'utf8'))) out.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    return out;
  };

  it('aucun site NEUF : tout `rollLabel`-situation est au stock nominatif', () => {
    const inconnus = situationSites().filter(
      (s) => !ROLL_LABEL_SITUATION_STOCK.some((k) => s.startsWith(`${k.file}:`) && s.endsWith(`— « ${k.text} »`)),
    );
    expect(
      inconnus,
      '`rollLabel` qui nomme une SITUATION hors stock — la ligne du jet dit la Compétence lancée (Z5, docs/charte-ui.md ; dette #1109) :\n' + inconnus.join('\n'),
    ).toEqual([]);
  });

  it('plafond COLLÉ et décroissant (#1109)', () => {
    expect(situationSites(), 'Stock #1109 : assainir un site ABAISSE ce plafond, jamais l’inverse.').toHaveLength(ROLL_LABEL_SITUATION_PLAFOND);
  });

  it('fail-closed : un `rollLabel`-situation SYNTHÉTIQUE est détecté, une Compétence passe', () => {
    expect(scanRollLabels(`rollLabel: 'Gueule de bois', base: 40,`)).toHaveLength(1);
    expect(scanRollLabels(`rollLabel: 'Résistance', base: 40,`)).toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Force Mentale', base: 40,`), 'une caractéristique aussi').toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Métier (Cartographe)', base: 40,`), 'compétence + spécialisation').toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Conduite d’attelage', base: 40,`), 'apostrophe typographique').toEqual([]);
  });
});
