/**
 * Schéma de `axes.json` — catalogue des AXES de forces/faiblesses (ticket #409, verbatim en corps
 * d'issue, 2026-07-13 : mini-radar par personnage, paramétrable par campagne). Mécanique MAISON
 * (aucune page RAW — clé d'ENVELOPPE `maison`, EXIGÉE ici par `options.exiges`, jamais
 * `sourceRefSchema` qui réclamerait un folio inexistant) :
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
import { document, type EnveloppeDocument } from '../grammaire/document';

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

const champs = {
  /** Socle de base (actif par défaut si la campagne ne déclare pas `activeAxes`). */
  core: z.boolean().optional(),
  skills: z.array(skillRefSchema).optional(),
  talents: z.array(talentRefSchema).optional(),
};

const doc = document(
  'axes',
  famille,
  champs,
  {
    core: { label: 'Axe de socle', hint: 'Actif par défaut sur une campagne qui ne déclare pas ses axes actifs' },
    skills: { label: 'Compétences source', hint: 'Compétences dont la valeur alimente l’axe' },
    talents: { label: 'Talents source', hint: 'Talents dont la possession alimente l’axe' },
  },
  {
    codex: { keys: ['axes'] },
    edit: { dataset: 'axes' },
  },
  { exiges: ['maison'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

/** VUE TS du dataset — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`), la vue
 *  se recompose donc depuis l'enveloppe et les champs déclarés, sans rouvrir aucun nœud. */
export type AxesData = (EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>)[];
