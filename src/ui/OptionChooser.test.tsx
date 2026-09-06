import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptionChooser, ChoiceButtons, type RollOption } from './OptionChooser';
import { optionValue, optionPending } from './breakdown';

describe('OptionChooser — sélecteur d’options de jet partagé', () => {
  const seg: RollOption[] = [
    { key: 'parade', label: 'Parade', value: 55, selected: true, title: 'Parer' },
    { key: 'esquive', label: 'Esquive', value: 48, title: 'Esquiver' },
  ];

  it('layout seg : segmented control, mini-titre, valeur effective, option active = classe `on`', () => {
    const html = renderToStaticMarkup(<OptionChooser layout="seg" groupLabel="Réaction" options={seg} />);
    expect(html).toContain('class="seg"');
    expect(html).toContain('Réaction'); // mini-titre du groupe
    expect(html).toContain('Parade');
    expect(html).toContain('55'); // valeur effective affichée à côté du libellé
    expect(html).toContain('Esquive');
    expect(html).toContain('48');
    // L'option sélectionnée porte la classe `on`, pas l'autre.
    expect(html).toMatch(/class="on"[^>]*>\s*Parade/);
    expect(html).not.toMatch(/class="on"[^>]*>\s*Esquive/);
  });

  it('layout grid : `.rm-loc-grid` de `.btn small`, primary, valeur entre parenthèses, masquage et désactivation', () => {
    const opts: RollOption[] = [
      { key: 'sacrifice', label: "Sacrifier l'Avantage" },
      { key: 'esquive', label: '🤸 Esquiver', value: 48, primary: true },
      { key: 'fuir', label: '🏃 Fuir', disabled: true },
      { key: 'cache', label: 'Caché', hidden: true },
    ];
    const html = renderToStaticMarkup(<OptionChooser layout="grid" options={opts} />);
    expect(html).toContain('class="rm-loc-grid"');
    // L'option PRIMARY porte les trois classes — leur ORDRE n'est pas le contrat (`grid` et `actions`
    // passent par la même composition depuis #1689 T2, qui compose `btn`/`btn-primary` avant `small`).
    const primary = html.match(/<button class="([^"]*)"[^>]*>🤸 Esquiver/)?.[1]?.split(' ') ?? [];
    expect(primary).toEqual(expect.arrayContaining(['btn', 'btn-primary', 'small']));
    expect(html).toContain('(48)'); // valeur entre parenthèses en grille
    expect(html).toContain('disabled'); // option désactivée (MUETTE : elle ne porte pas de `refus`)
    expect(html).not.toContain('Caché'); // option masquée non rendue
  });

  it('layout actions : `.modal-actions` de `.btn` (primary/ghost)', () => {
    const opts: RollOption[] = [
      { key: 'subir', label: 'Subir la mutation' },
      { key: 'renier', label: 'Je te renie !', primary: true },
      { key: 'renoncer', label: 'Renoncer', ghost: true },
    ];
    const html = renderToStaticMarkup(<OptionChooser layout="actions" options={opts} />);
    expect(html).toContain('class="modal-actions"');
    expect(html).toContain('btn btn-primary');
    expect(html).toContain('btn btn-ghost');
  });

  it('content : rendu custom à la place de `label value` (ex. portraits)', () => {
    const opts: RollOption[] = [{ key: 'k', label: 'ignoré', value: 10, content: <span className="portrait-x" /> }];
    const html = renderToStaticMarkup(<OptionChooser layout="grid" options={opts} />);
    expect(html).toContain('portrait-x');
    expect(html).not.toContain('ignoré'); // le content remplace le label
    expect(html).not.toContain('(10)');
  });

  it('ChoiceButtons = OptionChooser en barre d’actions', () => {
    const opts: RollOption[] = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B', primary: true }];
    expect(renderToStaticMarkup(<ChoiceButtons options={opts} />)).toBe(
      renderToStaticMarkup(<OptionChooser layout="actions" options={opts} />),
    );
  });
});

describe('optionValue / optionPending — forme unique pré-jet', () => {
  it('optionValue = base + combineMods (plafonds de Difficulté inclus)', () => {
    expect(optionValue(40, [{ label: 'Avantage', value: 10, famille: 'jet' }])).toBe(50);
    // Malus plafonné à −30 (Très Difficile) : 40 + (−40 plafonné −30) = 10.
    expect(optionValue(40, [{ label: 'X', value: -40, famille: 'circonstance' }])).toBe(10);
    // `famille: 'jet'` (Avantage, hors table `LDB 14 l.48`) échappe au plafond des bonus.
    expect(optionValue(40, [{ label: 'Avantage', value: 100, famille: 'jet' }])).toBe(140);
  });

  it('optionPending : { label, base, mods } ; cible omise par défaut, fournie si plafonnée', () => {
    expect(optionPending('Parade', 45, [{ label: 'Avantage', value: 10, famille: 'jet' }])).toEqual({
      label: 'Parade',
      base: 45,
      mods: [{ label: 'Avantage', value: 10, famille: 'jet' }],
    });
    expect(optionPending('Corps à corps', 38, [], 98)).toEqual({ label: 'Corps à corps', base: 38, mods: [], target: 98 });
  });
});
