/**
 * Tableaux de Corruption physique et mentale — Livre de base, chapitre 19
 * (p.184-185), VERBATIM. Chaque entrée porte les effets que le jeu modélise
 * (caractéristiques permanentes, Mouvement, PA naturels, mods de Tests, Traits) ;
 * la part descriptive ou conditionnelle non modélisable reste en `note`
 * (journalisée + visible sur la fiche, arbitrage MJ — rien d'inventé).
 */
import { RNG, d100 } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { Mutation } from '../engine/corruption';

interface Row {
  min: number;
  max: number;
  label: string;
  fx?: Omit<Mutation, 'label' | 'kind' | 'roll'>;
}

// --- Tableau de Corruption physique (LDB 19 l.122-146) -----------------------
const PHYSIQUE: Row[] = [
  { min: 1, max: 5, label: 'Pattes d’animaux', fx: { movement: 1 } },
  { min: 6, max: 10, label: 'Corpulent', fx: { movement: -1, charMods: { F: 5, E: 5 } } },
  { min: 11, max: 15, label: 'Doigts distendus', fx: { charMods: { Dex: 10 } } },
  { min: 16, max: 20, label: 'Émacié', fx: { charMods: { F: -10, Ag: 5 } } },
  { min: 21, max: 25, label: 'Œil énorme', fx: { note: '+10 aux Tests de Perception impliquant la vue.' } },
  { min: 26, max: 30, label: 'Articulation supplémentaire aux jambes', fx: { charMods: { Ag: 5 } } },
  { min: 31, max: 35, label: 'Bouche supplémentaire', fx: { note: 'Lancer sur le Tableau des Localisations pour déterminer où cette bouche apparaît.' } },
  { min: 36, max: 40, label: 'Tentacule épais', fx: { traits: ['Tentacules'], note: 'Trait de créature Tentacule.' } },
  { min: 41, max: 45, label: 'Peau brillante', fx: { note: 'Produit une lumière équivalente à celle d’une bougie.' } },
  { min: 46, max: 50, label: 'Beauté surnaturelle', fx: { charMods: { Soc: 10 }, note: 'Ne garde jamais de cicatrice.' } },
  { min: 51, max: 55, label: 'Visage inversé', fx: { testMods: [{ char: 'Soc', mod: -20 }] } },
  { min: 56, max: 60, label: 'Peau d’acier', fx: { apAll: 2, charMods: { Ag: -10 } } },
  { min: 61, max: 65, label: 'Langue pendante', fx: { skillMods: { langue: -10 } } },
  { min: 66, max: 70, label: 'Plumes éparses', fx: { note: 'Deux lancers de Localisation pour déterminer où ces plumes apparaissent.' } },
  { min: 71, max: 75, label: 'Court sur pattes', fx: { movement: -1 } },
  { min: 76, max: 80, label: 'Écailles épineuses', fx: { apAll: 1 } },
  { min: 81, max: 85, label: 'Cornes asymétriques', fx: { apLocations: { tete: 1 }, derivedWeapon: { name: 'Cornes', type: 'melee', damage: '+BF', qualities: [], subType: 'Base', hands: 1 }, note: 'Compte comme une Arme de Créature (Dégâts = Bonus de Force).' } },
  { min: 86, max: 90, label: 'Suintement de pus', fx: { note: 'Lancer de Localisation pour déterminer l’origine du suintement.' } },
  { min: 91, max: 95, label: 'Groin poilu', fx: { skillMods: { pistage: 10 } } },
  { min: 96, max: 100, label: 'Choix du MJ', fx: { note: 'Le MJ choisit une mutation ou un Trait de Créature.' } },
];

