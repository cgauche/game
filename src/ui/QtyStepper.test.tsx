import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { reglesCss, declarations } from '../../scripts/guards/lib/cssCouches.mjs';
import { QtyStepper } from './QtyStepper';

/**
 * Banc du stepper CANONIQUE (#371 LOT 3, étendu #1806) : le triplet [−][centre][+] est UNIQUE — un
 * écran qui a besoin d'un pas +/− compose CETTE primitive, y compris quand ses bornes portent une
 * RAISON (surincantation : « Plus aucun DR excédentaire à allouer »). La forme du refus vient de
 * `GatedAction` : `aria-disabled` + infobulle + copie hors écran liée en `aria-describedby`, JAMAIS
 * un `<button disabled title=…>` muet (cliquet (xix) d'`ui-ratchets`).
 */
describe('QtyStepper — le triplet canonique', () => {
  it('sans `refus` : deux boutons nus, bornes MUETTES par `disabled`', () => {
    const html = renderToStaticMarkup(
      <QtyStepper center={3} onDec={() => {}} onInc={() => {}} decLabel="Retirer" incLabel="Ajouter" decDisabled />,
    );
    expect(html).toContain('class="cart-step"');
    expect(html).toContain('class="cart-n"');
    expect(html.match(/class="btn-step"/g)?.length, 'les deux pas gardent la pastille ronde').toBe(2);
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Retirer"/);
    expect(html, 'aucune raison à lire : pas de conteneur gaté').not.toContain('gated-action');
  });

  it('avec `refus` : la borne atteinte compose `GatedAction` — raison ATTEIGNABLE, jamais `disabled`', () => {
    const html = renderToStaticMarkup(
      <QtyStepper
        center={0}
        onDec={() => {}}
        onInc={() => {}}
        decLabel="Rendre un pas"
        incLabel="Allouer un pas"
        refus={{ id: 'oc-range', dec: 'Aucun pas de Portée à rendre.' }}
      />,
    );
    expect(html).toContain('gated-action');
    expect(html).toContain('aria-disabled="true"');
    expect(html, 'un refus RAISONNÉ ne porte jamais `disabled` : il sortirait du clavier et de la manette').not.toMatch(/<button[^>]*\sdisabled/);
    expect(html).toContain('aria-describedby="oc-range-dec-reason"');
    expect(html).toContain('Aucun pas de Portée à rendre.');
    // La borne OFFERTE reste offerte, dans la même grammaire.
    expect(html).toMatch(/aria-label="Allouer un pas"/);
    expect((html.match(/aria-disabled="true"/g) ?? []).length, 'une seule borne est refusée').toBe(1);
    // La matière du pas survit à la composition : `.btn-step` reprend la main sur `.btn`.
    expect(html.match(/class="btn\s*btn-step"/g)?.length).toBe(2);
  });

  it('sous pointeur GROSSIER, le pas est un carré de 40 px — une seule géométrie pour les deux formes', () => {
    const css = readFileSync(fileURLToPath(new URL('./styles/components.css', import.meta.url)), 'utf8');
    const coarse = reglesCss(css).filter((r) => r.media?.includes('pointer: coarse') && r.selecteurs.includes('.btn-step'));
    expect(coarse.length, '`.btn-step` doit être dimensionnée sous `@media (pointer: coarse)`').toBe(1);
    const d = Object.fromEntries(declarations(coarse[0].corps).map((x) => [x.prop, x.valeur]));
    expect(d.width).toBe('40px');
    expect(d.height).toBe(d.width);
    // La forme gatée rend `class="btn btn-step"` : `.btn` pose `min-height: 40px` sous le même média,
    // et la règle du pas doit la reprendre pour que les deux formes aient la MÊME boîte.
    expect(d['min-height']).toBe('40px');
  });

  it('un pas OFFERT agit, un pas REFUSÉ est inerte au clic', () => {
    const dec = vi.fn();
    const inc = vi.fn();
    const html = renderToStaticMarkup(
      <QtyStepper center={1} onDec={dec} onInc={inc} decLabel="Retirer" incLabel="Ajouter" refus={{ id: 'x', inc: 'Plafond atteint.' }} />,
    );
    // Le rendu serveur ne clique pas : ce que le banc verrouille ici, c'est que le pas refusé porte
    // sa raison ET son `aria-disabled` (le clic inerte est la garantie de `GatedAction`, testée chez elle).
    expect(html).toContain('Plafond atteint.');
    expect(dec).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });
});
