import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './tenues/_registry.generated';

// L'override est l'EXCEPTION (dérive par défaut) ; ce max ne croît que par décision tracée, jamais
// par commodité — #633 B-P1. Le membre supérieur se résout en UNITÉ : l'avant-bras se DÉRIVE de
// l'art `bras` pleine longueur découpé au coude (cf. resolveUpperLimb/derive.ts). `TenueSet.avantBras`
// est l'écoutille de correction pour un art `bras` atypique que la dérive couvre mal ; aujourd'hui
// aucun def n'en a besoin. Un futur ajout devra BUMPER cette constante consciemment (= décision).
const MAX_AVANTBRAS_OVERRIDES = 0;

describe('avantBras override — cliquet (#633 B-P1)', () => {
  it(`le nombre de defs déclarant \`avantBras\` reste ≤ ${MAX_AVANTBRAS_OVERRIDES} (dérive par défaut)`, () => {
    const overrides = TENUE_DEFS.filter((d) => d.set.avantBras != null).map((d) => d.id);
    expect(overrides.length).toBeLessThanOrEqual(MAX_AVANTBRAS_OVERRIDES);
  });
});
