/**
 * Schéma de `domains.json` — dérivé du contenu RÉEL (19 entrées, script d'inventaire) et de
 * `DomainData` (`src/data/index.ts`). Domaine de magie (Couleur, LDB 48) : attributs éditables
 * au Codex (riders `effects`, mitigation `missile`, `casterOps` post-incantation…).
 *
 * `effects` porte des `TriggeredEffect<EffectOp>` (`src/engine/flowCore.ts`) — Condition/Flow
 * PROMUS dans `common.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema`, partagés ici
 * et dans maneuvers/qualities/talents/etats/spells/traits/trappings/psychology).
 */
import { z } from 'zod';
import { charKeySchema, secondarySourceRefSchema, sourceRefSchema } from '../grammaire/valeurs';
import { flowTestSchema, gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'domains.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** Emplacements SECONDAIRES du même Domaine (republication à l'identique — doctrine « UNE entité,
     *  N livres »), l'ancre `source` restant seule à porter la `desc`. */
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    /** Vent de Magie (Couleur), EXTRAIT du `desc` (« Domaine du Feu (Aqshy) »). Absent pour les
     *  Domaines dérivés (Sorcellerie/Nécromancie/Démonologie/Magie naturelle…). */
    wind: z.string().optional(),
    /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes — source du pool `arcaneDomains`. */
    arcane: z.boolean().optional(),
    /** `VDM 02 l.192` (`careerSlots.arcaneDomainGate`) — Nécromancie, Démonologie (LDB 50). */
    dark: z.boolean().optional(),
    /** Tables de `tables.json` déclarées par le Domaine, par CLÉ de rôle (`arcaneMark` = Marques
     *  Arcaniques du Vent, `VDM 02 l.238`) — lues par l'op `rollDomainTable`. */
    tables: z.record(z.string(), z.string()).optional(),
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
    /**
     * Modificateurs de DR PROPRES au Vent du Domaine, hors mer (`seaModifier`) — chaque Vent des
     * Vents de Magie en porte une rubrique : `VDM 04 l.48-56` (Hysh), `VDM 05 l.38-44` (Chamon),
     * `VDM 06 l.34-38` (Ghyran), `VDM 07 l.42-48` (Azyr), `VDM 08 l.36-40` (Ulgu),
     * `VDM 09 l.38-42` (Shyish), `VDM 10 l.38-42` (Aqshy), `VDM 11 l.38-44` (Ghur).
     * Forme commune des huit : une LISTE de (Tests visés, delta de DR, circonstance déclenchante).
     */
    windModifiers: z.array(z.strictObject({
      /** Tests portés par le modificateur. */
      tests: z.array(z.enum(['incantation', 'focalisation', 'seconde-vue'])).min(1),
      /** Delta de DR appliqué au Test. */
      dr: z.number(),
      /** Ids STABLES de circonstances dont UNE suffit à déclencher le modificateur (météo, saison,
       *  lieu, relief…), résolues par l'appelant. ABSENT = permanent. */
      when: z.array(z.string()).min(1).optional(),
      /** Annulation par un TIERS (Hysh) : l'appelant signale `circumstance` quand un assistant
       *  possédant `requiresSkill` a réussi `test` et maintient son chant (`sustained`). */
      cancelledBy: z.strictObject({
        circumstance: z.string(),
        requiresSkill: z.strictObject({ id: z.string(), spec: z.string().optional() }).optional(),
        test: flowTestSchema,
        sustained: z.boolean().optional(),
        source: sourceRefSchema,
        /** Passage RAW VERBATIM qui porte l'annulation (règle stricte 5). */
        desc: z.string(),
      }).optional(),
      source: sourceRefSchema,
      /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
      desc: z.string(),
    })).optional(),
  }),
);
