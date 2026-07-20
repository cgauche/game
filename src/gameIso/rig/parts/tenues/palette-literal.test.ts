/**
 * LITTÉRAL == JETON — garde de cliquet (#583 point 1).
 *
 * Un littéral hex (`fill`/`stroke`/`stop-color`) qui vaut EXACTEMENT une valeur déclarée dans la
 * `palette` du MÊME def aurait dû être le jeton `@<clé>` correspondant. Le recoloriage
 * (`buildTokenMap`/`applyTokenMap`, `palette.ts`) ne peut agir que sur les tokens : un littéral
 * gravé reste figé quel que soit l'espèce/la carrière du porteur — même défaut que la chair
 * gravée (`flesh-gradient.test.ts`), généralisé à TOUTE matière (chair, cuir, tissu, plume…).
 *
 * PÉRIMÈTRE : comparaison EXACTE (distance ZÉRO, insensible casse/guillemets) contre les valeurs
 * déclarées PAR LE MÊME def — sans ambiguïté, sans faux positif possible. Jamais une distance
 * colorimétrique globale (faux positifs confirmés #583 : `Bailli|tete` réutilise `@peauH`/`@peauO`
 * pour un panache de plume, pas de la chair — mais ICI la réponse est la MÊME : littéral == jeton
 * du même def est une faute, peu importe la matière).
 *
 * La MESURE vit dans `scripts/guards/lib/paletteLiteralAudit.ts` — partagée avec le régénérateur
 * `scripts/rig/regen-palette-literal-stock.mts`, pour qu'aucun des deux n'ait sa propre lecture.
 */
import { describe, it, expect } from 'vitest';
import { auditPaletteLiteral } from '../../../../../scripts/guards/lib/paletteLiteralAudit';
import { PALETTE_LITERAL_RATCHET } from '../../../../../scripts/guards/lib/paletteLiteralStock.mjs';
import { TENUE_DEFS } from './_registry.generated';
import { slugId } from '../../../../data/slug';

/** PLAFOND gelé (#583). Baissé à chaque migration soldée ; jamais relevé — solder = remplacer le
 *  littéral par son jeton, pas allonger le stock. `regen-palette-literal-stock.mts` le rabaisse
 *  tout seul. */
const MAX_PALETTE_LITERAL = 1309;

function ratchet(found: ReadonlySet<string>, stock: ReadonlySet<string>) {
  return {
    neuves: [...found].filter((k) => !stock.has(k)).sort(),
    perimees: [...stock].filter((k) => !found.has(k)).sort(),
  };
}

