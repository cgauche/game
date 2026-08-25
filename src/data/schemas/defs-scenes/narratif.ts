/**
 * Schéma zod du bloc NARRATIF embarqué d'un projet (`src/state/campaignNarratif.ts`, #765).
 *
 * Frontière RÉFÉRENCE vs NARRATIF : le narratif est EMBARQUÉ dans le document de campagne et
 * RÉFÉRENCE la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée. L'invariant
 * est gardé ICI : aucun id narratif ne collisionne avec un id de la règle globale
 * (créature/possession), et les quatre registres n'ont aucun id en commun.
 */
import { z } from 'zod';
import { sourceRefSchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';
import { schema as creaturesSchema } from '../defs/creatures';
import { findCreatureById, findTrappingById, findSkillById, findTalentById, specResolves } from '../../index';
import type { TrappingData } from '../../index';

/** Un stade RÉVÉLABLE d'un indice : la prose (verbatim source, règle 5) dévoilée à ce palier. */
export const indiceStadeSchema = z.strictObject({
  /** id STABLE du stade, unique DANS l'indice. */
  id: z.string().min(1, 'indices[].stades[].id : id vide.'),
  prose: z.string(),
  source: sourceRefSchema.optional(),
});

/** Un indice ou une rumeur d'une affaire — révélé par stades. */
export const indiceSchema = z.strictObject({
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: z.string().min(1, 'indices[].id : id vide.'),
  affaireId: z.string(),
  kind: z.enum(['indice', 'rumeur']),
  titre: z.string(),
  /** Stades révélables (au moins un — vérifié par `raffineNarratif`). */
  stades: z.array(indiceStadeSchema),
  /** Autres indices (ids) que celui-ci recoupe/débloque. */
  refs: z.array(z.string()).optional(),
});

/** Une affaire (fil d'enquête) de la campagne. */
export const affaireSchema = z.strictObject({
  id: z.string().min(1, 'affaires[].id : id vide.'),
  titre: z.string(),
  desc: z.string().optional(),
});

/** Un PNJ pré-composé : créature globale surchargée (`base`) ou profil ad hoc embarqué (`profil`,
 *  même forme qu'une entrée de `creatures.json`, partielle). */
export const presetPnjSchema = z.strictObject({
  id: z.string().min(1, 'presetsPnj[].id : id vide.'),
  base: idDe('creature').optional(),
  profil: creaturesSchema.element.partial().optional(),
  apparence: entityAppearanceSchema.optional(),
  /** id d'illustration (registre d'art), affichage seul. */
  portrait: z.string().optional(),
  source: sourceRefSchema.optional(),
});

/** Un id narratif COLLISIONNE avec la règle globale s'il résout déjà comme créature OU possession. */
const collisionneAvecLeGlobal = (id: string): boolean => !!findCreatureById(id) || !!findTrappingById(id);

/**
 * Sémantique du bloc narratif — unicité des ids INTER-registres, anti-collision avec la règle
 * globale, `indice.affaireId` croisé, stades non vides, preset à `base` OU `profil` complet, et
 * spécialisations RÉSOLUES au catalogue global (`specResolves`). Attachée à `narratifSchema`, elle
 * porte donc le chemin complet (`narratif.indices.3.affaireId`) quand le projet la compose.
 */
function raffineNarratif(nb: z.infer<typeof formeNarratif>, ctx: z.RefinementCtx): void {
  const faute = (path: (string | number)[], message: string): void => ctx.addIssue({ code: 'custom', path, message });

  const affaireIds = new Set<string>();
  nb.affaires.forEach((a, i) => {
    if (affaireIds.has(a.id)) faute(['affaires', i, 'id'], `id d'affaire dupliqué « ${a.id} ».`);
    if (collisionneAvecLeGlobal(a.id)) faute(['affaires', i, 'id'], `l'id d'affaire « ${a.id} » collisionne avec un id de la règle globale (créature/possession).`);
    affaireIds.add(a.id);
  });

  const indiceIds = new Set<string>();
  nb.indices.forEach((ind, i) => {
    if (indiceIds.has(ind.id)) faute(['indices', i, 'id'], `id d'indice dupliqué « ${ind.id} ».`);
    if (affaireIds.has(ind.id)) faute(['indices', i, 'id'], `l'id d'indice « ${ind.id} » collisionne avec un id d'affaire.`);
    if (collisionneAvecLeGlobal(ind.id)) faute(['indices', i, 'id'], `l'id d'indice « ${ind.id} » collisionne avec un id de la règle globale (créature/possession).`);
    if (!affaireIds.has(ind.affaireId)) faute(['indices', i, 'affaireId'], `l'indice « ${ind.id} » référence une affaire inconnue « ${ind.affaireId} ».`);
    if (!ind.stades.length) faute(['indices', i, 'stades'], `l'indice « ${ind.id} » n'a aucun stade.`);
    const stadeIds = new Set<string>();
    ind.stades.forEach((s, j) => {
      if (stadeIds.has(s.id)) faute(['indices', i, 'stades', j, 'id'], `id de stade dupliqué « ${s.id} » dans l'indice « ${ind.id} ».`);
      stadeIds.add(s.id);
    });
    indiceIds.add(ind.id);
  });
  nb.indices.forEach((ind, i) => {
    (ind.refs ?? []).forEach((r, j) => {
      if (!indiceIds.has(r)) faute(['indices', i, 'refs', j], `l'indice « ${ind.id} » référence un indice inconnu « ${r} ».`);
    });
  });

  const presetIds = new Set<string>();
  nb.presetsPnj.forEach((p, i) => {
    if (presetIds.has(p.id)) faute(['presetsPnj', i, 'id'], `id de preset PNJ dupliqué « ${p.id} ».`);
    if (affaireIds.has(p.id) || indiceIds.has(p.id)) faute(['presetsPnj', i, 'id'], `l'id de preset PNJ « ${p.id} » collisionne avec un autre id du narratif.`);
    if (collisionneAvecLeGlobal(p.id)) faute(['presetsPnj', i, 'id'], `l'id de preset PNJ « ${p.id} » collisionne avec un id de la règle globale (créature/possession).`);
    if (p.base === undefined && p.profil === undefined) faute(['presetsPnj', i], `le preset PNJ « ${p.id} » n'a ni base ni profil (au moins l'un des deux est requis).`);
    if (p.base === undefined && p.profil !== undefined) {
      if (!p.profil.char || typeof p.profil.char !== 'object') faute(['presetsPnj', i, 'profil', 'char'], `le preset PNJ « ${p.id} » a un profil sans base et sans « char ».`);
      if (!Array.isArray(p.profil.traits)) faute(['presetsPnj', i, 'profil', 'traits'], `le preset PNJ « ${p.id} » a un profil sans base et sans « traits ».`);
    }
    /** Référence PAR ID jusque dans la spécialisation (`specResolves`, #1342 L3). La sentinelle
     *  « (Au choix) » reste admise : elle désigne un choix, pas une spécialisation. */
    const specValide = (
      champ: 'skills' | 'talents',
      kind: { indefini: string; defini: string },
      find: (id: string) => Parameters<typeof specResolves>[0] | undefined,
      refs: { id: string; spec?: string }[],
    ): void => {
      refs.forEach((r, j) => {
        if (typeof r.spec !== 'string' || /au choix/i.test(r.spec)) return;
        const def = find(r.id);
        if (!def) {
          faute(['presetsPnj', i, 'profil', champ, j, 'id'], `le preset PNJ « ${p.id} » référence ${kind.indefini} inconnu(e) « ${r.id} ».`);
          return;
        }
        if (!specResolves(def, r.spec)) {
          faute(['presetsPnj', i, 'profil', champ, j, 'spec'], `le preset PNJ « ${p.id} » porte une spécialisation inconnue « ${r.spec} » pour ${kind.defini} « ${r.id} ».`);
        }
      });
    };
    specValide('skills', { indefini: 'une Compétence', defini: 'la Compétence' }, findSkillById, p.profil?.skills ?? []);
    specValide('talents', { indefini: 'un Talent', defini: 'le Talent' }, findTalentById, p.profil?.talents ?? []);
    presetIds.add(p.id);
  });

  const objetIds = new Set<string>();
  nb.objets.forEach((o, i) => {
    if (!o?.id) {
      faute(['objets', i, 'id'], 'un objet n\'a pas d\'id.');
      return;
    }
    if (objetIds.has(o.id)) faute(['objets', i, 'id'], `id d'objet dupliqué « ${o.id} ».`);
    if (affaireIds.has(o.id) || indiceIds.has(o.id) || presetIds.has(o.id)) faute(['objets', i, 'id'], `l'id d'objet « ${o.id} » collisionne avec un autre id du narratif.`);
    if (collisionneAvecLeGlobal(o.id)) faute(['objets', i, 'id'], `l'id d'objet « ${o.id} » collisionne avec un id de la règle globale (créature/possession).`);
    objetIds.add(o.id);
  });
}

/** FORME du bloc narratif. `objets` est typé `TrappingData` (`src/data/index.ts`) : le schéma du
 *  CATALOGUE (`defs/trappings.ts`) ne le décrit pas — il est mesuré sur `trappings.json`, dont le
 *  `type` est une énumération fermée (6 valeurs) et dont `availability`/`qualities`/`desc`/`price`/
 *  `source` sont requis, là où un objet EMBARQUÉ de campagne porte un type libre et se passe de
 *  l'enveloppe de catalogue. Sa forme entre en zod avec le lot T3-b. */
const formeNarratif = z.strictObject({
  affaires: z.array(affaireSchema),
  indices: z.array(indiceSchema),
  presetsPnj: z.array(presetPnjSchema),
  objets: z.array(z.custom<TrappingData>()),
});

/** `NarratifBlock` (`state/campaignNarratif.ts:58`) — forme + sémantique. */
export const narratifSchema = formeNarratif.superRefine(raffineNarratif);
