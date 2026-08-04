/**
 * VUES DES PARTS hors slots de corps — garde de cliquet (#1082).
 *
 * PÉRIMÈTRE MESURÉ : les registres `parts/monster/defs/` (parts monstrueuses du bipède) et
 * `parts/elements/defs/` (catalogue d'apparence : cornes, ailes, oreilles, écailles…). Les slots de
 * CORPS (tenues + armures) ont leur propre cliquet (`parts/tenues/part-view-format.test.ts`) ; les
 * autres plans de corps (quadrupède, nuées, navires) ne sont PAS mesurés ici.
 *
 * Ces deux familles ne passent pas par `resolveParts` : leur repli est SILENCIEUX — `pickView`
 * (`parts/types.ts`) sert le front tel quel côté monstre, et le filtre
 * `if (ov.view && ov.view !== view) continue` (`composeRig.tsx`) émet un overlay sans `view` à
 * l'identique dans les trois vues.
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`) — partagée avec le
 * régénérateur `scripts/rig/regen-rig-view-stock.mts`. Ici : les quatre invariants du cliquet.
 *   1. FORMAT — la vue est déclarée quelque part.
 *   2. ANTI-ALIAS — une vue déclarée n'a pas la géométrie du front.
 *   3. ANTI-TRANSFORM — une vue déclarée ne réutilise pas le contenu du front sous un `<g transform>`.
 *   4. PLAFOND — les trois stocks ne peuvent que DÉCROÎTRE : leurs tailles max sont gelées ICI, dans
 *      la garde, et non dans le fichier de stock.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTER_PARTS } from './_registry.generated';
import { ELEMENT_DEFS } from '../elements/_registry.generated';
import type { ElementOverlay } from '../elements/types';
import { auditRigPartViews, isTransformDerived, clesNeuves } from '../../../../../scripts/guards/lib/partViewAudit';
import {
  RIG_VIEW_FORMAT_RATCHET,
  RIG_VIEW_ALIAS_RATCHET,
  RIG_VIEW_TRANSFORM_RATCHET,
} from '../../../../../scripts/guards/lib/rigViewStock.mjs';

/** PLAFONDS gelés (#1082). Baissés à CHAQUE vue soldée ; jamais relevés — solder = dessiner la vue.
 *  `scripts/rig/regen-rig-view-stock.mts` les rabaisse tout seul après un solde. */
const MAX_RIG_FORMAT = 123;
const MAX_RIG_ALIAS = 4;
const MAX_RIG_TRANSFORM = 0;

function ratchet(found: ReadonlySet<string>, stock: ReadonlySet<string>) {
  return {
    neuves: clesNeuves(found, stock),
    perimees: [...stock].filter((k) => !found.has(k)).sort(),
  };
}

