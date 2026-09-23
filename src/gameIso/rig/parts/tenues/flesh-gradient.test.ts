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
import type { Site } from '../../../../../scripts/guards/lib/stock.mjs';
import { FLESH_GRADIENT_RATCHET } from '../../../../../scripts/guards/lib/fleshGradientStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../../scripts/guards/lib/stock.mjs';
import { TENUE_DEFS } from './_registry.generated';

const STOCK = 'scripts/guards/lib/fleshGradientStock.mjs';

/** Cliquet générique : sites hors stock = neuves (échec) ; entrées que plus aucun site ne porte =
 *  périmées (échec). La primitive PARTAGÉE du dépôt, jamais une comparaison locale. Aucun PLAFOND :
 *  ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est l'entrée
 *  `{ fichier, ref, occurrence }` — qui NOMME le def à ouvrir — que la porte de plage voit à l'append. */
const ratchet = (sites: readonly Site[], stock: Iterable<EntreeNominative>) =>
  ecartDuVolet({ sites, stock, ou: STOCK });

describe('chair gravée : aucune tenue neuve ne peint un @peau* en g_flesh (cliquet #583)', () => {
  it('aucune occurrence NEUVE de g_flesh, et le stock ne peut que DÉCROÎTRE', () => {
    const found = auditFleshGradient();
    const { neuves, perimees } = ratchet(found, FLESH_GRADIENT_RATCHET);
    expect(neuves, `Occurrences NEUVES de fill="url(#g_flesh)" — peindre avec @peau/@peauO/@peauH\n` +
      `(le token suit l'espèce du porteur, cf. raceAppearance.json) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de FLESH_GRADIENT_RATCHET qui ne gravent plus (migrées ou disparues) — les\n` +
      `RETIRER du stock (ou : npx tsx scripts/rig/regen-flesh-gradient-stock.mts), sinon il ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME le def de tenue à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = FLESH_GRADIENT_RATCHET
      .filter((e) => !/^src\/gameIso\/rig\/parts\/tenues\/defs\/.+\.ts$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à\n` +
      `\`croissanceDesStocks\`, et un append ne coûterait rien :\n  ${JSON.stringify(muettes)}`).toEqual([]);
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
    const stocked = new Set(FLESH_GRADIENT_RATCHET.map((e) => e.ref.slice(0, e.ref.indexOf(':'))));
    for (const def of TENUE_DEFS) {
      const id = def.id;
      if (stocked.has(id)) continue;
      for (const slot of ['bras', 'torse', 'jambes', 'tete'] as const) {
        const art = def.set[slot];
        if (typeof art === 'string' || (art && typeof art === 'object' && art.front)) return { def, id, slot };
      }
    }
    throw new Error('aucun def hors-stock avec un slot exploitable — le corpus a changé, la morsure n\'a plus de support');
  })();

  it('une chair littérale neuve (fill="url(#g_flesh)") rougit la garde, en NOMMANT son def', () => {
    const saved = target.def.set[target.slot]!;
    const front = typeof saved === 'string' ? saved : saved.front;
    try {
      target.def.set[target.slot] = `<path d="M0 0 L1 1" fill="url(#g_flesh)" stroke="@peauO"/>${front}`;
      const found = auditFleshGradient();
      const { neuves } = ratchet(found, FLESH_GRADIENT_RATCHET);
      expect(remedeNomme(neuves, ` :: ${target.id}:${target.slot}:front :: 1`)).toBe(true);
      expect(remedeNomme(neuves, 'src/gameIso/rig/parts/tenues/defs/')).toBe(true);
    } finally {
      target.def.set[target.slot] = saved;
    }
  });

  it('restaurée, la même tenue redevient verte (aucun site neuf résiduel)', () => {
    const found = auditFleshGradient();
    const { neuves } = ratchet(found, FLESH_GRADIENT_RATCHET);
    expect(neuves.filter((l) => l.includes(` :: ${target.id}:`))).toEqual([]);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucun site ne porte est PÉRIMÉE', () => {
    const gonfle = [...FLESH_GRADIENT_RATCHET, {
      fichier: 'src/gameIso/rig/parts/tenues/defs/TenueQuiNExistePas.ts', ref: 'gonflement:bras:front', occurrence: 1,
    }];
    const { perimees } = ratchet(auditFleshGradient(), gonfle);
    expect(remedeNomme(perimees, ' :: gonflement:bras:front :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });
});
