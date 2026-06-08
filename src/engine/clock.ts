/**
 * Calendrier impérial WFRP4 (CI) — pur, sans état. Données vérifiées depuis la source FR
 * (EiS « L'ennemi dans l'Ombre » Annexe 3, croisées ADE2/Middenheim/VO ; cf. plan #T1).
 *
 * Année = 400 jours (orbite de Mallus autour de Söll) : EiS Annexe 3 l.20 « le monde met 400 jours
 * pour évoluer autour de Söll » + l.68 « notre monde, 400 » + l.34 ; confirmé Fandom/Lexicanum
 * (« 400 days, twelve months of 32 or 33 days, six intercalary holidays »). Les 6 intercalaires sont
 * INCLUS dans les 400 → les 12 mois somment à 394 = 2 mois à 32 j + 10 à 33 j. Le canon ne publie
 * pas de table mois→jours propre (grilles OCR illisibles) ; on retient le découpage de consensus
 * communautaire (Nachhexen & Nachgeheim = 32, les deux mois qui suivent les fêtes des 2 lunes
 * pleines), seul à satisfaire les 400 j. Les jours intercalaires sont HORS du cycle hebdomadaire
 * (Annexe 3 « intercalés entre les mois » ; Fandom « outside the normal sequence of weekdays… the
 * eight-day weeks bridge the months uninterrupted, even if a week is broken by a festival »).
 */
export interface ImperialMonth { name: string; days: number; }

/** 12 mois, dans l'ordre (confiance très haute : 3 sources concordantes). */
export const IMPERIAL_MONTHS: ImperialMonth[] = [
  { name: 'Nachhexen', days: 32 }, { name: 'Jahrdrung', days: 33 }, { name: 'Pflugzeit', days: 33 },
  { name: 'Sigmarzeit', days: 33 }, { name: 'Sommerzeit', days: 33 }, { name: 'Vorgeheim', days: 33 },
  { name: 'Nachgeheim', days: 32 }, { name: 'Erntezeit', days: 33 }, { name: 'Brauzeit', days: 33 },
  { name: 'Kaldezeit', days: 33 }, { name: 'Ulriczeit', days: 33 }, { name: 'Vorhexen', days: 33 },
];

/** 6 jours intercalaires (1 jour chacun). `afterMonth` = index (0-based) du mois APRÈS lequel il tombe ;
 *  -1 = avant le 1er mois (Hexenstag, Nouvel An). */
export const INTERCALARY: { name: string; afterMonth: number }[] = [
  { name: 'Hexenstag', afterMonth: -1 },   // avant Nachhexen (Nouvel An, 2 lunes pleines)
  { name: 'Mitterfrühl', afterMonth: 1 },  // après Jahrdrung (équinoxe printemps)
  { name: 'Sonnstill', afterMonth: 4 },    // après Sommerzeit (solstice été)
  { name: 'Geheimnistag', afterMonth: 5 }, // après Vorgeheim (2 lunes pleines)
  { name: 'Mittherbst', afterMonth: 7 },   // après Erntezeit (équinoxe automne)
  { name: 'Mondstille', afterMonth: 8 },   // après Brauzeit (solstice hiver)
];

export const WEEKDAYS = ['Wellentag', 'Aubentag', 'Marktag', 'Backertag', 'Bezahltag', 'Konistag', 'Angestag', 'Festag'] as const;

export const MINUTES_PER_DAY = 24 * 60;
export const EPOCH_YEAR = 2512; // minute 0 = Hexenstag 2512 00:00

/** Séquence ordonnée des « slots de jour » d'une année (intercalaires intercalés entre les mois). */
const YEAR_SLOTS: ({ intercalary: string } | { monthIndex: number; day: number })[] = (() => {
  const slots: ({ intercalary: string } | { monthIndex: number; day: number })[] = [];
  const inter = (after: number) => INTERCALARY.filter((i) => i.afterMonth === after);
  for (const i of inter(-1)) slots.push({ intercalary: i.name }); // Hexenstag avant le mois 0
  for (let m = 0; m < IMPERIAL_MONTHS.length; m++) {
    for (let d = 1; d <= IMPERIAL_MONTHS[m].days; d++) slots.push({ monthIndex: m, day: d });
    for (const i of inter(m)) slots.push({ intercalary: i.name });
  }
  return slots;
})();

