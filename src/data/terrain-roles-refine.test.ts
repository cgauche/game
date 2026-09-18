/**
 * CONTRAT du REFINE DE COLLECTION des RÔLES de terrain (#1789) — `schemas/defs/terrains.ts`.
 *
 * Deux rôles que le moteur ADRESSE au lieu de réciter un id : `absence` (la non-tuile — ce qu'une
 * couche porte là où rien n'est bâti) et `bordDuMonde` (ce que la grille rend au-delà de ses bornes).
 * Le seam (`state/terrain`) en DÉRIVE `terrainAbsent()` / `terrainHorsGrille()` : un dataset à zéro
 * porteur laisserait ces fonctions sans réponse, un dataset à deux porteurs les rendrait dépendantes
 * de l'ORDRE d'écriture. Ce que ce fichier tient : le refus MORD au PARSE, et il NOMME le rôle, le
 * compte mesuré et les porteurs.
 *
 * Les fautes sont injectées dans une COPIE du dataset réel, jamais dans le fichier.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/terrains';

type Entree = { id: string; absence?: boolean; bordDuMonde?: boolean };
type Role = 'absence' | 'bordDuMonde';

const charger = (): Entree[] => JSON.parse(readFileSync(fileURLToPath(new URL('./terrains.json', import.meta.url)), 'utf8'));

/** Parse une copie du dataset après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (dataset: Entree[]) => void): string[] {
  const dataset = charger();
  saboter(dataset);
  const r = schema.safeParse(dataset);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

/** Une entrée EXIGÉE du dataset : son absence est un dataset ROMPU, que la sonde NOMME au lieu de
 *  crasher en `TypeError` — la garde doit dire ce qui manque, pas où elle a trébuché. */
function exige(entree: Entree | undefined, quoi: string): Entree {
  expect(entree, `dataset rompu : ${quoi} — la sonde ne mesure plus rien.`).toBeDefined();
  if (!entree) throw new Error(`dataset rompu : ${quoi}`);
  return entree;
}

const porteurDe = (role: Role): Entree =>
  exige(charger().find((t) => t[role] === true), `aucune entrée ne porte le rôle « ${role} »`);

describe('rôles de terrain — EXACTEMENT UN porteur par rôle, refusé au parse sinon (#1789)', () => {
  it('le dataset COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    expect(refus(() => {}), 'terrains.json refusé À VIDE : les cas ci-dessous ne prouveraient plus rien.').toEqual([]);
  });

  for (const role of ['absence', 'bordDuMonde'] as const) {
    it(`« ${role} » : le dataset committé en désigne UN, et un seul`, () => {
      const porteurs = charger().filter((t) => t[role] === true).map((t) => t.id);
      expect(porteurs, `le rôle « ${role} » n’est plus porté par une entrée unique.`).toHaveLength(1);
    });

    it(`« ${role} » : ZÉRO porteur est refusé, en nommant le rôle et le compte`, () => {
      const porteur = porteurDe(role);
      const messages = refus((dataset) => {
        delete exige(dataset.find((t) => t.id === porteur.id), `« ${porteur.id} » a disparu de la copie`)[role];
      });
      expect(messages.length, `le rôle « ${role} » orphelin n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0], 'le refus ne cite pas le rôle fautif en chemin.').toContain(`@${role}`);
      expect(messages[0], 'le refus ne NOMME pas le rôle.').toContain(`rôle « ${role} »`);
      expect(messages[0], 'le refus ne dit pas le COMPTE mesuré.').toContain('0 mesurée(s)');
    });

    it(`« ${role} » : DEUX porteurs sont refusés, en nommant les deux entrées`, () => {
      const porteur = porteurDe(role);
      const autreId = exige(charger().find((t) => t.id !== porteur.id), 'le dataset ne porte qu’UNE entrée').id;
      const messages = refus((dataset) => {
        exige(dataset.find((t) => t.id === autreId), `« ${autreId} » a disparu de la copie`)[role] = true;
      });
      expect(messages.length, `deux porteurs de « ${role} » n’ont levé AUCUN refus.`).toBe(1);
      expect(messages[0], 'le refus ne dit pas le COMPTE mesuré.').toContain('2 mesurée(s)');
      expect(messages[0], 'le refus ne NOMME pas les porteurs mesurés.').toContain(autreId);
      expect(messages[0]).toContain(porteur.id);
    });
  }

  it('les deux rôles sont portés par des entrées DISTINCTES — le bord du monde n’est pas une absence', () => {
    expect(porteurDe('bordDuMonde').id, 'le bord du monde et la non-tuile ont fusionné : la Ligne de Vue au bord change.')
      .not.toBe(porteurDe('absence').id);
  });
});
