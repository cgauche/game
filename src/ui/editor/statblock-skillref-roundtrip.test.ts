/**
 * CONTRAT POSITIF (#1456 G3) — l'éditeur de statbloc de SCÈNE fait un round-trip TEXTE des
 * `SkillRef` (`skillRefLabel` → textarea → `parseSkillRef`). Il ne doit jamais en ressortir le
 * littéral « Au choix » posé en `spec` (interdit, `skillRefSchema`), ni perdre le bornage, ni
 * stocker un LIBELLÉ FR là où la forme demande un id (#1463).
 */
import { describe, it, expect } from 'vitest';
import { parseSkillRef } from './StatblockEditor';
import { skillRefLabel, type SkillRef } from '../../data';

const CAS: SkillRef[] = [
  { id: 'savoir', spec: 'loi', value: 80 },
  { id: 'corps-a-corps', spec: 'base', value: 52 },
  { id: 'savoir', choix: true, value: 65 },
  { id: 'metier', choix: ['armurier', 'forgeron'], value: 50 },
  { id: 'esquive', value: 48 },
];

describe('StatblockEditor — round-trip texte d’une SkillRef (#1456 G3)', () => {
  for (const ref of CAS) {
    it(`« ${skillRefLabel(ref)} » revient à l'identique`, () => {
      const rendu = parseSkillRef(skillRefLabel(ref));
      expect(rendu).toEqual(ref);
      expect(JSON.stringify(rendu)).not.toMatch(/au choix/i); // jamais le littéral en donnée
    });
  }
});