export const DAYS_PER_YEAR = YEAR_SLOTS.length; // 394 (mois) + 6 (intercalaires) = 400

/** Jours de MOIS par an (les intercalaires sont HORS de la semaine de 8 jours, cf. canon). */
export const MONTH_DAYS_PER_YEAR = IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0); // 394

/** Pour chaque slot de l'année : nombre de jours de MOIS qui le précèdent (un intercalaire n'avance
 *  pas la semaine — elle « enjambe » les fêtes). Sert à dériver le jour de la semaine. */
const MONTH_DAYS_BEFORE_SLOT: number[] = (() => {
  const arr: number[] = [];
  let c = 0;
  for (const slot of YEAR_SLOTS) { arr.push(c); if (!('intercalary' in slot)) c++; }
  return arr;
})();

export interface ImperialDate {
  year: number;
  /** Index 0-based du mois, ou null si jour intercalaire. */
  month: number | null;
  monthName: string | null;
  /** Jour dans le mois (1-based), ou null si intercalaire. */
  day: number | null;
  /** Nom du jour intercalaire, ou null si jour de mois. */
  intercalary: string | null;
  /** Jour de la semaine (nom), ou null pour un jour intercalaire (hors du cycle hebdomadaire, canon). */
  weekday: string | null;
  hour: number;
  minute: number;
}

