/**
 * Calendrier impérial WFRP4 (CI) — pur, sans état. Le CONTENU (mois, jours intercalaires, jours de
 * semaine, phases du jour) vit en DONNÉE ÉDITABLE (datasets `calendarMonths`/`calendarIntercalary`/
 * `calendarWeekdays`/`calendarPhases`, éditables au Codex). Ce module ne porte que la MÉCANIQUE
 * temporelle + les scalaires de config (époque, fenêtre de nuit). Source FR vérifiée (EiS Annexe 3
 * l.20/34/68 croisée ADE2/Middenheim/VO ; cf. plan #T1) :
 *
 * Année = 400 jours (orbite de Mallus autour de Söll) ; 6 intercalaires INCLUS dans les 400 → les 12
 * mois somment à 394 = 2 mois à 32 j (Nachhexen & Nachgeheim, après les 2 lunes pleines) + 10 à 33 j.
 * Les jours intercalaires sont HORS du cycle hebdomadaire (« the eight-day weeks bridge the months
 * uninterrupted, even if a week is broken by a festival »).
 *
 * Les tables étant éditables, la DÉRIVATION (slots de l'année) est recalculée à la volée, mémoïsée sur
 * une signature du contenu (mois + intercalaires) → une édition au Codex prend effet immédiatement.
 * Les datasets-tableaux sont mutés EN PLACE (splice) → les réfs exportées (`IMPERIAL_MONTHS`,
 * `DAY_PHASES`, `WEEKDAYS`) restent valides et live.
 */
import { calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases } from '../data';

export interface ImperialMonth { name: string; days: number; }

/** Mois, jours intercalaires, jours de semaine — DONNÉE éditable (réfs live via mutation en place). */
export const IMPERIAL_MONTHS: ImperialMonth[] = calendarMonths;
export const INTERCALARY: { name: string; afterMonth: number }[] = calendarIntercalary;
export const WEEKDAYS: { name: string }[] = calendarWeekdays;

export const MINUTES_PER_DAY = 24 * 60;
export const EPOCH_YEAR = 2512; // minute 0 = Hexenstag 2512 00:00 (scalaire de config)

/** Un « slot de jour » de l'année : soit un jour intercalaire, soit un (mois, jour). */
type YearSlot = { intercalary: string } | { monthIndex: number; day: number };

/** Recalcule la structure de l'année depuis les tables de DONNÉE (mois + intercalaires). */
function buildYearData() {
  const slots: YearSlot[] = [];
  const inter = (after: number) => calendarIntercalary.filter((i) => i.afterMonth === after);
  for (const i of inter(-1)) slots.push({ intercalary: i.name }); // intercalaires avant le 1er mois (Hexenstag)
  for (let m = 0; m < calendarMonths.length; m++) {
    for (let d = 1; d <= calendarMonths[m].days; d++) slots.push({ monthIndex: m, day: d });
    for (const i of inter(m)) slots.push({ intercalary: i.name });
  }
  // Jours de MOIS qui précèdent chaque slot (un intercalaire n'avance pas la semaine — elle enjambe les fêtes).
  const monthDaysBeforeSlot: number[] = [];
  let c = 0;
  for (const slot of slots) { monthDaysBeforeSlot.push(c); if (!('intercalary' in slot)) c++; }
  return {
    slots,
    monthDaysBeforeSlot,
    daysPerYear: slots.length, // 394 (mois) + intercalaires
    monthDaysPerYear: calendarMonths.reduce((s, m) => s + m.days, 0), // jours de mois (hors semaine = HS intercalaires)
  };
}

/** Dérivation MÉMOÏSÉE sur la signature de contenu des tables → recalcul auto à l'édition au Codex. */
let _yearCache: ReturnType<typeof buildYearData> | null = null;
let _yearSig = '';
function yearData() {
  const sig = JSON.stringify([calendarMonths, calendarIntercalary]);
  if (sig !== _yearSig) { _yearSig = sig; _yearCache = buildYearData(); }
  return _yearCache!;
}

