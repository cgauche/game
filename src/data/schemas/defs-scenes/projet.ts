/**
 * Schéma zod d'un PROJET DE SCÈNE (`ProjectDoc`, `src/state/worldMap.ts:435`) — le paquet de
 * campagne auto-suffisant `{ schema: 4, meta?, narratif, scenes, worldMap?, activeAxes? }`.
 *
 * C'est la porte UNIQUE du seam `parseProject` : la FORME (ci-dessous) et les QUATRE sémantiques
 * qui vivaient en validateurs manuscrits du même seam — FK `activeAxes` vers `axes.json`, invariants
 * du bloc narratif (`narratifSchema`), FK intra-document `entity.presetId` → `narratif.presetsPnj`,
 * et forme de `meta`. Les anti-collisions et les résolutions de spécialisation restent des
 * `superRefine` : jamais des `ref()` (une référence intra-document n'entre pas au registre global).
 */
import { z } from 'zod';
import { IDS_PAR_DATASET } from '../_ids.generated';
import { sceneSchema } from './scene';
import { worldMapSchema } from './worldmap';
import { narratifSchema } from './narratif';

/** `ProjectMeta` (`worldMap.ts:425`) — identité de campagne pour la bibliothèque (#766) :
 *  optionnelle au format, requise pour l'export portable (dédup d'import par `meta.id` + version). */
export const projectMetaSchema = z.strictObject({
  id: z.string().min(1, 'meta.id doit être une chaîne non vide.'),
  label: z.string().min(1, 'meta.label doit être une chaîne non vide.'),
  icon: z.string().optional(),
  version: z.number(),
  desc: z.string().optional(),
  auteur: z.string().optional(),
});

/** Ids d'`axes.json` — cible de `activeAxes`. Le type `axe` n'est pas déclaré au mapping de
 *  `grammaire/ref.ts` (`TYPES`) : la FK se refine ici contre le registre généré. */
const idsDAxes = (): readonly string[] => IDS_PAR_DATASET['axes.json'] ?? [];

/** FORME du document de projet. */
const formeProjet = z.strictObject({
  schema: z.literal(4),
  scenes: z.array(sceneSchema),
  worldMap: worldMapSchema.optional(),
  /** Axes de forces/faiblesses ACTIFS de la campagne (#409) — absent = socle `CORE_AXIS_IDS`. */
  activeAxes: z.array(z.string()).optional(),
  narratif: narratifSchema,
  meta: projectMetaSchema.optional(),
});

/** `ProjectDoc` — forme + les quatre sémantiques du seam `parseProject`. */
export const projetSchema = formeProjet.superRefine((doc, ctx) => {
  const connus = idsDAxes();
  (doc.activeAxes ?? []).forEach((id, i) => {
    if (connus.includes(id)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['activeAxes', i],
      message: `activeAxes référence un axe inconnu de axes.json : « ${id} ».`,
    });
  });

  /** FK INTRA-document (#671) : tout `presetId` d'entité de scène résout un preset déclaré. */
  const presets = new Set(doc.narratif.presetsPnj.map((p) => p.id));
  doc.scenes.forEach((s, is) => {
    (s.entities ?? []).forEach((e, ie) => {
      if (e.presetId === undefined || presets.has(e.presetId)) return;
      ctx.addIssue({
        code: 'custom',
        path: ['scenes', is, 'entities', ie, 'presetId'],
        message: `l'entité « ${e.id} » de la scène « ${s.id} » référence un preset de PNJ inconnu « ${e.presetId} » (narratif.presetsPnj).`,
      });
    });
  });
});