describe('vues des parts monstre + éléments : cliquet à trois dimensions (#1082)', () => {
  const { format, alias, transform } = auditRigPartViews();

  it('les clés de def sont uniques dans chaque registre', () => {
    const monstre = MONSTER_PARTS.map((p) => `${p.slot}:${p.key}`);
    expect(new Set(monstre).size).toBe(monstre.length);
    const elements = ELEMENT_DEFS.map((e) => e.key);
    expect(new Set(elements).size).toBe(elements.length);
  });

  it('aucune vue NEUVE non déclarée, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(format, RIG_VIEW_FORMAT_RATCHET);
    expect(neuves, `Vues NON DÉCLARÉES neuves — l'art de face est servi à cette vue (repli de\n` +
      `pickView / du filtre d'overlay). Déclarer la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de RIG_VIEW_FORMAT_RATCHET qui ne violent plus — les RETIRER de\n` +
      `scripts/guards/lib/rigViewStock.mjs (ou : npx tsx scripts/rig/regen-rig-view-stock.mts) :\n` +
      `  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE aliasée sur le front, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(alias, RIG_VIEW_ALIAS_RATCHET);
    expect(neuves, `Vues DÉCLARÉES dont la GÉOMÉTRIE est celle du front — la déclaration est\n` +
      `satisfaite, le rendu reste l'art de face. Dessiner la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de RIG_VIEW_ALIAS_RATCHET qui ne violent plus — les RETIRER de\n` +
      `scripts/guards/lib/rigViewStock.mjs :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE dérivée par TRANSFORM, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(transform, RIG_VIEW_TRANSFORM_RATCHET);
    expect(neuves, `Vues DÉCLARÉES qui reprennent le contenu du front sous une enveloppe de\n` +
      `transform : la silhouette tourne, l'occlusion n'est pas redessinée :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de RIG_VIEW_TRANSFORM_RATCHET qui ne violent plus — les RETIRER de\n` +
      `scripts/guards/lib/rigViewStock.mjs :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('les stocks ne GONFLENT pas : leur taille est plafonnée ICI, la baisser est le seul geste permis', () => {
    expect(RIG_VIEW_FORMAT_RATCHET.size,
      `RIG_VIEW_FORMAT_RATCHET a GONFLÉ (${RIG_VIEW_FORMAT_RATCHET.size} > ${MAX_RIG_FORMAT}). Une vue se\n` +
      `solde en la DESSINANT, jamais en allongeant le stock. Après un solde, BAISSER MAX_RIG_FORMAT.`).toBeLessThanOrEqual(MAX_RIG_FORMAT);
    expect(RIG_VIEW_ALIAS_RATCHET.size,
      `RIG_VIEW_ALIAS_RATCHET a GONFLÉ (${RIG_VIEW_ALIAS_RATCHET.size} > ${MAX_RIG_ALIAS}).`).toBeLessThanOrEqual(MAX_RIG_ALIAS);
    expect(RIG_VIEW_TRANSFORM_RATCHET.size,
      `RIG_VIEW_TRANSFORM_RATCHET a GONFLÉ (${RIG_VIEW_TRANSFORM_RATCHET.size} > ${MAX_RIG_TRANSFORM}).`).toBeLessThanOrEqual(MAX_RIG_TRANSFORM);
  });
});

/**
 * MORSURE — chaque dimension du détecteur est vue ROUGE sur une violation fabriquée, mesurée sur le
 * chemin réel (l'art du registre est échangé le temps d'une mesure, puis restauré).
 *
 * PÉRIMÈTRE de la dimension TRANSFORM, mesuré : elle voit la reprise du front sous un `transform`
 * DÉCLARÉ — enveloppe `<g transform=…>` ou attribut porté par chaque forme. Deux reprises restent
 * DEHORS, car elles réécrivent les coordonnées : la recopie translatée numériquement (chaque nombre
 * +0.1) et le miroir réécrit à la main (coordonnées opposées, aucun `transform`). Les séparer d'un
 * vrai dessin de vue demande un appariement de tracés à la tolérance près ; `isTransformDerived`
 * compare des signatures textuelles (`scripts/guards/lib/partViewAudit.ts`).
 */
describe('morsure : les trois dimensions rougissent (#1082)', () => {
  /** Premier def monstre déclarant profile ET back — support des mutations. */
  const target = (() => {
    for (const p of MONSTER_PARTS)
      if (typeof p.art === 'object' && p.art.profile && p.art.back)
        return { part: p, art: p.art as { front: string; back: string; profile: string } };
    throw new Error('aucune part monstre à 3 vues — le corpus a changé, la morsure n\'a plus de support');
  })();
  const KEY = `monstre:${target.part.slot}:${target.part.key}:back`;

  function withBack(back: string | undefined, dim: 'format' | 'alias' | 'transform') {
    const saved = target.part.art;
    target.part.art = back == null ? target.art.front : { ...target.art, back };
    try {
      return ratchet(auditRigPartViews()[dim], {
        format: RIG_VIEW_FORMAT_RATCHET, alias: RIG_VIEW_ALIAS_RATCHET, transform: RIG_VIEW_TRANSFORM_RATCHET,
      }[dim]).neuves;
    } finally { target.part.art = saved; }
  }

  it('une part rendue front-only rougit la dimension FORMAT', () => {
    expect(withBack(undefined, 'format')).toContain(KEY);
  });

  it('une vue de dos recopiée du front rougit la dimension ALIAS', () => {
    expect(withBack(target.art.front, 'alias')).toContain(KEY);
  });

  it('une vue de dos = front enveloppé d\'un rotate rougit la dimension TRANSFORM', () => {
    expect(withBack(`<g transform="rotate(180)">${target.art.front}</g>`, 'transform')).toContain(KEY);
  });

  it('une vue de dos = front dont CHAQUE forme porte son propre transform rougit la dimension TRANSFORM', () => {
    const miroir = target.art.front.replace(/<(path|ellipse|rect|circle|polygon)\b/g, '<$1 transform="scale(-1,1)"');
    expect(miroir, 'le front doit porter au moins une forme à transformer').not.toBe(target.art.front);
    expect(withBack(miroir, 'transform')).toContain(KEY);
  });

  it('SOLDER une violation la rend PÉRIMÉE : le stock ne peut pas garder une clé morte', () => {
    const cle = [...RIG_VIEW_FORMAT_RATCHET].find((k) => k.startsWith('monstre:'));
    expect(cle, 'le stock FORMAT doit porter au moins une clé monstre pour ce contrat').toBeDefined();
    const [, slot, key] = cle!.split(':');
    const part = MONSTER_PARTS.find((p) => p.slot === slot && p.key === key)!;
    const saved = part.art;
    part.art = { front: '<path d="M0 0 L1 1"/>', profile: '<path d="M2 2 L7 3"/>', back: '<path d="M4 8 L9 5"/>' };
    try {
      expect(ratchet(auditRigPartViews().format, RIG_VIEW_FORMAT_RATCHET).perimees).toContain(cle);
    } finally { part.art = saved; }
  });

  it('l\'enveloppe est vue même quand la chaîne du front n\'est PAS incluse telle quelle', () => {
    const front = '<g><path d="M0 0 L1 1"/></g>';
    const back = '<g transform="scale(-1,1)"><path d="M0 0 L1 1"/></g>';
    expect(back.includes(front)).toBe(false);
    expect(isTransformDerived(front, back)).toBe(true);
    expect(isTransformDerived(front, '<g><path d="M0 0 L2 9"/></g>')).toBe(false);
  });

  it('une vue de dos = front recoloré, sans transform, rougit la dimension ALIAS (géométrie identique)', () => {
    const recolore = target.art.front.replace(/fill=("|')@(\w+)("|')/g, 'fill=$1@$2O$3');
    expect(recolore).not.toBe(target.art.front);
    expect(withBack(recolore, 'alias')).toContain(KEY);
  });

  it('les plafonds sont COLLÉS aux stocks : aucun mou où loger une clé de plus', () => {
    const msg = (n: string) => `${n} : le plafond doit valoir EXACTEMENT la taille du stock. Plus haut, ` +
      `une violation neuve entre sans que la garde bronche ; plus bas, un solde n'a pas été reporté ` +
      `(npx tsx scripts/rig/regen-rig-view-stock.mts).`;
    expect(MAX_RIG_FORMAT, msg('MAX_RIG_FORMAT')).toBe(RIG_VIEW_FORMAT_RATCHET.size);
    expect(MAX_RIG_ALIAS, msg('MAX_RIG_ALIAS')).toBe(RIG_VIEW_ALIAS_RATCHET.size);
    expect(MAX_RIG_TRANSFORM, msg('MAX_RIG_TRANSFORM')).toBe(RIG_VIEW_TRANSFORM_RATCHET.size);
  });
});

/**
 * MORSURE de la branche ÉLÉMENTS — la même mesure, sur l'autre registre. Un def d'apparence est
 * injecté dans `ELEMENT_DEFS` le temps d'une mesure, puis retiré (`finally`). Ce que le runtime fait
 * de ces calques : `composeRig.tsx:267` émet un overlay SANS `view` à l'identique dans les trois
 * vues, et n'émet rien pour un `svg` vide (`if (!ovSvg) continue`, `composeRig.tsx:276`).
 */
describe('morsure : la branche ÉLÉMENTS du détecteur rougit (#1082)', () => {
  const K = 'audit-morsure-element';
  function withElement(overlays: ElementOverlay[]): Set<string> {
    ELEMENT_DEFS.push({ key: K, label: 'Morsure (audit)', category: 'trait', overlays });
    try { return auditRigPartViews().format; } finally { ELEMENT_DEFS.pop(); }
  }

  it('un calque `svg` sans `view` rougit les DEUX vues en FORMAT', () => {
    const format = withElement([{ bone: 'tete', svg: '<path d="M0 0 L5 5"/>' }]);
    expect(clesNeuves(format, RIG_VIEW_FORMAT_RATCHET))
      .toEqual([`element:${K}:back`, `element:${K}:profile`]);
  });

  it('un calque `svg` sans `view` rougit MÊME quand un autre calque déclare la vue', () => {
    const format = withElement([
      { bone: 'tete', svg: '<path d="M9 9 L1 4"/>', view: 'back' },
      { bone: 'torse', svg: '<path d="M0 0 L5 5"/>' },
    ]);
    expect(clesNeuves(format, RIG_VIEW_FORMAT_RATCHET)).toContain(`element:${K}:back`);
  });

  it('une vue DÉCLARÉE dont l\'art rend vide compte en FORMAT : rien n\'est servi à cette vue', () => {
    const format = withElement([
      { bone: 'tete', svg: '<path d="M0 0 L5 5"/>', view: 'front' },
      { bone: 'tete', svg: '', view: 'back' },
    ]);
    expect(clesNeuves(format, RIG_VIEW_FORMAT_RATCHET)).toContain(`element:${K}:back`);
  });
});

/**
 * BARRIÈRE du régénérateur (`scripts/rig/regen-rig-view-stock.mts`) — elle porte sur l'APPARTENANCE
 * des clés, jamais sur la taille des ensembles, et partage `clesNeuves` avec le cliquet ci-dessus.
 */
describe('barrière du régénérateur de stock (#1082)', () => {
  it('mord à TAILLE ÉGALE : une clé soldée + une clé neuve dans le même geste', () => {
    const stock = new Set(['element:a:back', 'element:b:profile']);
    const mesure = new Set(['element:b:profile', 'element:c:back']);
    expect(mesure.size).toBe(stock.size);
    expect(clesNeuves(mesure, stock)).toEqual(['element:c:back']);
  });

  it('un stock STRICTEMENT soldé passe la barrière', () => {
    expect(clesNeuves(new Set(['element:b:profile']), new Set(['element:a:back', 'element:b:profile']))).toEqual([]);
  });

  it('le régénérateur refuse sur les clés neuves, pas sur une comparaison de tailles', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../../../../scripts/rig/regen-rig-view-stock.mts', import.meta.url)), 'utf8');
    expect(src).toContain('const neuves = clesNeuves(found, stock);');
    expect(src).toContain('if (neuves.length === 0) continue;');
    expect(src, 'une barrière de TAILLES blanchit l\'échange à somme nulle').not.toMatch(/found\.size\s*<=\s*stock\.size/);
  });
});
