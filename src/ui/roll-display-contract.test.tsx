/**
 * CONTRAT D'AFFICHAGE DE JET (#1078 LOT A1) — le SOCLE des primitives, vérifié en contrat POSITIF :
 * l'issue d'un jet se rend quelle que soit la cardinalité, chaque rôle du bandeau porte SA classe,
 * le verbe de `VsHeader` est un vocabulaire FERMÉ (id d'icône), et la sous-ligne d'une rangée a un
 * canal UNIQUE (`PanelRowData.note` → `.rr-note`).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { buildParticipantRows } from './buildParticipantRows';
import { testBreakdown } from './breakdown';
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
        outcome={<p className="rm-journal">Gustav esquive le coup</p>}
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
        outcome={<p className="rm-journal">La manœuvre passe</p>}
        summary={<>DR total +6</>}
        actions={actions}
      />,
    );
    expect(html).toContain('La manœuvre passe');
    expect(html).toContain('DR total +6');
  });

  it('le mono rend toujours son `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="Mono" rows={[rolledRow()]} rolled outcome={<p className="rm-journal">Réussi</p>} actions={actions} />,
    );
    expect(html).toContain('Réussi');
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
        outcome={<p className="rm-journal">Gustav passe inaperçu</p>}
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
        outcome={<p className="rm-journal">Gustav passe inaperçu</p>}
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
