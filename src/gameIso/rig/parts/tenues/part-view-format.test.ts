/**
 * FORMAT DE PART — garde de cliquet (#551).
 *
 * Un slot de CORPS se fournit en TROIS vues `{front, profile, back}`. Une `string` est front-only :
 * `resolve.ts` sert alors soit une silhouette GÉNÉRIQUE inventée (torse/jambes/tete), soit l'art de
 * FACE plaqué verbatim (`bras`, qu'aucune substitution ne couvre). Contrat : `rig/PART-CONTRACT.md`.
 *
 * PÉRIMÈTRE : les deux registres qui alimentent les slots de corps de `resolveParts` — les TENUES
 * et les ARMURES. L'armure PRIME sur la tenue (`resolve.ts`, `armed ?? tenuePart`) : hors périmètre,
 * le format restait vert sur une tenue conforme pendant qu'un personnage en plaque recevait un bras
 * de face plaqué. Armes et boucliers restent HORS garde (cf. PART-CONTRACT.md § Périmètre).
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` — partagée avec le régénérateur, pour
 * qu'aucun des deux n'ait sa propre lecture du pipeline. Ici : les trois invariants du cliquet.
 *   1. FORMAT — un slot déclare ses 3 vues.
 *   2. ANTI-ALIAS — une vue déclarée n'est pas le front redessiné à l'identique.
 *   3. PLAFOND — les deux stocks ne peuvent que DÉCROÎTRE : leur taille max est gelée ICI, dans la
 *      garde, et non dans le fichier de stock — une donnée qui porte son propre plafond le relève
 *      d'une ligne. Gonfler exige de toucher les DEUX fichiers, dans le même commit.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './_registry.generated';
import { ARMOUR_DEFS } from '../armour/_registry.generated';
import { slugId } from '../../../../data/slug';
import { auditPartViews, SLOTS, type Audit, type Bearer, type BodySlot } from '../../../../../scripts/guards/lib/partViewAudit';
import type { PartArt } from '../types';
import {
  PART_VIEW_RATCHET,
  PART_VIEW_ALIAS_RATCHET,
} from '../../../../../scripts/guards/lib/rigPartViewStock.mjs';

/** PLAFONDS gelés (#551). Baissés à CHAQUE slot soldé ; jamais relevés — solder = dessiner la vue.
 *  Ils vivent dans la GARDE, pas dans le stock : un stock qui porte son plafond ne cliquette rien.
 *  `scripts/rig/regen-part-view-stock.mts` les rabaisse tout seul après un solde. */
const MAX_FORMAT = 165;
const MAX_ALIAS = 3;

/** Cliquet générique : violations hors stock = neuves (échec) ; clés du stock qui ne violent plus = périmées (échec). */
function ratchet(found: ReadonlySet<string>, stock: ReadonlySet<string>) {
  return {
    neuves: [...found].filter((k) => !stock.has(k)).sort(),
    perimees: [...stock].filter((k) => !found.has(k)).sort(),
  };
}