/** Nombre de jours dans l'année impériale (live — dérivé des tables). */
export const daysPerYear = (): number => yearData().daysPerYear;
/** Compat : valeur au CHARGEMENT (400) — l'affichage/tests ; le calcul de date utilise `yearData()` live. */
export const DAYS_PER_YEAR = yearData().daysPerYear;

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
  const yd = yearData();
  const totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const minOfDay = minutes - totalDays * MINUTES_PER_DAY;
  const year = EPOCH_YEAR + Math.floor(totalDays / yd.daysPerYear);
  const dayOfYear = ((totalDays % yd.daysPerYear) + yd.daysPerYear) % yd.daysPerYear;
  const slot = yd.slots[dayOfYear];
  // Semaine CONTINUE qui enjambe les intercalaires : seuls les jours de MOIS comptent ; un intercalaire
  // est hors du cycle (weekday = null). Ancre : 1 Nachhexen 2512 = 1er jour de semaine (convention).
  const week = WEEKDAYS.length;
  const monthDaysElapsed = (year - EPOCH_YEAR) * yd.monthDaysPerYear + yd.monthDaysBeforeSlot[dayOfYear];
  const weekday = 'intercalary' in slot ? null : WEEKDAYS[((monthDaysElapsed % week) + week) % week].name;
  const base = { year, weekday, hour: Math.floor(minOfDay / 60), minute: minOfDay % 60 };
  return 'intercalary' in slot
    ? { ...base, month: null, monthName: null, day: null, intercalary: slot.intercalary }
    : { ...base, month: slot.monthIndex, monthName: calendarMonths[slot.monthIndex].name, day: slot.day, intercalary: null };
}

/** Date impériale → minutes depuis l'époque (inverse de toDate). */
export function fromDate(d: ImperialDate): number {
  const yd = yearData();
  const dayOfYear = yd.slots.findIndex((s) =>
    d.intercalary != null ? 'intercalary' in s && s.intercalary === d.intercalary
      : 'monthIndex' in s && s.monthIndex === d.month && s.day === d.day,
  );
  const totalDays = (d.year - EPOCH_YEAR) * yd.daysPerYear + dayOfYear;
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
  intercalary: null, weekday: WEEKDAYS[0].name, hour: 8, minute: 0,
});

// ─── Phases du jour (#T1c) ─── affichage riche, découplé de l'obscurité mécanique ───
export type DayPhaseKey = 'aube' | 'matin' | 'midi' | 'apresmidi' | 'crepuscule' | 'soir' | 'nuit';
export interface DayPhase { key: DayPhaseKey; label: string; icon: string; isNight: boolean; }

/** Phases d'AFFICHAGE (heure de début minutes-de-jour + libellé + icône) — DONNÉE éditable, réf live.
 *  'nuit' enjambe minuit (00:00–05:00). Le canon est muet sur l'heure exacte du lever/coucher. */
export const DAY_PHASES: { key: DayPhaseKey; start: number; label: string; icon: string }[] =
  calendarPhases as { key: DayPhaseKey; start: number; label: string; icon: string }[];

/** Fenêtre d'OBSCURITÉ mécanique (combat −20 tir / rendu sombre), DÉCOUPLÉE des phases d'affichage.
 *  [start,end) en minutes-de-jour ; enjambe minuit (22:00 → 05:00). Scalaire de config. */
export const NIGHT_WINDOW = { start: 22 * 60, end: 5 * 60 } as const;

const minuteOfDay = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Obscurité ? (seul seuil mécanique). Vrai si l'heure du jour ∈ NIGHT_WINDOW (qui enjambe minuit). */
export function isNight(minutes: number): boolean {
  const m = minuteOfDay(minutes);
  return m >= NIGHT_WINDOW.start || m < NIGHT_WINDOW.end;
}

/** Phase d'affichage pour une heure donnée (dernière dont `start` ≤ l'heure ; défaut = la dernière, qui enjambe minuit). */
export function dayPhase(minutes: number): DayPhase {
  const m = minuteOfDay(minutes);
  let chosen = DAY_PHASES[DAY_PHASES.length - 1]; // défaut avant la 1ʳᵉ phase (00:00 → 'aube')
  for (const p of DAY_PHASES) if (m >= p.start) chosen = p;
  return { key: chosen.key, label: chosen.label, icon: chosen.icon, isNight: isNight(minutes) };
}

/** Minutes à avancer pour atteindre la PROCHAINE occurrence (toujours en avant) de l'heure-du-jour
 *  cible. 0 si on y est déjà. Le temps ne recule jamais (« tout est horodaté »). */
export function minutesUntilNext(currentMinutes: number, targetMinuteOfDay: number): number {
  return (minuteOfDay(targetMinuteOfDay) - minuteOfDay(currentMinutes) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Heure de l'aube (minutes-de-jour) — fin d'une nuit de sommeil ; cible du « Dormir ». */
export const DAWN_MINUTE = DAY_PHASES[0].start; // 'aube' = 05:00

/** Heure du crépuscule (minutes-de-jour) — fin d'une journée de voyage AVANT la halte de nuit : le
 *  jour de navigation (fluvial/maritime) s'arrête ici, puis la nuit de sommeil enjambe minuit jusqu'à
 *  l'aube — un seul franchissement de jour par cycle voyage+nuit (aligné sur le voyage terrestre). */
export const DUSK_MINUTE = (DAY_PHASES.find((p) => p.key === 'crepuscule') ?? DAY_PHASES[DAY_PHASES.length - 2]).start; // 'crépuscule' = 18:00
