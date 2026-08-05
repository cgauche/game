/**
 * CONTRAT D'AFFICHAGE DE JET (#1078) — le SOCLE des primitives, vérifié en contrat POSITIF :
 * l'issue d'un jet est une DONNÉE rendue par la coquille, quelle que soit la cardinalité ; chaque
 * rôle du bandeau porte SA classe ; le verbe de `VsHeader` est un vocabulaire FERMÉ (id d'icône) ;
 * la sous-ligne d'une rangée a un canal UNIQUE (`PanelRowData.note` → `.rr-note`).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { buildParticipantRows } from './buildParticipantRows';
import { testBreakdown } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { toRecapLines } from '../state/recapLine';
import type { Combatant } from '../engine/types';

const noop = () => {};

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy'): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

const rolledRow = (label = 'Athlétisme', over: Partial<RollRowData> = {}): RollRowData => ({
  row: { d: testBreakdown(label, 45, { roll: 22, target: 45, sl: 2, success: true }) },
  rolled: true,
  onRoll: noop,
  ...over,
});

const actions: RollAction[] = [{ key: 'confirm', label: 'Appliquer', onClick: noop, when: 'post' }];

describe('RollShell — l’ISSUE se rend à toute cardinalité (#1078)', () => {
  it('une coquille à 2 rangées (jet OPPOSÉ) rend son `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Test opposé"
        rows={[rolledRow(), rolledRow('Esquive', { interactive: false })]}
        rolled
        winnerIndex={1}
        outcome={toRecapLines(['Gustav esquive le coup'])}
        actions={actions}
      />,
    );
    expect(html).toContain('Gustav esquive le coup');
  });

  it('une coquille MULTI (3 rangées) rend son `outcome` — et son `summary` reste un bandeau distinct', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Multi"
        rows={[rolledRow(), rolledRow('Voile'), rolledRow('Rame')]}
        rolled
        outcome={toRecapLines(['La manœuvre passe'])}
        summary={<>DR total +6</>}
        actions={actions}
      />,
    );
    expect(html).toContain('La manœuvre passe');
    expect(html).toContain('DR total +6');
  });

  it('le mono rend toujours son `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="Mono" rows={[rolledRow()]} rolled outcome={toRecapLines(['Réussi'])} actions={actions} />,
    );
    expect(html).toContain('Réussi');
  });
});

describe('RollShell — l’issue est une DONNÉE, rendue par LA coquille (#1078 LOT B1)', () => {
  const combatants = [mk('Gustav', 'hero'), mk('Skaven', 'enemy')];

  it('le CADRE d’issue et la ligne appartiennent à la coquille : `.rm-journal` > `.recap-line`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={toRecapLines(['Le coup porte'])} actions={actions} />,
    );
    const frame = html.slice(html.indexOf('rm-journal'));
    expect(html, 'la coquille pose le cadre elle-même').toContain('class="rm-journal"');
    expect(frame, 'et rend chaque ligne par le renderer UNIQUE').toContain('recap-line');
    expect(frame).toContain('Le coup porte');
  });

  it('une issue produite par `recapLineOfEvent` garde sa coloration PAR CAMP et son icône', () => {
    const line = recapLineOfEvent(ev('damage', 'Gustav frappe Skaven', 'Gustav', 'Skaven'), combatants);
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={[line]} actions={actions} />,
    );
    const frame = html.slice(html.indexOf('rm-journal'));
    expect(frame, 'l’allié se colore').toContain('nm-ally');
    expect(frame, 'l’ennemi aussi').toContain('nm-foe');
    expect(frame, 'et l’icône du kind est rendue').toContain('<svg class="icon"');
  });

  it('une issue VIDE ne pose AUCUN cadre (pas de boîte fantôme)', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={[]} actions={actions} />,
    );
    expect(html).not.toContain('rm-journal');
  });

  it('N lignes d’issue se rendent DANS LE MÊME cadre (une seule boîte)', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={toRecapLines(['Premier fait', 'Second fait'])} actions={actions} />,
    );
    expect(html.split('rm-journal').length - 1, 'un seul cadre').toBe(1);
    expect(html).toContain('Premier fait');
    expect(html).toContain('Second fait');
  });
});

/**
 * CLIQUET (#1078 LOT B1) — le CONTENEUR d'issue `.rm-journal` appartient à la coquille : plus aucun
 * module de `src/` ne l'écrit à la main. Un site qui recomposerait sa boîte d'issue en JSX contournerait
 * le renderer unique — et échapperait au TYPE de `outcome`, qui interdit le JSX et n'expose aucun champ
 * de verdict (que le TEXTE ne redise pas le verdict relève, lui, du CONTRAT).
 * Baseline ZÉRO, sans liste d'exception : `RollShell.tsx` est le seul propriétaire de la classe.
 *
 * Le motif traqué est la SOUS-CHAÎNE, pas une forme d'écriture : `className={'rm-journal'}`,
 * `cx("rm-journal")`, une concaténation, un `class=` de gabarit ou un attribut coupé sur deux lignes
 * sont tous des poses de la classe. Les feuilles CSS sont hors périmètre (la classe y est STYLÉE),
 * les fichiers de test aussi (ce cliquet porte lui-même le motif).
 */
