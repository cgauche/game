/**
 * PLANCHE QC DU MOBILIER VOLUMIQUE — elle peint la recette au CAP D'IDENTITÉ, celui-là même qu'une
 * scène montre pour une instance SANS cap (#1680 ligne 16).
 *
 * L'outil de QC est un ŒIL : s'il peint à un autre cap que le repère d'auteur, il montre chaque décor
 * tourné par rapport à ce que la donnée écrit ET à ce que le monde rend — et l'auteur corrige d'après
 * une image fausse. Le défaut mesuré : `ancrageDePlanche` portait `facing: 'N'`, cap d'identité
 * d'AVANT ce lot, donc un demi-tour ; la serrure du `coffre` sortait en `y −0,155` sur la planche
 * contre `y +0,155` en scène.
 *
 * Ce contrat lit le SOURCE de la planche (elle écrit un HTML, pas une valeur exportable) et le tient à
 * la constante NEUTRE : aucun cap littéral n'y est admis, et l'artefact committé porte le bon repère.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CAP_IDENTITE_PROP } from '../../data/props.types';
import { findPropById } from '../../data';
import { buildPropVolumes } from '../builders/propVolumes';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const lire = (rel: string) => readFileSync(join(RACINE, rel), 'utf8');

describe('planche QC des recettes volumiques — le cap peint est le CAP D’IDENTITÉ', () => {
  it('l’ancrage de planche prend la constante, jamais un cap littéral', () => {
    const src = lire('scripts/qc/render-props-volumiques.mts');
    const ancrage = /const ancrageDePlanche = (.*);/.exec(src)?.[1];
    expect(ancrage, 'ancrageDePlanche introuvable : ce contrat ne mesure plus rien').toBeDefined();
    expect(ancrage).toContain('facing: CAP_IDENTITE_PROP');
    expect(ancrage, 'un cap LITTÉRAL dans l’ancrage de planche').not.toMatch(/facing:\s*['"]/);
  });

  it('l’artefact committé annonce le repère courant, jamais un autre', () => {
    const html = lire('public/props-volumiques.html');
    expect(html).toContain(`cap d'identité <code>${CAP_IDENTITE_PROP}</code>`);
    for (const autre of ['N', 'E', 'O'].filter((c) => c !== CAP_IDENTITE_PROP))
      expect(html, `la planche annonce le cap ${autre}`).not.toContain(`cap d'identité <code>${autre}</code>`);
  });

  it('coffre : la planche pose la serrure du côté que la DONNÉE déclare', () => {
    const coffre = findPropById('coffre')!;
    const serrure = coffre.volume!.primitives.find((p) => p.material === 'laiton-dore')!;
    const pts = buildPropVolumes(coffre, { ancre: { x: 0, y: 0 }, facing: CAP_IDENTITE_PROP, baseHeightM: 0 })
      .filter((f) => f.material.id === 'laiton-dore')
      .flatMap((f) => f.poly);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const centre = {
      x: r3((Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2),
      y: r3((Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2),
    };
    expect(centre).toEqual({ x: r3(serrure.center.x), y: r3(serrure.center.y) });
  });
});
