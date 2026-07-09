import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeatherVeil } from './WeatherVeil';
import { AMBIANCE } from '../catalog/ambiance';

/**
 * #239 — la météo AUTHORÉE de scène a un rendu (voile + particules), dispatché par type depuis la
 * DONNÉE (`AMBIANCE.iso.weather`). SSR (env node) : on prouve le mapping, le champ de particules
 * SEEDÉ idempotent, et les garanties de couche (pointer-events none, jamais de picking/peintre).
 */
describe('WeatherVeil — mapping type → voile/particules', () => {
  it('la donnée couvre le vocabulaire de précipitation avec particules, brouillard = voile seul', () => {
    const w = AMBIANCE.iso.weather;
    expect(w.pluie?.particles).toBe('pluie');
    expect(w.neige?.particles).toBe('neige');
    expect(w.tempete?.particles).toBe('averse');
    expect(w.brouillard?.particles).toBeUndefined();
    for (const id of ['pluie', 'brouillard', 'neige', 'tempete'] as const) {
      expect(typeof w[id]?.tint).toBe('string');
      expect(w[id]?.alpha).toBeGreaterThan(0);
    }
  });

  it('clair / absent ne rend rien', () => {
    expect(renderToStaticMarkup(<WeatherVeil weather="clair" />)).toBe('');
    expect(renderToStaticMarkup(<WeatherVeil weather={undefined} />)).toBe('');
  });

  it('brouillard = voile plein écran teinté, pointer-events none, sans particule', () => {
    const html = renderToStaticMarkup(<WeatherVeil weather="brouillard" />);
    expect(html).toContain('pointer-events="none"');
    expect(html).toContain(`fill="${AMBIANCE.iso.weather.brouillard!.tint}"`);
    expect(html).toContain('<rect');
    expect(html).not.toContain('wx-p');
  });

  it('pluie = voile + N stries de pluie animées (densité = donnée)', () => {
    const html = renderToStaticMarkup(<WeatherVeil weather="pluie" />);
    const n = (html.match(/class="wx-p wx-pluie"/g) ?? []).length;
    expect(n).toBe(AMBIANCE.iso.weather.pluie!.density);
    expect(html).toContain('<line');
    expect(html).toContain(`stroke:${AMBIANCE.iso.weather.pluie!.pcolor}`);
  });

  it('neige = pastilles remplies (fill = pcolor), pas de stroke de strie', () => {
    const html = renderToStaticMarkup(<WeatherVeil weather="neige" />);
    expect(html).toContain('class="wx-p wx-neige"');
    expect(html).toContain('<circle');
    expect(html).toContain(`fill:${AMBIANCE.iso.weather.neige!.pcolor}`);
  });

  it('tempete = averse dense', () => {
    const html = renderToStaticMarkup(<WeatherVeil weather="tempete" />);
    const n = (html.match(/class="wx-p wx-averse"/g) ?? []).length;
    expect(n).toBe(AMBIANCE.iso.weather.tempete!.density);
  });

  it('positions SEEDÉES : deux rendus du même type sont identiques (idempotent, zéro Math.random)', () => {
    const a = renderToStaticMarkup(<WeatherVeil weather="neige" />);
    const b = renderToStaticMarkup(<WeatherVeil weather="neige" />);
    expect(a).toBe(b);
  });
});
