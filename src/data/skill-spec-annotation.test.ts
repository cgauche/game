/**
 * Contrat structurel : le champ `spec` d'une COMPÉTENCE est une SPÉCIALISATION (« Griffes incurvées »,
 * « magick », « poudre-noire »), jamais une annotation de statbloc recopiée. Les statblocs imprimés
 * annotent parfois la valeur d'une Compétence par le bonus de DR qu'une autre source lui apporte
 * (ZI 04 l.202 « Pistage 60 (+4 DR grâce à Pisteur) ») : ce bonus vit dans le Trait/Talent porté par
 * l'entrée (`passive: skillDRBonus`, `src/engine/ops.ts`), et l'ingérer en `spec` fabriquerait une
 * fausse spécialisation — affichée telle quelle, et jamais retrouvée par une recherche `spec`
 * (`testValue`, `src/engine/skills.ts`).
 *
 * Balaie les trois porteurs de refs de Compétence : `creatures.json`, `careerLevels.json`,
 * `species.json` (`skills[]` : `{id,value,spec}` du bestiaire ; `skills[].ref`/`skills[].choice[].ref`
 * des carrières/espèces). Message d'échec ACTIONNABLE (fichier + spec fautive).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCreatureById } from './index';

const DIR = dirname(fileURLToPath(import.meta.url));
const FILES = ['creatures.json', 'careerLevels.json', 'species.json'];

/** Marqueurs d'annotation : parenthèses, « DR » isolé, « grâce à/au ». */
const isAnnotation = (s: string) => /[()]/.test(s) || /\bDR\b/.test(s) || /gr[âa]ce/i.test(s);

/** Toutes les `spec` rencontrées SOUS une clé `skills` (les `talents` portent leurs propres specs). */
function skillSpecs(file: string): string[] {
  const out: string[] = [];
  const walk = (node: unknown, inSkills: boolean): void => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, inSkills));
    if (node === null || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (inSkills && typeof o.spec === 'string') out.push(o.spec);
    for (const [k, v] of Object.entries(o)) walk(v, k === 'skills' ? true : k === 'talents' ? false : inSkills);
  };
  walk(JSON.parse(readFileSync(join(DIR, file), 'utf8')), false);
  return out;
}

describe('spec de Compétence = spécialisation, jamais une annotation de statbloc', () => {
  for (const file of FILES) {
    it(`${file} : aucune spec annotée`, () => {
      const specs = skillSpecs(file);
      expect(specs.length).toBeGreaterThan(0); // le scan atteint bien des specs
      expect(specs.filter(isAnnotation)).toEqual([]);
    });
  }

  it('les 3 entrées ZI gardent leur valeur de Test imprimée, sans spec parasite', () => {
    const cases = [
      ['caledair-la-faux-de-feu', 'intimidation', 95], // ZI 03 l.46
      ['rat-loup', 'pistage', 60], // ZI 04 l.202
      ['la-bete-de-l-oblast', 'pistage', 62], // ZI 07 l.44
    ] as const;
    for (const [id, skill, value] of cases) {
      const sk = findCreatureById(id)!.skills.find((s) => s.id === skill);
      expect({ id, sk }).toEqual({ id, sk: { id: skill, value } });
    }
  });

  it('le bonus de DR annoté vient du Trait porté par l’entrée, pas de la donnée de Compétence', () => {
    // ZI 04 l.202 / ZI 07 l.44 : le +4 DR est le Trait Pisteur (LDB 85 l.270), présent sur les 2 entrées.
    for (const id of ['rat-loup', 'la-bete-de-l-oblast']) {
      expect(findCreatureById(id)!.traits.some((t) => t.id === 'pisteur')).toBe(true);
    }
    // ZI 03 l.46 : le +3 DR est le Talent Menaçant 3 (LDB 10 l.787), porté par l'entrée.
    const cal = findCreatureById('caledair-la-faux-de-feu')!;
    expect(cal.talents.find((t) => t.id === 'menacant')?.times).toBe(3);
  });
});