describe('CLIQUET — `.rm-journal` n’est écrit QUE par la coquille', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  const OWNER = 'ui/RollShell.tsx';

  function walk(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p);
    }
    return acc;
  }

  it('aucun module de `src` (hors RollShell) ne pose la classe `rm-journal`', () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const name = f.slice(SRC.length).split('\\').join('/');
      if (name === OWNER) continue;
      const src = readFileSync(f, 'utf8');
      src.split('\n').forEach((l, i) => {
        if (l.includes('rm-journal')) offenders.push(`${name}:${i + 1}`);
      });
    }
    expect(offenders, 'Cadre d’issue recomposé à la main — fournir la DONNÉE (RecapLine[]) à RollShell.outcome :\n' + offenders.join('\n')).toEqual([]);
  });
});

/**
 * CLIQUET (#1078 LOT C1) — l'OPPOSITION A→B a UNE surface : `VsHeader`. La classe `.rm-vs` n'est
 * donc posée QUE par `ui/VsHeader.tsx` : un site qui la repose habille en opposition ce qui n'oppose
 * personne (le sous-titre a `.rm-subtitle`, l'issue agrégée `.rm-summary`, la portée d'un sort
 * `.rm-spellinfo`, la rangée `.prow`) — c'est la confusion de rôles que le LOT A1 a démêlée.
 * Baseline ZÉRO, sans liste d'exception.
 *
 * COUVERTURE : les modules `.ts(x)` de `src` hors tests, COMMENTAIRES RETIRÉS avant le scan — nommer
 * la classe dans une prose de commentaire (`CastModal` explique pourquoi elle ne l'utilise PAS) n'est
 * pas la poser. Reste traqué toute forme d'ÉCRITURE (`className="rm-vs"`, `cx('rm-vs')`,
 * concaténation, gabarit) : c'est la sous-chaîne dans du CODE qui compte, pas un nom d'identifiant.
 */
describe('CLIQUET — `.rm-vs` n’est écrit QUE par `VsHeader`', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  const OWNER = 'ui/VsHeader.tsx';

  function walkSrc(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walkSrc(p, acc);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p);
    }
    return acc;
  }

  /** Retire les commentaires (bloc et ligne) en gardant les sauts de ligne — les numéros de ligne
   *  rapportés restent ceux du fichier. */
  const stripComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1: string) => p1);

  it('aucun module de `src` (hors VsHeader) ne pose la classe `rm-vs`', () => {
    const offenders: string[] = [];
    for (const f of walkSrc(SRC)) {
      const name = f.slice(SRC.length).split('\\').join('/');
      if (name === OWNER) continue;
      stripComments(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
        if (l.includes('rm-vs')) offenders.push(`${name}:${i + 1}`);
      });
    }
    expect(offenders, 'A→B recomposé à la main — composer `VsHeader` (ou la classe du rôle réellement rendu) :\n' + offenders.join('\n')).toEqual([]);
  });
});

