import { describe, it, expect } from 'vitest';
import { CREATURES } from '../creatures';
import { quadParts, quadAnchor, quadLayersSvg } from './quadParts';
import type { QuadBoneId, QuadProps } from './quadSkeleton';
import type { View } from '../facing';

/**
 * Contrat du canal `deco` : `quadAnchor(p, os, vue)` EST le repère dans lequel vit l'art de cet os
 * pour cette vue. `quadParts` appose le décor via `quadAnchored` (même transform) — si l'art porte
 * un transform enveloppant que l'ancre ne reproduit pas, le décor authoré sur les coordonnées de
 * l'art atterrit ailleurs (repère implicite resté dans l'assemblage).
 */

const VIEWS: View[] = ['profile', 'front', 'back'];

/** Transform du `<g>` UNIQUE qui enveloppe tout l'art (balancé, couvrant la chaîne entière), sinon ''. */
function wrappingTransform(art: string): string {
  const open = /^<g([^>]*)>/.exec(art);
  if (!open) return '';
  let depth = 0, end = -1;
  const tag = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(art))) {
    if (m[1]) depth--;
    else if (!m[4]) depth++;
    if (depth === 0) { end = tag.lastIndex; break; }
  }
  if (end !== art.length) return '';
  return (/transform="([^"]*)"/.exec(open[1]) ?? ['', ''])[1];
}

const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

describe('quadAnchor = repère de l\'art de l\'os (contrat du canal deco)', () => {
  it('couvre tout le registre quadrupède/ailé', () => {
    expect(quadDefs.length).toBeGreaterThan(20);
  });

  it('chaque décor authoré vit dans le repère que quadAnchor reproduit', () => {
    const divergences: string[] = [];
    let couples = 0;
    for (const { id, quad } of quadDefs) {
      if (!quad.deco) continue;
      for (const view of VIEWS) {
        const nu = quadParts({ ...quad, deco: undefined }, view);
        for (const key of Object.keys(quad.deco)) {
          const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
          if (vue && vue !== view) continue;
          const art = quadLayersSvg(nu[bone]);
          if (!art) continue;
          couples++;
          const ancre = quadAnchor(quad, bone, view);
          const enveloppe = wrappingTransform(art);
          if (ancre !== enveloppe) {
            divergences.push(`${id} ${view} ${key} : ancre="${ancre || '(identité)'}" art="${enveloppe || '(aucun)'}"`);
          }
        }
      }
    }
    expect(couples).toBeGreaterThan(50);
    expect(divergences).toEqual([]);
  });

  it('chaque clé `deco` authorée vise un os qui porte un art dans la vue visée', () => {
    const orphelines: string[] = [];
    for (const { id, quad } of quadDefs) {
      if (!quad.deco) continue;
      for (const key of Object.keys(quad.deco)) {
        const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
        const vues = vue ? [vue] : VIEWS;
        const porte = vues.some((v) => quadParts({ ...quad, deco: undefined }, v)[bone]);
        if (!porte) orphelines.push(`${id} ${key}`);
      }
    }
    expect(orphelines).toEqual([]);
  });
});
