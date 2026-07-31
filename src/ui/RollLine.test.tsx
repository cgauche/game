import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RollLine, PendingRollLine } from './RollLine';

describe('RollLine — détail d’un jet pour la modale', () => {
  it('réussite : base + modificateur = cible, le d100, et le DR', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Corps à corps', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2 }} />,
    );
    expect(html).toContain('Corps à corps');
    expect(html).toContain('45'); // base
    expect(html).toContain('55'); // cible
    expect(html).toContain('32'); // d100
    expect(html).toContain('DR');
    expect(html).toContain('✓'); // réussite
  });

  it('échec : marque l’échec (✗) et la cible réduite par un malus', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Parade', base: 40, modifier: -10, target: 30, roll: 67, success: false, sl: -3 }} />,
    );
    expect(html).toContain('Parade');
    expect(html).toContain('30'); // cible après malus
    expect(html).toContain('67'); // d100
    expect(html).toContain('✗'); // échec
  });

  it('détaille les modificateurs étiquetés quand ils reconcilient le total', () => {
    const html = renderToStaticMarkup(
      <RollLine
        d={{ label: 'Projectiles', base: 38, modifier: 60, target: 98, roll: 50, success: true, sl: 4, mods: [{ label: 'Courte portée', value: 40 }, { label: 'Viser', value: 20 }] }}
      />,
    );
    expect(html).toContain('Courte portée');
    expect(html).toContain('Viser');
    expect(html).toContain('+40');
    expect(html).toContain('+20');
  });

  it('n’affiche PAS le détail si les mods ne reconcilient pas le total (ex. rederive partiel)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Projectiles', base: 38, modifier: 40, target: 78, roll: 50, success: true, sl: 3, mods: [{ label: 'Viser', value: 20 }] }} />,
    );
    expect(html).not.toContain('Viser'); // 20 ≠ 40 → repli sur l'affichage groupé
  });

  it('aucun modificateur → « 55 » seul, pas « 55 = 55 »', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Sociabilité', base: 55, modifier: 0, target: 55, roll: 40, success: true, sl: 1 }} />,
    );
    expect(html).toContain('55');
    expect(html).not.toContain('= <b>'); // pas de « = cible » redondant
  });

  it('mods qui s’annulent (+10 / −10) → ligne « 55 » SANS « = », mais chips conservées', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Esquive', base: 55, modifier: 0, target: 55, roll: 40, success: true, sl: 1, mods: [{ label: 'Avantage', value: 10 }, { label: 'Sonné', value: -10 }] }} />,
    );
    expect(html).not.toContain('= <b>');
    expect(html).toContain('Avantage'); // chips toujours visibles pour expliquer le wash
    expect(html).toContain('Sonné');
  });

  it('`mask:\'roll\'` (#990) : ni dé, ni ✓/✗ ±DR, ni cible — un « ? » PAR CELLULE, label et chips conservés', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll', mods: [{ label: 'Avantage', value: 10 }] }} />,
    );
    expect(html).toContain('Force'); // le libellé du jet reste lisible (on sait CE qui est joué)
    expect(html).toContain('Avantage'); // ModChips conservées
    expect(html).toContain('<b>?</b>'); // cellule du dé
    expect(html).toContain('>?</span>'); // cellule ✓/✗ ±DR
    expect(html, 'le dé ne doit pas fuir').not.toContain('class="d100"');
    expect(html, 'le verdict ne doit pas fuir').not.toContain('✓');
    expect(html).not.toContain('✗');
    expect(html, 'ni le DR').not.toContain('DR');
    expect(html, 'sans masquer la CIBLE, le masque fuit par arithmétique').not.toContain('<b>55</b>');
    expect(html, 'aucun accent de verdict : la couleur EST le verdict').not.toContain('rm-roll ok');
    expect(html).not.toContain('rm-roll fail');
  });

  it('`mask:\'value\'` : ligne opaque du marchand — base/cible cachées, dé et DR bien visibles', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Marchandage', base: 42, modifier: 0, target: 42, roll: 67, success: false, sl: -3, mask: 'value' }} />,
    );
    expect(html).not.toContain('<b>42</b>'); // base/cible cachées
    expect(html).toContain('67'); // …mais le dé et le DR restent visibles (non-régression marchand)
    expect(html).toContain('DR');
    expect(html).toContain('✗');
    expect(html).toContain('rm-roll fail');
  });

  it('rangée masquée : les 3 cellules portent un « ? », aucune n’est VIDE, et l’état `.masked` est posé', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll' }} />,
    );
    // Une cellule VIDE dirait « pas de jet » — la doctrine de la primitive est « un ? PAR cellule ».
    expect(html).not.toMatch(/class="rm-roll-calc"[^>]*>\s*<\/span>/);
    expect((html.match(/\?/g) ?? []).length, 'calcul + dé + DR').toBe(3);
    expect(html).toMatch(/rm-roll (masked|[^"]*masked)/);
  });

  it('rangée masquée : le « ? » PORTE son sens (title + aria-label, une seule formulation)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll' }} />,
    );
    const hint = 'Caché jusqu’à votre jet';
    expect((html.match(new RegExp(`aria-label="${hint}"`, 'g')) ?? []).length, 'les 3 cellules masquées').toBe(3);
    expect((html.match(new RegExp(`title="${hint}"`, 'g')) ?? []).length).toBe(3);
  });
});

describe('#990 — géométrie de la ligne masquée : la révélation change les VALEURS, pas la mise en page', () => {
  const css = readFileSync(new URL('./styles/sheet.css', import.meta.url), 'utf8');

  it('l’état `.masked` porte le liseré 3px de la ligne pré-remplie voisine (pas le 1px par défaut)', () => {
    expect(css).toMatch(/\.rm-roll\.masked\s*\{[^}]*border-left:\s*3px/);
  });

  it('les colonnes `auto` (dé, DR) sont RÉSERVÉES sous masque — même invariant que le pré-jet (#362)', () => {
    expect(css, 'sans réservation, « ? » → « 73 » fait glisser la ligne').toMatch(/\.rm-roll\.masked \.rm-roll-dice b\s*\{[^}]*min-width:/);
    expect(css).toMatch(/\.rm-roll\.masked \.rm-roll-sl\s*\{[^}]*min-width:/);
  });
});

describe('PendingRollLine — pré-jet (même règle « pas de = redondant »)', () => {
  it('aucun modificateur → « 55 » seul', () => {
    const html = renderToStaticMarkup(<PendingRollLine p={{ label: 'Sociabilité', base: 55, target: 55 }} />);
    expect(html).toContain('55');
    expect(html).not.toContain('= <b>');
  });

  it('avec modificateur → « 45 +10 = 55 »', () => {
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Corps à corps', base: 45, target: 55, mods: [{ label: 'Avantage', value: 10 }] }} />,
    );
    expect(html).toContain('45');
    expect(html).toContain('= <b>');
    expect(html).toContain('Avantage');
  });
});