/** Minutes depuis l'époque → date impériale. */
export function toDate(minutes: number): ImperialDate {
  const totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const minOfDay = minutes - totalDays * MINUTES_PER_DAY;
  const year = EPOCH_YEAR + Math.floor(totalDays / DAYS_PER_YEAR);
  const dayOfYear = ((totalDays % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const slot = YEAR_SLOTS[dayOfYear];
  // Semaine de 8 jours CONTINUE qui enjambe les intercalaires : seuls les jours de MOIS comptent ;
  // un intercalaire est hors du cycle (weekday = null). Ancre : 1 Nachhexen 2512 = Wellentag (index 0,
  // aucune ancre canon connue — convention documentée).
  const monthDaysElapsed = (year - EPOCH_YEAR) * MONTH_DAYS_PER_YEAR + MONTH_DAYS_BEFORE_SLOT[dayOfYear];
  const weekday = 'intercalary' in slot ? null : WEEKDAYS[((monthDaysElapsed % 8) + 8) % 8];
  const base = { year, weekday, hour: Math.floor(minOfDay / 60), minute: minOfDay % 60 };
  return 'intercalary' in slot
    ? { ...base, month: null, monthName: null, day: null, intercalary: slot.intercalary }
    : { ...base, month: slot.monthIndex, monthName: IMPERIAL_MONTHS[slot.monthIndex].name, day: slot.day, intercalary: null };
}

/** Date impériale → minutes depuis l'époque (inverse de toDate). */
export function fromDate(d: ImperialDate): number {
  const dayOfYear = YEAR_SLOTS.findIndex((s) =>
    d.intercalary != null ? 'intercalary' in s && s.intercalary === d.intercalary
      : 'monthIndex' in s && s.monthIndex === d.month && s.day === d.day,
  );
  const totalDays = (d.year - EPOCH_YEAR) * DAYS_PER_YEAR + dayOfYear;
  return totalDays * MINUTES_PER_DAY + d.hour * 60 + d.minute;
}

/** « 30 Jahrdrung 2512 CI · 14:30 » ou « Hexenstag 2512 CI · 08:00 » (intercalaire). */
export function formatImperial(minutes: number): string {
  const d = toDate(minutes);
  const hhmm = `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
  const datePart = d.intercalary ? `${d.intercalary} ${d.year} CI` : `${d.day} ${d.monthName} ${d.year} CI`;
  return `${datePart} · ${hhmm}`;
}

/** Début de la campagne (EiS) : dernier jour de Jahrdrung 2512, 08:00 (« fin Jahrdrung », année défaut WFRP4). */
export const CAMPAIGN_START = fromDate({
  year: 2512, month: 1, monthName: 'Jahrdrung', day: IMPERIAL_MONTHS[1].days,
  intercalary: null, weekday: WEEKDAYS[0], hour: 8, minute: 0,
});

// ─── Phases du jour (#T1c) ─── affichage riche, découplé de l'obscurité mécanique ───
export type DayPhaseKey = 'aube' | 'matin' | 'midi' | 'apresmidi' | 'crepuscule' | 'soir' | 'nuit';
export interface DayPhase { key: DayPhaseKey; label: string; icon: string; isNight: boolean; }

/** Table ordonnée des phases d'AFFICHAGE : heure de début (minutes-de-jour) + libellé FR + icône.
 *  Paramétrable (canon muet sur l'heure exacte du lever/coucher). 'nuit' enjambe minuit (00:00–05:00). */
export const DAY_PHASES: { key: DayPhaseKey; start: number; label: string; icon: string }[] = [
  { key: 'aube',       start:  5 * 60, label: 'Aube',       icon: '🌅' },
  { key: 'matin',      start:  8 * 60, label: 'Matin',      icon: '🌄' },
  { key: 'midi',       start: 11 * 60, label: 'Midi',       icon: '☀️' },
  { key: 'apresmidi',  start: 14 * 60, label: 'Après-midi', icon: '🌤️' },
  { key: 'crepuscule', start: 18 * 60, label: 'Crépuscule', icon: '🌇' },
  { key: 'soir',       start: 20 * 60, label: 'Soir',       icon: '🌆' },
  { key: 'nuit',       start: 22 * 60, label: 'Nuit',       icon: '🌙' },
];

/** Fenêtre d'OBSCURITÉ mécanique (combat −20 tir / rendu sombre), paramétrable et DÉCOUPLÉE des
 *  phases d'affichage. [start,end) en minutes-de-jour ; enjambe minuit (22:00 → 05:00). */
export const NIGHT_WINDOW = { start: 22 * 60, end: 5 * 60 } as const;

const minuteOfDay = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Obscurité ? (seul seuil mécanique). Vrai si l'heure du jour ∈ NIGHT_WINDOW (qui enjambe minuit). */
export function isNight(minutes: number): boolean {
  const m = minuteOfDay(minutes);
  return m >= NIGHT_WINDOW.start || m < NIGHT_WINDOW.end;
}

/** Phase d'affichage (7) pour une heure donnée. */
export function dayPhase(minutes: number): DayPhase {
  const m = minuteOfDay(minutes);
  let chosen = DAY_PHASES[DAY_PHASES.length - 1]; // 'nuit' par défaut (00:00–05:00, avant 'aube')
  for (const p of DAY_PHASES) if (m >= p.start) chosen = p;
  return { key: chosen.key, label: chosen.label, icon: chosen.icon, isNight: isNight(minutes) };
}

/** Minutes à avancer pour atteindre la PROCHAINE occurrence (toujours en avant) de l'heure-du-jour
 *  cible. 0 si on y est déjà. Le temps ne recule jamais (« tout est horodaté »). */
export function minutesUntilNext(currentMinutes: number, targetMinuteOfDay: number): number {
  return (minuteOfDay(targetMinuteOfDay) - minuteOfDay(currentMinutes) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Nombre de débuts de nuit (seuil `NIGHT_WINDOW.start`) franchis dans l'intervalle (before, after].
 *  Sert au déclencheur « chaque nuit » des cauchemars (LDB 21 l.92) : un long repos qui enjambe
 *  plusieurs nuits déclenche un Test par nuit. */
export function nightsCrossed(before: number, after: number): number {
  if (after <= before) return 0;
  const onset = NIGHT_WINDOW.start;
  const kMin = Math.floor((before - onset) / MINUTES_PER_DAY) + 1; // 1er onset strictement > before
  const kMax = Math.floor((after - onset) / MINUTES_PER_DAY); // dernier onset ≤ after
  return Math.max(0, kMax - kMin + 1);
}