// --- Tableau de Corruption mentale (LDB 19 l.152-176) -------------------------
const MENTALE: Row[] = [
  { min: 1, max: 5, label: 'Atroces désirs', fx: { charMods: { Soc: -5, FM: -5 } } },
  { min: 6, max: 10, label: 'Bête intérieure', fx: { charMods: { FM: 10, Soc: -5, Int: -5 } } },
  { min: 11, max: 15, label: 'Rêves chaotiques', fx: { note: 'État Exténué pendant les deux premières heures de chaque journée.' } },
  { min: 16, max: 20, label: 'Formication', fx: { charMods: { I: -5, Dex: -5 } } },
  { min: 21, max: 25, label: 'Imprévisible fantaisiste', fx: { charMods: { Int: -5, FM: -5 } } },
  { min: 26, max: 30, label: 'Terrible inquiétude', fx: { charMods: { FM: -10 } } },
  { min: 31, max: 35, label: 'Pulsions de haine', fx: { note: 'Sujet à l’Hostilité envers tous ceux qui ne sont pas de votre race.' } },
  { min: 36, max: 40, label: 'Cœur desséché', fx: { charMods: { FM: 10, Soc: -10 } } },
  { min: 41, max: 45, label: 'Pensées envieuses', fx: { charMods: { Soc: -10 } } },
  { min: 46, max: 50, label: 'Esprit solitaire', fx: { note: '-10 aux Tests lorsque vous êtes seul.' } },
  { min: 51, max: 55, label: 'Blocage mental', fx: { charMods: { Int: -10 } } },
  { min: 56, max: 60, label: 'Urgence profanatoire', fx: { charMods: { FM: -10, Ag: 10 } } },
  { min: 61, max: 65, label: 'Morale douteuse', fx: { note: '1 État Brisé sur tout échec à un Test dérivé de la Force Mentale.' } },
  { min: 66, max: 70, label: 'Esprit suspicieux', fx: { charMods: { I: -5, Int: -5 } } },
  { min: 71, max: 75, label: 'Accro à l’adrénaline', fx: { charMods: { FM: 10, I: -10 } } },
  { min: 76, max: 80, label: 'Visions torturées', fx: { charMods: { I: -10 } } },
  { min: 81, max: 85, label: 'Totalement déséquilibré', fx: { charMods: { Soc: -20, FM: 10 } } },
  { min: 86, max: 90, label: 'Infinie malveillance', fx: { note: '-10 aux Tests non destinés à blesser autrui ; +10 aux Tests destinés à blesser autrui.' } },
  { min: 91, max: 95, label: 'Colère impie', fx: { charMods: { CC: 10 }, psychTraits: [{ type: 'frenesie' }], note: 'Sujet à Frénésie.' } },
  { min: 96, max: 100, label: 'Affreusement nerveux', fx: { charMods: { Ag: 5, Soc: -5 } } },
];

const TABLES: Record<'physique' | 'mentale', Row[]> = { physique: PHYSIQUE, mentale: MENTALE };

/** Labels des tables — pour le registre visuel du rig et son test d'exhaustivité. */
export const LABELS_PHYSIQUES: readonly string[] = PHYSIQUE.map((r) => r.label);
export const LABELS_MENTALES: readonly string[] = MENTALE.map((r) => r.label);

/** Tire une mutation sur le Tableau de Corruption `kind` (d100, RNG seedable). */
export function rollMutation(kind: 'physique' | 'mentale', rng: RNG): Mutation {
  const roll = d100(rng);
  const table = TABLES[kind];
  const row = findTableEntry(table, roll);
  return { label: row.label, kind, roll, ...(row.fx ?? {}) };
}

/** Mutation EXPLICITE par son label (tell figé en DONNÉE, sans tirage — ex. trait
 *  « Mutation (Cornes asymétriques) »). Cherche dans les deux Tableaux. `null` si inconnu. */
export function mutationByLabel(label: string): Mutation | null {
  const key = label.trim().toLowerCase().replace(/[’']/g, "'");
  for (const kind of ['physique', 'mentale'] as const) {
    const row = TABLES[kind].find((r) => r.label.toLowerCase().replace(/[’']/g, "'") === key);
    if (row) return { label: row.label, kind, roll: row.min, ...(row.fx ?? {}) };
  }
  return null;
}
