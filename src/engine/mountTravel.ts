/**
 * Montures en VOYAGE (EDOC ch.4 « Montures et véhicules ») — moteur PUR, données `src/data/montures.json`
 * (table « Mouvement pour les montures » + Endurance des profils, verbatim EDOC 07 l.17-96 et l.119-130).
 *
 * RAW modélisé :
 *  - Vitesse de voyage (EDOC 07 l.140) : « Chaque point de Mouvement équivaut à un 1,5 km par heure au
 *    pas, 2,5 km par heure au trot, et 3 km par heure au galop. » Certaines bêtes ne trottent pas
 *    (colonne « - » de la table des allures, l.121-130).
 *  - Endurance des allures (EDOC 07 l.142-144) : au pas jusqu'à 12 heures sans repos ; au trot pendant
 *    Bonus d'Endurance heures ; au petit galop pendant la MOITIÉ du Bonus d'Endurance en heures.
 *  - Au-delà (EDOC 07 l.146) : par heure supplémentaire, +1 Exténué + Test de Résistance Intermédiaire
 *    (+0) ; échec → +1 Exténué de plus ET jet sur le Tableau des Incidents de monte (l.148-155,
 *    `rollMountIncident` — la donnée `incidents-monture.json`). Exténué > Bonus d'Endurance → la bête
 *    s'effondre (Sonné + À Terre) puis dernier Test de Résistance (+0) « sans aucun modificateur » ;
 *    échec = morte.
 *  - Incidents (EDOC 07 l.157-174) : Sangle cassée / Perte d'un fer → Test de Chevaucher Complexe (-10)
 *    du cavalier ou chute de 2 mètres (Dégâts de Chute appliqués par l'appelant) ; Sangle → -20 aux
 *    futurs Tests de Chevaucher jusqu'à réparation ; Fer → l'animal au pas jusqu'au maréchal-ferrant ;
 *    Boiteux → ½ vitesse de marche, ni monté ni attelé ; Patte brisée → Fracture (Majeure), immobile.
 *
 * Une monture du groupe = un animal POSSÉDÉ (ItemInstance d'un héros, trapping `animaux-et-vehicules`)
 * dont l'id figure dans `montures.json`. L'état d'incident persiste sur l'instance (`mountInjury`).
 * L'Exténué des bêtes est journalier (la halte de nuit vaut repos — LDB 16, l'Exténué part au repos).
 */
import monturesJson from '../data/montures.json';
import type { Combatant, ItemInstance } from './types';
import { d100, type RNG } from './dice';
import { rollTest, testDetail } from './tests';
import { testValue } from './skills';
import { rollMountIncident, type TravelTableEntry } from './travelTables';

export type Allure = 'pas' | 'trot' | 'galop';
export const ALLURES: readonly Allure[] = ['pas', 'trot', 'galop'];
export const ALLURE_LABEL: Record<Allure, string> = { pas: 'Pas', trot: 'Trot', galop: 'Petit galop' };
/** EDOC 07 l.140 : km/h par point de Mouvement, selon l'allure. */
export const ALLURE_KMH_PER_M: Record<Allure, number> = { pas: 1.5, trot: 2.5, galop: 3 };

/** Une ligne de la table EDOC (M + Endurance + « trotte ou pas ») liée aux trappings possédables. */
export interface MountProfile {
  id: string;
  label: string;
  /** Trappings de la base (`animaux-et-vehicules`) auxquels ce profil s'applique. */
  trappingIds: string[];
  /** Mouvement (EDOC 07 l.121-130). */
  m: number;
  /** Endurance du profil (EDOC 07 l.17-96) — le Bonus en dérive. */
  e: number;
  /** La bête trotte-t-elle ? (colonne Trot « - » pour chien/poney/trait/bœuf, l.121-130). */
  trot: boolean;
}

export const MOUNT_PROFILES: MountProfile[] = (monturesJson as { entries: MountProfile[] }).entries;
const BY_ID = new Map(MOUNT_PROFILES.map((p) => [p.id, p]));
const BY_TRAPPING = new Map(MOUNT_PROFILES.flatMap((p) => p.trappingIds.map((t) => [t, p] as const)));

export function mountProfileById(id: string): MountProfile | undefined {
  return BY_ID.get(id);
}
export function mountProfileForTrapping(trappingId: string): MountProfile | undefined {
  return BY_TRAPPING.get(trappingId);
}
/** Bonus d'Endurance d'un profil (dizaines de E). */
export const mountBE = (p: MountProfile): number => Math.floor(p.e / 10);

/** Incidents de monte PERSISTANTS sur l'instance (EDOC 07 l.157-174). */
export type MountInjury = 'sangle-cassee' | 'perte-d-un-fer' | 'boiteux' | 'patte-brisee';

/** Une monture du groupe : le héros propriétaire (= cavalier), l'instance, le profil EDOC. */
export interface PartyMount {
  hero: Combatant;
  item: ItemInstance;
  profile: MountProfile;
}

