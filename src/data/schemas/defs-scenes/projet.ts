/**
 * Schéma zod d'un PROJET DE SCÈNE (`ProjectDoc`, `src/state/worldMap.ts`) — le paquet de campagne
 * auto-suffisant `{ schema: 6, <identité>?, narratif, scenes, worldMap?, activeAxes? }`.
 *
 * C'est la porte UNIQUE du seam `parseProject` : la FORME (ci-dessous) et les QUATRE sémantiques
 * qui vivaient en validateurs manuscrits du même seam — FK `activeAxes` vers `axes.json`, invariants
 * du bloc narratif (`narratifSchema`), FK intra-document `entity.presetId` → `narratif.presetsPnj`,
 * et l'invariant d'IDENTITÉ. Les anti-collisions et les résolutions de spécialisation restent des
 * `superRefine` : jamais des `ref()` (une référence intra-document n'entre pas au registre global).
 *
 * L'ENVELOPPE est PLATE (#1467 L1b) : les champs d'identité vivent à la RACINE, sans poche `meta`.
 * Le document n'appelle PAS la fabrique `document()` (`../grammaire/document.ts`) : celle-ci pose une
 * enveloppe dont `id`, `type` et `label` sont requis (`CLES_ENVELOPPE` `document.ts:24`,
 * `NON_EXIGIBLES` `document.ts:47`), là où l'identité d'un projet est FACULTATIVE (un brouillon
 * d'éditeur n'en porte pas) et où le document ne porte ni `type` ni `source` ; sa version de FORME
 * est le littéral `schema`, qu'aucune des quatre familles ne connaît. Aucun document de
 * `defs-scenes/` n'appelle la fabrique (mesuré).
 */
import { z } from 'zod';
import { IDS_PAR_DATASET } from '../_ids.generated';
import { sceneSchema } from './scene';
import { worldMapSchema } from './worldmap';
import { narratifSchema } from './narratif';

/**
 * Le TRIO d'identité REQUIS dès qu'une campagne s'identifie (#766) — il porte la dédup d'import
 * portable et ne se scinde pas (invariant tout-ou-rien du `superRefine` ci-dessous).
 */
export const CLES_IDENTITE = ['id', 'label', 'versionContenu'] as const;

/**
 * TOUS les champs d'identité — le trio requis PLUS les accessoires. C'est la PRÉSENCE de n'importe
 * lequel qui déclenche l'exigence du trio : la poche `meta` d'avant #1467 était un `strictObject`,
 * où un `{ icon }` seul était DÉJÀ rouge (ses 3 clés requises manquaient). Ne déclencher que sur le
 * trio laisserait passer `{ icon }`, `{ desc }` ou `{ auteur }` orphelins — une identité muette que
 * l'ancienne forme REFUSAIT.
 */
const CLES_IDENTITE_TOUTES = [...CLES_IDENTITE, 'icon', 'desc', 'auteur'] as const;

/** Ids d'`axes.json` — cible de `activeAxes`. Le type `axe` n'est pas déclaré au mapping de
 *  `grammaire/ref.ts` (`TYPES`) : la FK se refine ici contre le registre généré. */
const idsDAxes = (): readonly string[] => IDS_PAR_DATASET['axes.json'] ?? [];

/** FORME du document de projet — enveloppe PLATE. */
const formeProjet = z.strictObject({
  schema: z.literal(6),
  /** Identité de campagne (#766) — facultative au format, requise pour l'export portable. */
  id: z.string().min(1, 'id doit être une chaîne non vide.').optional(),
  label: z.string().min(1, 'label doit être une chaîne non vide.').optional(),
  icon: z.string().optional(),
  /** Numéro de CONTENU de l'auteur (dédup d'import : même `id`, version supérieure → remplacement
   *  proposé). La version de FORME du document est `schema`, jamais ce champ. */
  versionContenu: z.number().optional(),
  desc: z.string().optional(),
  auteur: z.string().optional(),
  scenes: z.array(sceneSchema),
  worldMap: worldMapSchema.optional(),
  /** Axes de forces/faiblesses ACTIFS de la campagne (#409) — absent = socle `CORE_AXIS_IDS`. */
  activeAxes: z.array(z.string()).optional(),
  narratif: narratifSchema,
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

  /**
   * IDENTITÉ TOUT-OU-RIEN : la poche `meta` d'avant #1467 était un objet dont `id`, `label` et
   * `version` étaient TOUS requis. Aplatie, cette exigence deviendrait des champs optionnels
   * indépendants — un projet à demi identifié passerait la porte en silence.
   */
  const manquantes = CLES_IDENTITE.filter((k) => doc[k] === undefined);
  const identifie = CLES_IDENTITE_TOUTES.some((k) => doc[k] !== undefined);
  if (identifie && manquantes.length > 0) {
    const trio = CLES_IDENTITE.map((c) => `\`${c}\``).join('/');
    for (const k of manquantes) {
      ctx.addIssue({
        code: 'custom',
        path: [k],
        message: `identité de campagne INCOMPLÈTE : « ${k} » est requis dès qu'un autre champ du trio ${trio} est présent.`,
      });
    }
  }

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
