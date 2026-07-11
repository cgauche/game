/**
 * Schéma de `domains.json` — dérivé du contenu RÉEL (19 entrées, script d'inventaire) et de
 * `DomainData` (`src/data/index.ts:931`). Domaine de magie (Couleur, LDB 48) : attributs éditables
 * au Codex (riders `effects`, mitigation `missile`, `casterOps` post-incantation…).
 *
 * `effects` porte des `TriggeredEffect<EffectOp>` (`src/engine/flowCore.ts:472`) — Condition/Flow
 * PROMUS dans `common.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema`, ex-dupliqués ici
 * et dans maneuvers/qualities/talents/etats/spells/traits/trappings/psychology).
 */
import { z } from 'zod';
import { charKeySchema, gameOpSchema, sourceRefSchema, triggeredEffectSchema } from '../common';

export const file = 'domains.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** Vent de Magie (Couleur), EXTRAIT du `desc` (« Domaine du Feu (Aqshy) »). Absent pour les
     *  Domaines dérivés (Sorcellerie/Nécromancie/Démonologie/Magie naturelle…). */
    wind: z.string().optional(),
    /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes — source du pool `arcaneDomains`. */
    arcane: z.boolean().optional(),
    /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine — 5/19 entrées. */
    effects: z.array(triggeredEffectSchema).optional(),
    /** Mitigation des Projectiles (ignore les PA d'une matière). */
    missile: z.strictObject({ bypass: z.enum(['metal', 'nonMagic']), bonusFromBypass: z.boolean().optional() }).optional(),
    /** Ops appliquées AU LANCEUR après une incantation réussie. */
    casterOps: z.array(gameOpSchema).optional(),
    /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine. */
    breathType: z.string().optional(),
    /** Bonus d'incantation CONDITIONNEL par État porté à portée. */
    castBonus: z.strictObject({ perCondition: z.string(), radiusStat: charKeySchema, bonus: z.number() }).optional(),
    /** Caractéristique des Tests d'Incantation, à la place de la carac par défaut. */
    castingChar: charKeySchema.optional(),
    /** Bonus d'incantation lié à l'ENVIRONNEMENT de Scène. */
    environmentBonus: z.strictObject({ environments: z.array(z.string()), mod: z.number() }).optional(),
    /** Domaine de la SORCELLERIE (LDB 49) : marqueur DONNÉE. */
    sorcery: z.boolean().optional(),
    /** Modificateur des Vents de Magie EN MER (MDG 02 l.178-186). */
    seaModifier: z.strictObject({
      /** Feu (Aqshy, l.182) : DR de Focalisation en mer. */
      focalisationDR: z.number().optional(),
      /** Vie (Ghyran, l.186) : le DR de Focalisation en mer est DOUBLÉ. */
      focalisationDrDoubled: z.boolean().optional(),
      /** Vie (Ghyran, l.186) : Focalisation Critique en mer → Imparfaite MAJEURE (au lieu de Mineure). */
      focusCritMiscastMajeure: z.boolean().optional(),
      /** Cieux (Azyr, l.184) : DR d'Incantation en mer pendant une Violente tempête / en Calme plat. */
      incantationStormDR: z.number().optional(),
      incantationCalmDR: z.number().optional(),
      /** Bête (Ghur, l.180) : Critique/Maladresse déclenchés aussi sur un résultat finissant par 0. */
      critFumbleOnTens: z.boolean().optional(),
    }).optional(),
  }),
);

export type DomainsData = z.infer<typeof schema>;