/** Cette bête peut-elle (encore) être montée ? Boiteux : « ne peut pas … être monté » (l.157) ;
 *  Patte brisée : « demeure immobile » (l.161). */
const rideable = (i: ItemInstance): boolean =>
  !i.destroyed && i.mountInjury !== 'boiteux' && i.mountInjury !== 'patte-brisee';

/** Monture UTILISABLE d'un héros : premier animal possédé au profil EDOC, encore montable. */
export function heroMount(h: Combatant): PartyMount | undefined {
  for (const item of h.items ?? []) {
    const profile = item.trappingId ? mountProfileForTrapping(item.trappingId) : undefined;
    if (profile && rideable(item)) return { hero: h, item, profile };
  }
  return undefined;
}

/** Les montures des héros VIVANTS du groupe (un héros = au plus une monture). */
export function partyMounts(party: Combatant[]): PartyMount[] {
  return party
    .filter((h) => !h.dead && !h.outOfRencontre)
    .map(heroMount)
    .filter((m): m is PartyMount => !!m);
}

/** Le groupe peut-il voyager en selle ? (chaque héros vivant a une monture utilisable). */
export function partyFullyMounted(party: Combatant[]): boolean {
  const alive = party.filter((h) => !h.dead && !h.outOfRencontre);
  return alive.length > 0 && alive.every((h) => !!heroMount(h));
}

/** Allures praticables PAR LE GROUPE : le trot exige que TOUTES les bêtes trottent (l.121-130). */
export function availableAllures(mounts: PartyMount[]): Allure[] {
  if (!mounts.length) return [];
  return mounts.every((m) => m.profile.trot) ? ['pas', 'trot', 'galop'] : ['pas', 'galop'];
}

/** Allure EFFECTIVE d'une bête : Perte d'un fer → « au pas jusqu'à ce que le fer ait été remplacé »
 *  (l.166) ; une bête qui ne trotte pas (l.121-130) reste au pas quand le groupe trotte. */
function effectiveAllure(m: PartyMount, allure: Allure): Allure {
  if (m.item.mountInjury === 'perte-d-un-fer') return 'pas';
  if (allure === 'trot' && !m.profile.trot) return 'pas';
  return allure;
}

/** Vitesse du groupe en selle (km/h) : la plus LENTE des montures à l'allure choisie (EDOC 07 l.140). */
export function mountedSpeedKmh(mounts: PartyMount[], allure: Allure): number {
  if (!mounts.length) return 0;
  return Math.min(...mounts.map((m) => m.profile.m * ALLURE_KMH_PER_M[effectiveAllure(m, allure)]));
}

/** Endurance d'une allure, en heures (EDOC 07 l.142-144) : pas 12 h ; trot BE h ; galop ½ BE h. */
export function allureEnduranceHours(p: MountProfile, allure: Allure): number {
  if (allure === 'pas') return 12;
  return allure === 'trot' ? mountBE(p) : mountBE(p) / 2;
}

/** Bête Boiteuse MENÉE à pied : « pas plus vite que la moitié de sa vitesse de marche » (l.157) —
 *  plafond de km/h pour un groupe qui continue à pied avec elle. `null` si aucune bête boiteuse. */
export function lameLedCapKmh(party: Combatant[]): number | null {
  let cap: number | null = null;
  for (const h of party) {
    if (h.dead || h.outOfRencontre) continue;
    for (const item of h.items ?? []) {
      if (item.mountInjury !== 'boiteux' || !item.trappingId) continue;
      const p = mountProfileForTrapping(item.trappingId);
      if (!p) continue;
      const kmh = (p.m * ALLURE_KMH_PER_M.pas) / 2;
      cap = cap == null ? kmh : Math.min(cap, kmh);
    }
  }
  return cap;
}

/** Ligne de jet (forme partagée `testDetail`). */
export type MountTestLine = ReturnType<typeof testDetail>;

export interface MountIncidentResolved {
  entry: TravelTableEntry;
  /** État persistant posé sur l'instance (`mountInjury`). */
  injury?: MountInjury;
  /** Test de Chevaucher du cavalier (Sangle cassée / Perte d'un fer, l.165-174). */
  riderTest?: MountTestLine;
  /** Chute de selle ratée : hauteur en mètres (2 m, l.166/l.171) — Dégâts de Chute côté appelant. */
  riderFallM?: number;
  lines: string[];
}

/**
 * Résout UN Incident de monte (EDOC 07 l.157-174) pour une monture et son cavalier. PUR (ne mute pas
 * l'instance : l'appelant pose `injury` et applique la chute). Le -20 d'une Sangle cassée antérieure
 * s'applique aux Tests de Chevaucher suivants (l.174) — lu sur `item.mountInjury`.
 */