describe('RollShell — sous MASQUE, l’issue se tait (#990)', () => {
  /** Rangée dont le DÉ est masqué (`mask: 'roll'`) : le spectateur ne doit rien pouvoir déduire. */
  const maskedRow = (): RollRowData => {
    const r = rolledRow('Furtivité');
    return { ...r, row: { ...r.row, d: { ...r.row.d!, mask: 'roll' } } };
  };

  it('une rangée MASQUÉE fait taire `outcome`, comme le halo et le badge « DR net »', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé masqué"
        rows={[maskedRow(), rolledRow('Perception', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={3}
        outcome={toRecapLines(['Gustav passe inaperçu'])}
        actions={actions}
      />,
    );
    expect(html, 'l’issue dit ce que le dé caché a produit').not.toContain('Gustav passe inaperçu');
    expect(html).not.toContain('rm-netsl');
    expect(html).not.toContain('rr-win');
  });

  it('les MÊMES rangées RÉVÉLÉES rendent leur `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé révélé"
        rows={[rolledRow('Furtivité'), rolledRow('Perception', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={3}
        outcome={toRecapLines(['Gustav passe inaperçu'])}
        actions={actions}
      />,
    );
    expect(html).toContain('Gustav passe inaperçu');
    expect(html).toContain('rm-netsl');
  });
});

describe('RollShell — un RÔLE, une classe (#1078) : la coquille ne pose JAMAIS `.rm-vs`', () => {
  it('le sous-titre (variant roll) porte `.rm-subtitle`, jamais `.rm-vs`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" subtitle="Un jet de Calme" rows={[rolledRow()]} rolled actions={[]} />,
    );
    expect(html).toContain('class="rm-subtitle"');
    expect(html).not.toContain('class="rm-vs"');
  });

  it('le sous-titre (variant test) garde `.test-actor`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" variant="test" subtitle="Un jet" rows={[rolledRow()]} rolled actions={[]} />,
    );
    expect(html).toContain('class="test-actor"');
  });

  it('le bandeau d’issue agrégée porte `.rm-summary`, jamais `.rm-vs`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow(), rolledRow('Voile')]} rolled summary={<>DR total +4</>} actions={[]} />,
    );
    expect(html).toContain('class="rm-summary"');
    expect(html).not.toContain('class="rm-vs"');
  });

  it('`VsHeader` (l’OPPOSITION) garde `.rm-vs`', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} />);
    expect(html).toContain('class="rm-vs"');
  });
});

describe('VsHeader — le verbe est un VOCABULAIRE FERMÉ (décision utilisateur 2026-08-04)', () => {
  it('sans `verb` : glyphe « → » (la direction dit qui agit)', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} />);
    expect(html).toContain('→');
  });

  it('avec `verb` : l’icône du registre est rendue (aucun texte n’est composé)', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} verb="melee/disengage" />);
    const arrow = html.slice(html.indexOf('rm-vs-arrow'));
    expect(arrow).toContain('<svg class="icon"');
    expect(arrow).not.toContain('→');
  });
});

describe('sous-ligne d’une rangée — CANAL UNIQUE `note` (#1078)', () => {
  const parts = [{ id: 'a', interactive: true, result: { roll: 22, target: 45, sl: 2, success: true } }];

  it('la `note` du builder atterrit dans `.rr-note`, sous la ligne de jet', () => {
    const rows = buildParticipantRows(parts, [mk('a', 'hero')], {
      onRoll: noop, onReroll: noop, onBonusSL: noop, onDarkPact: noop, onForce: noop,
      row: (_p, actor, res) => ({ combatant: actor, d: testBreakdown('Voile', 45, { roll: res!.roll, target: res!.target, sl: res!.sl, success: true }) }),
      note: (_p, _a, res) => <span className="cs-outcome">+{res.sl} DR ×2</span>,
    });
    const html = renderToStaticMarkup(<RollShell title="T" rows={rows} rolled actions={[]} />);
    expect(html).toContain('rr-note');
    expect(html.slice(html.indexOf('rr-note'))).toContain('+2 DR ×2');
  });

  it('sans `note`, la rangée ne rend aucune sous-ligne', () => {
    const rows = buildParticipantRows(parts, [mk('a', 'hero')], {
      onRoll: noop, onReroll: noop, onBonusSL: noop, onDarkPact: noop, onForce: noop,
      row: (_p, actor) => ({ combatant: actor, d: testBreakdown('Voile', 45, { roll: 22, target: 45, sl: 2, success: true }) }),
    });
    const html = renderToStaticMarkup(<RollShell title="T" rows={rows} rolled actions={[]} />);
    expect(html).not.toContain('rr-note');
  });
});
