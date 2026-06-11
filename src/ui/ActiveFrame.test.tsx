import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActiveFrame } from './ActiveFrame';
import type { Combatant } from '../engine/types';

const c = (over: Partial<Combatant>) =>
  ({
    id: 'h', name: 'H', kind: 'hero', wounds: { current: 8, max: 12 }, conditions: [], advantage: 0,
    weapons: [], skills: [], items: [], movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    ...over,
  }) as unknown as Combatant;

describe('ActiveFrame — jauges crantées à taille fixe', () => {
  it('Avantage : toujours 10 crans, remplis = min(adv, 10)', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ advantage: 13 })} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={2} moveMax={4} />);
    const adv = html.split('af-adv')[1].split('</span>')[0];
    expect((adv.match(/class="on"/g) ?? []).length).toBe(10); // clampé au plafond
    expect((adv.match(/class="(on|off)"/g) ?? []).length).toBe(10); // taille fixe
  });

  it('Mouvement : crans = budget du tour ; Action verticale présente pour un héros', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={2} moveLeft={3} moveMax={5} />);
    const move = html.split('af-move')[1].split('</span>')[0];
    expect((move.match(/class="(on|off)"/g) ?? []).length).toBe(5);
    expect((move.match(/class="on"/g) ?? []).length).toBe(3);
    expect(html).toContain('af-action');
  });

  it('vie via la tuile-portrait UNIFIÉE (ptile-gauge), plus de barre af-hp séparée', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={0} moveMax={0} />);
    expect(html).toContain('ptile-gauge'); // la vie vient de PortraitTile (même affichage partout)
    expect(html).not.toContain('af-hp'); // l'ancienne barre dédiée a disparu
  });

  it('ennemi : pas de jauges Action/Mouvement, mais vie + Avantage visibles', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ kind: 'enemy', advantage: 2 })} ring="#f00" isHero={false} actAvail={0} actMax={0} moveLeft={0} moveMax={0} />);
    expect(html).not.toContain('af-action');
    expect(html).not.toContain('af-move');
    expect(html).toContain('ptile-gauge'); // vie via la tuile unifiée
    expect(html).toContain('af-adv');
  });
});