describe('littéral == jeton : aucune tenue neuve ne recopie une valeur de SA palette (cliquet #583)', () => {
  it('aucune occurrence NEUVE, et le stock ne peut que DÉCROÎTRE', () => {
    const found = auditPaletteLiteral();
    const { neuves, perimees } = ratchet(found, PALETTE_LITERAL_RATCHET);
    expect(neuves, `Occurrences NEUVES d'un littéral == valeur de sa PROPRE palette — peindre avec\n` +
      `le jeton @<clé> déclaré (peu importe la matière : chair, cuir, tissu, plume…) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de PALETTE_LITERAL_RATCHET qui ne recopient plus (migrées ou disparues) — les\n` +
      `RETIRER du stock (ou : npx tsx scripts/rig/regen-palette-literal-stock.mts), sinon il ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('le stock ne GONFLE pas : sa taille est plafonnée ICI, la baisser est le seul geste permis', () => {
    expect(PALETTE_LITERAL_RATCHET.size, `PALETTE_LITERAL_RATCHET a GONFLÉ (${PALETTE_LITERAL_RATCHET.size} > ${MAX_PALETTE_LITERAL}).\n` +
      `Une tenue recopie son littéral en jeton, jamais en allongeant le stock. Après une migration,\n` +
      `BAISSER MAX_PALETTE_LITERAL dans cette garde.`).toBeLessThanOrEqual(MAX_PALETTE_LITERAL);
  });
});

/**
 * MORSURE — la garde rougit-elle vraiment sur un littéral neuf == jeton ? Réintroduit un littéral
 * hex identique à une valeur de palette sur un slot aujourd'hui propre, vérifie que la clé ressort
 * en `neuves`, puis restaure. Vérifie aussi le cas insensible-casse/guillemets (piège `Marchand`).
 */
describe('morsure : un littéral neuf == jeton du même def rougit (#583)', () => {
  /** Premier def À PALETTE dont AUCUN slot n'est déjà au stock — la mutation ne peut pas se
   *  confondre avec une violation existante. */
  const target = (() => {
    const stocked = new Set([...PALETTE_LITERAL_RATCHET].map((k) => k.slice(0, k.indexOf(':'))));
    for (const def of TENUE_DEFS) {
      if (!def.palette || Object.keys(def.palette).length === 0) continue;
      const id = slugId(def.name);
      if (stocked.has(id)) continue;
      for (const slot of ['bras', 'torse', 'jambes', 'tete'] as const) {
        const art = def.set[slot];
        if (typeof art === 'string' || (art && typeof art === 'object' && art.front)) return { def, id, slot };
      }
    }
    throw new Error('aucun def À PALETTE hors-stock avec un slot exploitable — le corpus a changé, la morsure n\'a plus de support');
  })();

  it('un littéral == jeton (guillemets doubles) rougit la garde', () => {
    const saved = target.def.set[target.slot]!;
    const front = typeof saved === 'string' ? saved : saved.front;
    const [, hex] = Object.entries(target.def.palette!)[0];
    try {
      target.def.set[target.slot] = `<path d="M0 0 L1 1" fill="${hex}"/>${front}`;
      const found = auditPaletteLiteral();
      const { neuves } = ratchet(found, PALETTE_LITERAL_RATCHET);
      expect(neuves).toContain(`${target.id}:${target.slot}:front#0`);
    } finally {
      target.def.set[target.slot] = saved;
    }
  });

  it('un littéral == jeton (guillemets simples, CASSE différente) rougit aussi la garde', () => {
    const saved = target.def.set[target.slot]!;
    const front = typeof saved === 'string' ? saved : saved.front;
    const [, hex] = Object.entries(target.def.palette!)[0];
    try {
      target.def.set[target.slot] = `<path d='M0 0 L1 1' fill='${hex.toUpperCase()}'/>${front}`;
      const found = auditPaletteLiteral();
      const { neuves } = ratchet(found, PALETTE_LITERAL_RATCHET);
      expect(neuves).toContain(`${target.id}:${target.slot}:front#0`);
    } finally {
      target.def.set[target.slot] = saved;
    }
  });

  it('restaurée, la même tenue redevient verte (aucune clé neuve résiduelle)', () => {
    const found = auditPaletteLiteral();
    const { neuves } = ratchet(found, PALETTE_LITERAL_RATCHET);
    expect(neuves.filter((k) => k.startsWith(`${target.id}:`))).toEqual([]);
  });

  it('GONFLER le stock rougit : une clé de plus dépasse le plafond', () => {
    expect(new Set([...PALETTE_LITERAL_RATCHET, 'gonflement:bras:front']).size).toBeGreaterThan(MAX_PALETTE_LITERAL);
  });
});

/**
 * MORSURE — le contournement exact du juge (2026-07-18) : injecter DES DIZAINES de littéraux
 * NEUFS dans un slot:vue DÉJÀ stocké (au lieu d'un slot vierge). Avant la clé au grain de
 * l'occurrence, `break` à la 1ʳᵉ correspondance rendait ce cas invisible (0 clé neuve, garde
 * verte à tort) — la clé UNIQUE `slot:vue` était déjà dans le stock, donc rien à ajouter.
 */
describe('morsure : 40 littéraux NEUFS dans un slot déjà stocké rougissent (#583, contournement du juge)', () => {
  const stockedKey = [...PALETTE_LITERAL_RATCHET][0];
  const [stockedId, stockedSlot, stockedViewRaw] = stockedKey.split(':') as [string, 'torse' | 'jambes' | 'bras' | 'tete', string];
  const stockedView = stockedViewRaw.slice(0, stockedViewRaw.indexOf('#'));
  const target = TENUE_DEFS.find((d) => slugId(d.name) === stockedId)!;

  it('40 littéraux neufs ajoutés dans un slot déjà fautif produisent 40 clés neuves', () => {
    const saved = target.set[stockedSlot]!;
    const viewsObj = typeof saved === 'string' ? { front: saved } : { ...saved };
    const original = (viewsObj as Record<string, string>)[stockedView]!;
    const [, hex] = Object.entries(target.palette!)[0];
    const injected = Array.from({ length: 40 }, (_, i) => `<circle cx="${i}" cy="0" r="1" fill="${hex}"/>`).join('');
    try {
      (viewsObj as Record<string, string>)[stockedView] = injected + original;
      target.set[stockedSlot] = typeof saved === 'string' ? (viewsObj as Record<string, string>).front : (viewsObj as typeof saved);
      const found = auditPaletteLiteral();
      const { neuves } = ratchet(found, PALETTE_LITERAL_RATCHET);
      const freshKeys = neuves.filter((k) => k.startsWith(`${stockedId}:${stockedSlot}:${stockedView}#`));
      expect(freshKeys.length).toBeGreaterThanOrEqual(40);
    } finally {
      target.set[stockedSlot] = saved;
    }
  });

  it('restaurée, aucune clé neuve résiduelle sur ce def', () => {
    const found = auditPaletteLiteral();
    const { neuves } = ratchet(found, PALETTE_LITERAL_RATCHET);
    expect(neuves.filter((k) => k.startsWith(`${stockedId}:`))).toEqual([]);
  });
});
