import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './tenues/_registry.generated';

// L'override est l'EXCEPTION (dérive par défaut) — #633 B-P1. Le membre supérieur se résout en
// UNITÉ : l'avant-bras se DÉRIVE de l'art `bras` pleine longueur découpé au coude (cf.
// resolveUpperLimb/derive.ts). `TenueSet.avantBras` est l'écoutille de correction pour un art `bras`
// atypique que la dérive couvre mal ; aucun def n'en a besoin.
//
// ABSENCE NOMMÉE, jamais un COMPTE : l'assertion rend la LISTE des defs fautifs, pas leur nombre.
// Un plafond à zéro est un nombre qu'on relève d'une ligne ; une liste attendue vide NOMME le def à
// corriger, et le seul geste possible est de le corriger. Aucun stock n'est ouvert ici : il n'y a
// rien à stocker tant que la liste est vide, et le jour où un override est DÉLIBÉRÉ, c'est une
// décision qui s'écrit avec son motif — pas un compteur qu'on incrémente.

describe('avantBras override — cliquet (#633 B-P1)', () => {
  it('aucun def ne déclare `avantBras` — la dérive au coude couvre tout le corpus', () => {
    const overrides = TENUE_DEFS.filter((d) => d.set.avantBras != null).map((d) => d.id);
    expect(overrides, `def(s) déclarant \`avantBras\` — l'avant-bras se DÉRIVE de l'art \`bras\`\n` +
      `(resolveUpperLimb, parts/derive.ts) : corriger l'art \`bras\` atypique plutôt que de poser une\n` +
      `écoutille :\n  ${overrides.join('\n  ')}`).toEqual([]);
  });
});
