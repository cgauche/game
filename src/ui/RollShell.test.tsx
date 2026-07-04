import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { testBreakdown, testPending } from './breakdown';

const noop = () => {};

/** Rangée EN ATTENTE (pré-jet) sans `Combatant` — primitives d'influence, testable en `node`. */
const pendingRow = (over: Partial<RollRowData> = {}): RollRowData => ({
  row: { pending: testPending('Athlétisme', 45) },
  rolled: false,
  fortune: 1,
  resilience: 1,
  onRoll: noop,
  onReroll: noop,
  onBonusSL: noop,
  ...over,
});

/** Rangée RÉSOLUE (post-jet) — issue de `testBreakdown`, primitives d'influence. */
const rolledRow = (over: Partial<RollRowData> = {}): RollRowData => ({
  row: { d: testBreakdown('Athlétisme', 45, { roll: 22, target: 45, sl: 2, success: true }) },
  rolled: true,
  fortune: 1,
  resilience: 1,
  rerollable: true,
  onRoll: noop,
  onReroll: noop,
  onBonusSL: noop,
  ...over,
});

const actions: RollAction[] = [
  { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: noop, when: 'pre' },
  { key: 'roll', label: '🎲 Lancer', kind: 'primary', onClick: noop, when: 'pre' },
  { key: 'apply', label: 'Appliquer', kind: 'primary', onClick: noop, when: 'post' },
];

function render(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

describe('RollShell — coquille de jet unifiée', () => {
  it('(a) mono : 1 rangée interactive pré-jet → boutons d’influence (Lancer) présents', () => {
    const html = render(
      <RollShell
        title="Test mono"
        subtitle="Un jet"
        rows={[pendingRow()]}
        rolled={false}
        actions={actions}
        onCancel={noop}
      />,
    );
    expect(html).toContain('Un jet');
    expect(html).toContain('Lancer'); // bouton de jet de la rangée interactive
    expect(html).toContain('45'); // cible pré-jet
    expect(html).not.toContain('Appliquer'); // action 'post' masquée pré-jet
  });

  it('(b) multi : 2 rangées + summary rendu', () => {
    const html = render(
      <RollShell
        title="Test multi"
        variant="test"
        instruction="Chaque rôle lance"
        rows={[rolledRow(), rolledRow({ row: { d: testBreakdown('Voile', 50, { roll: 30, target: 50, sl: 2, success: true }) } })]}
        rolled={true}
        summary={<>DR total <b>+4</b></>}
        actions={actions}
        onCancel={noop}
      />,
    );
    expect(html).toContain('Chaque rôle lance');
    expect(html).toContain('Athlétisme');
    expect(html).toContain('Voile');
    expect(html).toContain('DR total'); // bandeau summary agrégé
  });

  it('(c) rangée témoin (interactive=false) : AUCUN bouton d’influence', () => {
    const interactiveOnly = render(
      <RollShell title="T" rows={[rolledRow()]} rolled actions={[]} onCancel={noop} />,
    );
    const witnessOnly = render(
      <RollShell title="T" rows={[rolledRow({ interactive: false })]} rolled actions={[]} onCancel={noop} />,
    );
    // La rangée interactive expose la relance (Chance) ; la témoin non.
    expect(interactiveOnly).toContain('rm-influence');
    expect(witnessOnly).not.toContain('rm-influence');
  });

  it('(e) opposé : winnerIndex=1 post-jet → rangée 1 = rr-win, rangée 0 = rr-lose', () => {
    const html = render(
      <RollShell
        title="Test opposé"
        variant="test"
        rows={[
          rolledRow(), // rangée 0 (perdante)
          rolledRow({ row: { d: testBreakdown('Opposition', 55, { roll: 12, target: 55, sl: 4, success: true }) }, interactive: false }), // rangée 1 (gagnante, témoin)
        ]}
        rolled
        winnerIndex={1}
        netSL={2}
        actions={[]}
        onCancel={noop}
      />,
    );
    expect(html).toContain('rr-win');
    expect(html).toContain('rr-lose');
    expect(html).toContain('DR net'); // badge agrégé au niveau shell, une seule fois
    // Le badge « DR net » ne doit PAS être dupliqué par rangée (RollRow ne reçoit jamais netSL).
    expect(html.match(/rm-netsl/g)?.length).toBe(1);
  });

  it('(d) actions filtrées par phase : when=pre disparaît après jet, when=post apparaît', () => {
    const pre = render(
      <RollShell title="T" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />,
    );
    const post = render(
      <RollShell title="T" rows={[rolledRow()]} rolled actions={actions} onCancel={noop} />,
    );
    expect(pre).toContain('🎲 Lancer'); // when:'pre'
    expect(pre).not.toContain('Appliquer'); // when:'post' masqué
    expect(post).toContain('Appliquer'); // when:'post'
    expect(post).not.toContain('🎲 Lancer'); // when:'pre' masqué (l'action, pas le bouton de rangée)
  });
});
