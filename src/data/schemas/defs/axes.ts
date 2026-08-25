/**
 * Schéma de `axes.json` — catalogue des AXES de forces/faiblesses (ticket #409, verbatim en corps
 * d'issue, 2026-07-13 : mini-radar par personnage, paramétrable par campagne). Mécanique MAISON
 * (aucune page RAW — `source: 'maison'`, jamais `sourceRefSchema` qui exigerait un folio inexistant) :
 * chaque axe liste ses SOURCES en ids STABLES de `skills.json`/`talents.json` (`skills`/`talents`,
 * TOP-LEVEL — patron `crewRoles.skills`, `{skillId,spec?}[]`, éditeur `SkillSpecListField` au Codex),
 * résolues par `axisScore` (`src/engine/axes.ts`). `core` marque le socle de base (actif par défaut
 * sur une campagne sans `activeAxes` déclaré — cf. `WorldMap`/`ProjectDoc`).
 *
 * Doctrine : la Caractéristique d'un axe entre UNIQUEMENT via une Compétence (`skillId`), jamais un
 * canal caractéristique nu — un axe sans Compétence Avancée formée reste à 0, comme au jeu (LDB 09
 * l.30, Compétence Avancée sans Augmentation = Test impossible, cf. `docs/raw/competences.md`).
 */
import { z } from 'zod';

export const file = 'axes.json';
export const famille = 'entite';

const skillRefSchema = z.strictObject({
  skillId: z.string(),
  /** Spécialisation de la Compétence (ex. `metier`→`ingenieur`) — absente = TOUTE spec compte. */
  spec: z.string().optional(),
});

const talentRefSchema = z.strictObject({
  talentId: z.string(),
  /** Spécialisation du Talent (ex. `maitre-artisan`→`ingenieur`) — absente = TOUTE spec compte. */
  spec: z.string().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string().optional(),
    /** Socle de base (actif par défaut si la campagne ne déclare pas `activeAxes`). */
    core: z.boolean().optional(),
    /** Mécanique maison — aucune page RAW à citer (le RAW ne connaît pas cet axe). */
    source: z.literal('maison'),
    skills: z.array(skillRefSchema).optional(),
    talents: z.array(talentRefSchema).optional(),
  }),
);

export type AxesData = z.infer<typeof schema>;
