import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActiveFrame } from './ActiveFrame';
import type { Combatant } from '../engine/types';

const c = (over: Partial<Combatant>) =>
  ({
    id: 'h', name: 'H', kind: 'hero', wounds: { current: 8, max: 12 }, conditions: [], advantage: 0,
    weapons: [], skills: [], items: [], movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
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

  it('vie via la tuile-portrait UNIFIÉE (ptile-gauge) : une seule surface de vie dans le cadre', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={0} moveMax={0} />);
    expect(html).toContain('ptile-gauge'); // la vie vient de PortraitTile (même affichage partout)
    expect(html).not.toContain('af-hp'); // aucune 2ᵉ surface de vie dans le cadre
  });

  it('ennemi : pas de jauges Action/Mouvement, mais vie + Avantage visibles', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ kind: 'enemy', advantage: 2 })} ring="#f00" isHero={false} actAvail={0} actMax={0} moveLeft={0} moveMax={0} />);
    expect(html).not.toContain('af-action');
    expect(html).not.toContain('af-move');
    expect(html).toContain('ptile-gauge'); // vie via la tuile unifiée
    expect(html).toContain('af-adv');
  });
});

/** Le résumé de ressources SEUL (hors `title`/`aria-label` des jauges, qui portent déjà des `n/m`). */
const resources = (html: string) => {
  const after = html.split('Ressources du tour')[1];
  expect(after, 'aucune liste « Ressources du tour » rendue').toBeTruthy();
  return after.split('</dl>')[0];
};

describe('ActiveFrame — économie du tour nommée en texte', () => {
  it('Action / Mouvement / Avantage : libellé, valeur et aperçu avant → après', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame
        c={c({ advantage: 2 })} ring="#fff" isHero
        actAvail={1} actMax={1} moveLeft={4} moveMax={4}
        spendAction={1} spendMove={2} gainAdv={1}
      />,
    );
    const dl = resources(html);
    expect(dl).toContain('Action');
    expect(dl).toContain('1 → 0');
    expect(dl).toContain('Mouvement');
    expect(dl).toContain('4 → 2');
    expect(dl).toContain('Avantage');
    expect(dl).toContain('2 → 3');
    expect(html).not.toContain('Réaction'); // le HUD n'invente aucune économie que le moteur ne porte pas
    expect(html).toContain('af-action'); // les jauges crantées restent
    expect(html).toContain('ptile-gauge');
  });

  it('sans aperçu : la valeur courante seule, avec son maximum', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({ advantage: 2 })} ring="#fff" isHero actAvail={1} actMax={2} moveLeft={3} moveMax={5} />,
    );
    const dl = resources(html);
    expect(dl).toContain('1/2');
    expect(dl).toContain('3/5');
    expect(dl).not.toContain('→');
  });

  it('ressource à zéro : état TEXTUEL (utilisée / épuisé), pas seulement une couleur', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({})} ring="#fff" isHero actAvail={0} actMax={1} moveLeft={0} moveMax={4} />,
    );
    const dl = resources(html);
    expect(dl).toContain('utilisée');
    expect(dl).toContain('épuisé');
    expect(dl).toContain('data-spent="true"');
  });
});

describe('ActionBar — contrôles conservés (témoin de non-régression)', () => {
  const src = readFileSync(fileURLToPath(new URL('./ActionBar.tsx', import.meta.url)), 'utf8');

  it('garde le commutateur de set d’armes, ses handlers, les slots et Fin du tour', () => {
    expect(src).toContain('ab-loadouts');
    expect(src).toContain('switchLoadout');
    expect(src).toContain('ab-slots');
    expect(src).toContain('Fin du tour');
  });

  it('affiche l’identité du combattant actif dans le panneau latéral', () => {
    expect(src).toContain('<strong>{active.label}</strong>');
    expect(src).toContain('<span>{careerLabelFor(active)}</span>');
  });
});
