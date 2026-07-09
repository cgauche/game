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

// Les hooks/modales NE fournissent PLUS de « Lancer » : la coquille le hisse dans `.modal-actions`
// pour le cas mono. Les actions sont donc seulement Annuler (pré) + Appliquer (post).
const actions: RollAction[] = [
  { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: noop, when: 'pre' },
  { key: 'apply', label: 'Appliquer', kind: 'primary', onClick: noop, when: 'post' },
];

function render(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

/** Extrait le contenu de la barre `.modal-actions` (div à profondeur équilibrée) pour vérifier OÙ est un bouton. */
function actionsBar(html: string): string {
  const start = html.indexOf('<div class="modal-actions">');
  if (start < 0) return '';
  const contentStart = start + '<div class="modal-actions">'.length;
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = contentStart;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(contentStart, m.index);
  }
  return html.slice(contentStart);
}

describe('RollShell — coquille de jet unifiée', () => {
  it('(a) mono : 1 rangée interactive pré-jet → « Lancer » HISSÉ dans la barre `.modal-actions`', () => {
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
    expect(html).toContain('45'); // cible pré-jet
    expect(html).not.toContain('Appliquer'); // action 'post' masquée pré-jet
    // Le « Lancer » vit dans `.modal-actions` (même niveau qu'Annuler), jamais dans la rangée.
    const bar = actionsBar(html);
    expect(bar).toContain('Lancer'); // Lancer hissé DANS la barre
    expect(bar).toContain('Annuler'); // à côté d'Annuler (pré-jet)
    // La rangée (`prow-act`) ne rend plus le bouton Lancer inline.
    const beforeBar = html.slice(0, html.indexOf('<div class="modal-actions">'));
    expect(beforeBar).not.toContain('Lancer');
  });

  it('(f) mono : « Lancer » dans la barre, pré-jet — masqué après le jet', () => {
    const pre = render(<RollShell title="T" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />);
    const post = render(<RollShell title="T" rows={[rolledRow()]} rolled actions={actions} onCancel={noop} />);
    expect(actionsBar(pre)).toContain('Lancer'); // hissé pré-jet
    expect(post).not.toContain('🎲 Lancer'); // rien à hisser post-jet (rangée déjà lancée)
  });

  it('(g) multi : 2 rangées interactives non lancées → « Lancer » PAR RANGÉE, PAS hissé dans la barre', () => {
    const html = render(
      <RollShell
        title="Multi"
        rows={[pendingRow(), pendingRow({ row: { pending: testPending('Voile', 50) } })]}
        rolled={false}
        actions={actions}
        onCancel={noop}
      />,
    );
    // ≥2 rangées à lancer → aucun hissage : le Lancer reste dans les rangées (`prow-act`), pas dans la barre.
    expect(actionsBar(html)).not.toContain('Lancer');
    const beforeBar = html.slice(0, html.indexOf('<div class="modal-actions">'));
    expect(beforeBar).toContain('Lancer'); // les deux boutons de rangée
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

  // ── Garde de vocabulaire d'actions (#211) : la barre d'une modale de jet est verrouillée à
  //    (verbes DÉCLARÉS du flux ∪ commandes neutres). Choke-point unique : `RollShell` + `flowKey`. ──
  const act = (key: string): RollAction => ({ key, label: key, kind: 'primary', onClick: noop, when: 'always' });

  it('(h) garde : actions NEUTRES (cancel/rollAll/confirm) passent pour tout flux', () => {
    expect(() =>
      render(<RollShell flowKey="crewTest" title="T" rows={[rolledRow()]} rolled actions={[act('cancel'), act('rollAll'), act('confirm')]} />),
    ).not.toThrow();
  });

  it('(i) garde : un verbe DÉCLARÉ du flux passe (resist ∈ cascade)', () => {
    expect(() =>
      render(<RollShell flowKey="cascade" title="T" rows={[rolledRow()]} rolled actions={[act('resist')]} />),
    ).not.toThrow();
  });

  it('(j) garde : action FANTÔME (hors verbes déclarés + neutres) LÈVE', () => {
    // 'resist' n'est PAS déclaré par le flux `test` (ni neutre) → dérive rejetée.
    expect(() =>
      render(<RollShell flowKey="test" title="T" rows={[rolledRow()]} rolled actions={[act('resist')]} />),
    ).toThrow(/hors vocabulaire/);
    // clé inventée sur un flux qui ne la déclare pas.
    expect(() =>
      render(<RollShell flowKey="crewTest" title="T" rows={[rolledRow()]} rolled actions={[act('zorglub')]} />),
    ).toThrow(/hors vocabulaire/);
  });

  it('(k) garde : sans flowKey, inerte (modale sans flux naturel)', () => {
    expect(() =>
      render(<RollShell title="T" rows={[rolledRow()]} rolled actions={[act('zorglub')]} />),
    ).not.toThrow();
  });

  it('(d) actions filtrées par phase : Annuler (pre) disparaît après jet, Appliquer (post) apparaît', () => {
    const pre = render(
      <RollShell title="T" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />,
    );
    const post = render(
      <RollShell title="T" rows={[rolledRow()]} rolled actions={actions} onCancel={noop} />,
    );
    expect(pre).toContain('Annuler'); // when:'pre'
    expect(pre).not.toContain('Appliquer'); // when:'post' masqué
    expect(post).toContain('Appliquer'); // when:'post'
    expect(post).not.toContain('Annuler'); // when:'pre' masqué
    // Le « Lancer » hissé (mono) suit la même phase : présent pré-jet, absent post-jet.
    // (Le préfixe 🎲 est désormais l'icône <Icon id="nav/dice"> — on vérifie le libellé texte.)
    expect(pre).toContain('Lancer');
    expect(post).not.toContain('Lancer');
  });
});
