import { flowFromEffects } from '../../state/flow';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene } from '../../state/scene';
import { LogicDock } from './LogicDock';
import { effectSummary } from './EffectList';

function dock(overrides: Partial<Parameters<typeof LogicDock>[0]>) {
  const scene = emptyScene(10, 10);
  return (
    <LogicDock
      scene={scene}
      otherScenes={[]}
      worldMap={null}
      setScene={vi.fn()}
      enemyCreatures={[]}
      warnings={[]}
      onSelectWarning={vi.fn()}
      tab="triggers"
      setTab={vi.fn()}
      open
      setOpen={vi.fn()}
      height={300}
      setHeight={vi.fn()}
      trigSel={null}
      setTrigSel={vi.fn()}
      dlgSel={null}
      setDlgSel={vi.fn()}
      encSel={null}
      setEncSel={vi.fn()}
      onSelectEntity={vi.fn()}
      {...overrides}
    />
  );
}

describe('LogicDock — onglet Rencontres (remplace la modale EncountersEditor)', () => {
  it('affiche les récompenses de victoire (onVictory) de la rencontre sélectionnée', () => {
    const scene = emptyScene(10, 10);
    scene.encounters = [{ id: 'e1', members: [], onVictory: flowFromEffects([{ type: 'giveXp', amount: 20 }]) }];
    const html = renderToStaticMarkup(dock({ scene, tab: 'encounters', encSel: 'e1' }));
    expect(html).toContain('À la victoire'); // section de récompenses
    expect(html).toContain('Donner des PX'); // l'option giveXp du constructeur d'effets
    expect(html).toContain('value="20"'); // le montant câblé à onVictory
    expect(html).toContain('Surprise (embuscade, LDB 13)');
  });
});

describe('LogicDock — onglet Triggers (master-détail, édition LIVE)', () => {
  it('liste les triggers et édite le sélectionné (rect + condition + effets)', () => {
    const scene = emptyScene(10, 10);
    scene.triggers = [
      { id: 'trig-porte', rect: { x: 1, y: 2, w: 3, h: 1 }, once: true, when: { kind: 'flag', expr: 'cle' }, flow: flowFromEffects([{ type: 'journal', text: 'La porte grince' }]) },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'triggers', trigSel: 'trig-porte' }));
    expect(html).toContain('trig-porte');
    expect(html).toContain('Au déclenchement'); // éditeur de Flow (effets · conditions · tests)
    expect(html).toContain('La porte grince');
  });
});

describe('LogicDock — onglet Dialogues (master-détail de nœuds)', () => {
  it('affiche le détail du dialogue sélectionné, un nœud à la fois', () => {
    const scene = emptyScene(10, 10);
    scene.dialogues = [
      {
        id: 'dlg-forgeron',
        start: 'n1',
        nodes: [
          { id: 'n1', text: 'Bonjour voyageur', choices: [{ text: 'Au revoir', next: 'n2' }] },
          { id: 'n2', text: 'Bonne route', choices: [] },
        ],
      },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'dialogues', dlgSel: 'dlg-forgeron' }));
    expect(html).toContain('dlg-forgeron');
    expect(html).toContain('Bonjour voyageur'); // le nœud de départ est édité
    expect(html).toContain('Au revoir'); // résumé du choix replié
    expect(html).toContain('→ n2'); // cible du choix
  });
});

describe('effectSummary — résumés humains des rangées repliées', () => {
  it('résume les effets courants en clair', () => {
    expect(effectSummary({ type: 'giveXp', amount: 50 })).toContain('50 PX');
    expect(effectSummary({ type: 'startCombat', encounter: 'enc-rats' })).toContain('enc-rats');
    expect(effectSummary({ type: 'setFlag', flag: 'porte_ouverte', value: true })).toContain('porte_ouverte');
    expect(effectSummary({ type: 'giveMoney', gold: 2, silver: 5, brass: 0 })).toBe('Argent : 2 CO 5 pa');
    expect(
      effectSummary({ type: 'transition', scene: 'sc-b', entry: 'porte' }, { scenes: [{ id: 'sc-b', nom: 'Taverne', entries: ['porte'] }] }),
    ).toContain('Taverne');
    expect(effectSummary({ type: 'extendedTest', skill: 'crochetage', label: 'Serrure', targetDR: 5 })).toContain('Crochetage');
  });
});