describe('format de part : 3 vues par slot de corps (cliquet #551)', () => {
  const { format, alias } = auditPartViews();

  it('les clés de stock sont des ids STABLES et sans collision (tenues vs armures)', () => {
    const ids = TENUE_DEFS.map((d) => slugId(d.name));
    expect(new Set(ids).size).toBe(ids.length);
    // Le namespace `armure:` des clés d'armure ne doit croiser aucun id de tenue.
    expect(ids.filter((i) => i === 'armure')).toEqual([]);
  });

  it('aucun slot NEUF en front-only, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(format, PART_VIEW_RATCHET);
    expect(neuves, `Slots front-only NEUFS — fournir {front, profile, back} (cf. rig/PART-CONTRACT.md).\n` +
      `Une string sert une silhouette générique (torse/jambes/tete) ou le front plaqué (bras) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de PART_VIEW_RATCHET qui ne violent plus (soldées ou disparues) — les RETIRER de\n` +
      `scripts/guards/lib/rigPartViewStock.mjs (ou : npx tsx scripts/rig/regen-part-view-stock.mts),\n` +
      `sinon le stock ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE aliasée sur le front, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(alias, PART_VIEW_ALIAS_RATCHET);
    expect(neuves, `Vues DÉCLARÉES dont le DESSIN est celui du front — le format est satisfait, le rendu\n` +
      `reste l'art de face plaqué. Dessiner la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de PART_VIEW_ALIAS_RATCHET qui ne violent plus — les RETIRER de\n` +
      `scripts/guards/lib/rigPartViewStock.mjs :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('les stocks ne GONFLENT pas : leur taille est plafonnée ICI, la baisser est le seul geste permis', () => {
    expect(PART_VIEW_RATCHET.size, `PART_VIEW_RATCHET a GONFLÉ (${PART_VIEW_RATCHET.size} > ${MAX_FORMAT}).\n` +
      `Un slot se solde en DESSINANT ses vues, jamais en allongeant le stock. Après un solde, BAISSER\n` +
      `MAX_FORMAT dans cette garde.`).toBeLessThanOrEqual(MAX_FORMAT);
    expect(PART_VIEW_ALIAS_RATCHET.size, `PART_VIEW_ALIAS_RATCHET a GONFLÉ (${PART_VIEW_ALIAS_RATCHET.size} > ${MAX_ALIAS}).\n` +
      `Après un solde, BAISSER MAX_ALIAS dans cette garde.`).toBeLessThanOrEqual(MAX_ALIAS);
  });
});

/**
 * MORSURE — les évasions par lesquelles on solderait le stock sans dessiner. Chacune a été exécutée
 * contre la garde d'origine et la laissait VERTE au rendu pixel-identique. Elles vivent ici en
 * permanence : une garde dont on ne teste pas les contournements se dégrade sans bruit.
 *
 * Chaque morsure s'assure que la violation est NEUVE au regard du stock RÉEL (`ratchet(...).neuves`
 * non vide) : c'est exactement ce que la garde ci-dessus assert vide. Constater que le détecteur
 * « voit » ne suffirait pas — on vérifie que la garde ROUGIRAIT.
 */
describe('morsure : les évasions connues rougissent (#551)', () => {
  /** Échange l'art d'un slot le temps d'une mesure. `TENUE_BY_ID`/`ARMOUR` indexent le MÊME objet
   *  `def.set` : la mutation traverse `resolveParts` pour de vrai. Restauré même en cas d'échec. */
  function withArt(def: Bearer, slot: BodySlot, art: PartArt, fn: () => Audit): Audit {
    const saved = def.set[slot];
    def.set[slot] = art;
    try { return fn(); } finally { def.set[slot] = saved; }
  }

  /** Premier slot de TENUE conforme (3 vues, dessin distinct du front) — le support des mutations. */
  const target = (() => {
    const { alias } = auditPartViews();
    for (const def of TENUE_DEFS) {
      const id = slugId(def.name);
      for (const slot of SLOTS) {
        const art = def.set[slot];
        if (art && typeof art === 'object' && art.profile && art.back && !alias.has(`${id}:${slot}:back`))
          return { def: def as Bearer, slot, id, front: art.front, art };
      }
    }
    throw new Error('aucun slot de tenue conforme — le corpus a changé, la morsure n\'a plus de support');
  })();

  /** La garde rougirait-elle ? = la violation attendue est NEUVE au regard du stock RÉEL. */
  const aliasNeuves = (back: string) =>
    ratchet(withArt(target.def, target.slot, { ...target.art, back }, auditPartViews).alias, PART_VIEW_ALIAS_RATCHET).neuves;
  const KEY = `${target.id}:${target.slot}:back`;

  it('un alias enveloppé dans un <g> inerte rougit (le <g> ne porte aucune géométrie)', () => {
    expect(aliasNeuves(`<g>${target.front}</g>`)).toContain(KEY);
  });

  it('un alias maquillé par un espace final rougit', () => {
    expect(aliasNeuves(`${target.front} `)).toContain(KEY);
  });

  it('un alias maquillé par un commentaire SVG rougit', () => {
    expect(aliasNeuves(`<!-- dos --> ${target.front}`)).toContain(KEY);
  });

  it('un alias RECOLORÉ (géométrie du front, autre remplissage) rougit — la comparaison de chaînes le ratait', () => {
    const recolore = target.front.replace(/fill=("|')@(\w+)("|')/g, 'fill=$1@$2O$3');
    expect(recolore, 'le support de morsure ne porte aucun token de remplissage').not.toBe(target.front);
    expect(aliasNeuves(recolore)).toContain(KEY);
  });

  it('un slot d\'ARMURE front-only NEUF rougit (le registre des armures est bien dans le périmètre)', () => {
    const plaque = ARMOUR_DEFS.find((d) => d.name === 'plaque')! as unknown as Bearer;
    const torse = plaque.set.torse!;
    const front = typeof torse === 'object' ? torse.front : torse;
    const { format } = withArt(plaque, 'torse', front, auditPartViews); // 3 vues -> string front-only
    expect(ratchet(format, PART_VIEW_RATCHET).neuves).toContain('armure:plaque:torse');
  });

  it('GONFLER le stock rougit : une clé de plus dépasse le plafond', () => {
    expect(new Set([...PART_VIEW_RATCHET, 'gonflement:bras']).size).toBeGreaterThan(MAX_FORMAT);
    expect(new Set([...PART_VIEW_ALIAS_RATCHET, 'gonflement:bras:back']).size).toBeGreaterThan(MAX_ALIAS);
  });
});
