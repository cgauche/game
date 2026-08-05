import { describe, it, expect } from 'vitest';
import { CREATURES } from '../creatures';
import { quadParts, quadAnchor, quadLayersSvg } from './quadParts';
import { DECOS_MORTS_GELES } from './deco-stock.fixture';
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

  /**
   * Contrat POSITIF : une clé `deco` vise UNE vue (`os#vue`) ou LES TROIS (clé nue) — et dans
   * CHACUNE des vues visées, l'os doit porter un art, sinon le décor est peint nulle part. Le
   * stock GELÉ des couples encore perdus (`DECOS_MORTS_GELES`) est la seule exemption, nominative :
   * tout couple mort NOUVEAU rougit ici.
   */
  it('chaque clé `deco` authorée vise un os qui porte un art dans CHACUNE des vues visées', () => {
    const perdus: string[] = [];
    for (const { id, quad } of quadDefs) {
      if (!quad.deco) continue;
      for (const key of Object.keys(quad.deco)) {
        const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
        for (const v of (vue ? [vue] : VIEWS))
          if (!quadParts({ ...quad, deco: undefined }, v)[bone]) perdus.push(`${id} ${v} ${key}`);
      }
    }
    expect(perdus.filter((c) => !DECOS_MORTS_GELES.includes(c)),
      'décor authoré pour une vue où son os n\'est pas émis').toEqual([]);
  });
});