export function resolveMountIncident(entry: TravelTableEntry, mount: PartyMount, rng: RNG): MountIncidentResolved {
  const out: MountIncidentResolved = { entry, lines: [`Incident de monte (${mount.item.name}) : ${entry.label}.`] };
  switch (entry.id) {
    case 'sangle-cassee':
    case 'perte-d-un-fer': {
      // Test de Chevaucher Complexe (-10) du cavalier, ou chute de 2 mètres (l.166 / l.171).
      const saddleMod = mount.item.mountInjury === 'sangle-cassee' ? -20 : 0; // sellerie déjà abîmée (l.174)
      const base = testValue(mount.hero, 'chevaucher', 'agilite') + saddleMod;
      const t = rollTest(Math.max(0, base), 'complexe', rng);
      out.riderTest = testDetail('Chevaucher', Math.max(0, base), t);
      if (!t.success) {
        out.riderFallM = 2;
        out.lines.push(`${mount.hero.name} vide les étriers et chute (2 mètres).`);
      } else {
        out.lines.push(`${mount.hero.name} se maintient en selle.`);
      }
      out.injury = entry.id;
      out.lines.push(entry.id === 'sangle-cassee'
        ? `La sellerie de ${mount.item.name} est endommagée (-20 en Chevaucher jusqu'à réparation).`
        : `${mount.item.name} doit aller au pas jusqu'au maréchal-ferrant.`);
      break;
    }
    case 'boiteux':
      out.injury = 'boiteux';
      out.lines.push(`${mount.item.name} boite — la bête ne peut plus être montée ni attelée.`);
      break;
    case 'patte-brisee':
      out.injury = 'patte-brisee';
      out.lines.push(`${mount.item.name} se brise une patte — Fracture (Majeure), la bête est condamnée.`);
      break;
    default:
      break;
  }
  return out;
}

export interface MountDayOutcome {
  mount: PartyMount;
  /** Heures chevauchées AU-DELÀ de l'endurance de l'allure (EDOC 07 l.146). */
  overHours: number;
  /** États Exténué accumulés par la bête ce jour (repartent à la halte de nuit). */
  extenue: number;
  tests: MountTestLine[];
  incidents: MountIncidentResolved[];
  /** Exténué > BE : la bête s'effondre — Sonné + À Terre (l.146). */
  collapsed: boolean;
  /** Dernier Test de Résistance (+0), « sans aucun modificateur », raté : la bête est morte (l.146). */
  dead: boolean;
  lines: string[];
}

/**
 * Résout la fatigue d'UNE journée en selle (EDOC 07 l.142-146) pour chaque monture : par heure au-delà
 * de l'endurance de l'allure, +1 Exténué + Test de Résistance Intermédiaire (+0), avec le malus d'États
 * Exténué de la bête (-10 par État, LDB 16) ; échec → +1 Exténué ET Incident de monte. Exténué > BE →
 * effondrement (Sonné + À Terre) puis Test de Résistance SANS modificateur ; échec = morte.
 * PUR : rend l'issue structurée, l'appelant applique (injuries, chute du cavalier, retrait de la bête).
 */
export function resolveMountedDay(mounts: PartyMount[], hours: number, allure: Allure, rng: RNG): MountDayOutcome[] {
  const out: MountDayOutcome[] = [];
  for (const mount of mounts) {
    const p = mount.profile;
    const be = mountBE(p);
    const endurance = allureEnduranceHours(p, effectiveAllure(mount, allure));
    const overHours = Math.max(0, hours - endurance);
    const o: MountDayOutcome = { mount, overHours, extenue: 0, tests: [], incidents: [], collapsed: false, dead: false, lines: [] };
    for (let h = 0; h < Math.ceil(overHours - 1e-9); h++) {
      o.extenue += 1; // « il gagne un État Exténué » (l.146)
      const base = Math.max(0, p.e - 10 * o.extenue); // -10 par État Exténué (LDB 16)
      const t = rollTest(base, 'intermediaire', rng);
      o.tests.push(testDetail(`Résistance (${mount.item.name})`, base, t));
      if (!t.success) {
        o.extenue += 1; // « l'animal prend un nouvel État Exténué » (l.146)
        const inc = resolveMountIncident(rollMountIncident(d100(rng)), mount, rng);
        o.incidents.push(inc);
        o.lines.push(...inc.lines);
        // Bête qui ne peut plus être montée : la journée de selle s'arrête là pour elle.
        if (inc.injury === 'boiteux' || inc.injury === 'patte-brisee') break;
      }
      if (o.extenue > be) {
        o.collapsed = true; // Sonné + À Terre (l.146)
        const t2 = rollTest(p.e, 'intermediaire', rng); // « sans aucun modificateur »
        o.tests.push(testDetail(`Résistance (${mount.item.name}, effondrement)`, p.e, t2));
        o.dead = !t2.success;
        o.lines.push(o.dead
          ? `${mount.item.name} s'effondre, poussée jusqu'à la mort.`
          : `${mount.item.name} s'effondre d'épuisement (Sonné, À Terre).`);
        break;
      }
    }
    if (o.extenue > 0 && !o.collapsed) o.lines.push(`${mount.item.name} termine la journée fourbue (+${o.extenue} Exténué).`);
    out.push(o);
  }
  return out;
}
