/**
 * CHAIR GRAVÉE — garde de cliquet (#583, couture au poignet).
 *
 * `g_flesh` (`fxGradients.ts`) est un dégradé de peau CLAIRE FIXE : une tenue qui le grave au lieu
 * de `@peau`/`@peauO`/`@peauH` ignore la palette de l'espèce qui la porte — sur un personnage à
 * peau non claire, la zone peinte par la tenue reste claire pendant que le reste du corps (résolu
 * en tokens, ex. `HAND`) prend la bonne teinte : couture visible au poignet/collier.
 *
 * PÉRIMÈTRE : interdiction MÉCANISABLE sans faux positif (`url(#g_flesh)` est sans ambiguïté). Les
 * littéraux hex "chair" (`#e2b48c` recopié au lieu du token) sont HORS de cette garde — un détecteur
 * par distance colorimétrique a produit des faux positifs confirmés à la mesure (#583 : `Bailli`
 * réutilise `@peauH`/`@peauO` pour un panache de plume, pas de la chair) : rendu au juge d'art, pas
 * gardé mécaniquement.
 *
 * La MESURE vit dans `scripts/guards/lib/fleshGradientAudit.ts` — partagée avec le régénérateur
 * `scripts/rig/regen-flesh-gradient-stock.mts`, pour qu'aucun des deux n'ait sa propre lecture.
 */
import { describe, it, expect } from 'vitest';
import { auditFleshGradient } from '../../../../../scripts/guards/lib/fleshGradientAudit';
import { FLESH_GRADIENT_RATCHET } from '../../../../../scripts/guards/lib/fleshGradientStock.mjs';
import { TENUE_DEFS } from './_registry.generated';
import { slugId } from '../../../../data/slug';

/** PLAFOND gelé (#583). Baissé à chaque migration soldée ; jamais relevé — solder = migrer vers
 *  `@peau*`, pas allonger le stock. `regen-flesh-gradient-stock.mts` le rabaisse tout seul. */
const MAX_FLESH_GRADIENT = 44;

function ratchet(found: ReadonlySet<string>, stock: ReadonlySet<string>) {
  return {
    neuves: [...found].filter((k) => !stock.has(k)).sort(),
    perimees: [...stock].filter((k) => !found.has(k)).sort(),
  };
}

describe('chair gravée : aucune tenue neuve ne peint un @peau* en g_flesh (cliquet #583)', () => {
  it('aucune occurrence NEUVE de g_flesh, et le stock ne peut que DÉCROÎTRE', () => {
    const found = auditFleshGradient();
    const { neuves, perimees } = ratchet(found, FLESH_GRADIENT_RATCHET);
    expect(neuves, `Occurrences NEUVES de fill="url(#g_flesh)" — peindre avec @peau/@peauO/@peauH\n` +
      `(le token suit l'espèce du porteur, cf. raceAppearance.json) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Clés de FLESH_GRADIENT_RATCHET qui ne gravent plus (migrées ou disparues) — les\n` +
      `RETIRER du stock (ou : npx tsx scripts/rig/regen-flesh-gradient-stock.mts), sinon il ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('le stock ne GONFLE pas : sa taille est plafonnée ICI, la baisser est le seul geste permis', () => {
    expect(FLESH_GRADIENT_RATCHET.size, `FLESH_GRADIENT_RATCHET a GONFLÉ (${FLESH_GRADIENT_RATCHET.size} > ${MAX_FLESH_GRADIENT}).\n` +
      `Une tenue grave sa chair en @peau*, jamais en allongeant le stock. Après une migration, BAISSER\n` +
      `MAX_FLESH_GRADIENT dans cette garde.`).toBeLessThanOrEqual(MAX_FLESH_GRADIENT);
  });
});

/**
 * MORSURE — la garde rougit-elle vraiment sur une chair neuve gravée ? Réintroduit `g_flesh` sur un
 * slot aujourd'hui propre (tokens `@peau*`), vérifie que la clé ressort en `neuves`, puis restaure.
 */
describe('morsure : une chair neuve gravée rougit (#583)', () => {
  /** Premier def dont AUCUN slot n'est déjà au stock — la mutation ne peut pas se confondre avec
   *  une violation existante. */
  const target = (() => {
    const stocked = new Set([...FLESH_GRADIENT_RATCHET].map((k) => k.slice(0, k.indexOf(':'))));
    for (const def of TENUE_DEFS) {
      const id = slugId(def.name);
      if (stocked.has(id)) continue;
      for (const slot of ['bras', 'torse', 'jambes', 'tete'] as const) {
        const art = def.set[slot];
        if (typeof art === 'string' || (art && typeof art === 'object' && art.front)) return { def, id, slot };
      }
    }
    throw new Error('aucun def hors-stock avec un slot exploitable — le corpus a changé, la morsure n\'a plus de support');
  })();

  it('une chair littérale neuve (fill="url(#g_flesh)") rougit la garde', () => {
    const saved = target.def.set[target.slot]!;
    const front = typeof saved === 'string' ? saved : saved.front;
    try {
      target.def.set[target.slot] = `<path d="M0 0 L1 1" fill="url(#g_flesh)" stroke="@peauO"/>${front}`;
      const found = auditFleshGradient();
      const { neuves } = ratchet(found, FLESH_GRADIENT_RATCHET);
      expect(neuves).toContain(`${target.id}:${target.slot}:front`);
    } finally {
      target.def.set[target.slot] = saved;
    }
  });

  it('restaurée, la même tenue redevient verte (aucune clé neuve résiduelle)', () => {
    const found = auditFleshGradient();
    const { neuves } = ratchet(found, FLESH_GRADIENT_RATCHET);
    expect(neuves.filter((k) => k.startsWith(`${target.id}:`))).toEqual([]);
  });

  it('GONFLER le stock rougit : une clé de plus dépasse le plafond', () => {
    expect(new Set([...FLESH_GRADIENT_RATCHET, 'gonflement:bras:front']).size).toBeGreaterThan(MAX_FLESH_GRADIENT);
  });
});
