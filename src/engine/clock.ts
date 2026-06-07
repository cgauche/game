/**
 * Calendrier impérial WFRP4 (CI) — pur, sans état. Données vérifiées depuis la source FR
 * (EiS « L'ennemi dans l'Ombre » Annexe 3, croisées ADE2/Middenheim/VO ; cf. plan #T1).
 *
 * ⚠️ Le canon affirme « année = 400 jours, 12 mois + 6 intercalaires » (Annexe 3 l.20/34) mais
 * n'imprime AUCUNE table mois→jours propre ; les grilles OCR donnent 32/33 j (somme 395). On
 * adopte une table AUTO-COHÉRENTE (395 + 6 = 401 j/an) ; ajuster `IMPERIAL_MONTHS` si la valeur
 * exacte du PDF est confirmée. Aucune valeur inventée hors de cette table sourcée.
 */
export interface ImperialMonth { name: string; days: number; }

/** 12 mois, dans l'ordre (confiance très haute : 3 sources concordantes). */
export const IMPERIAL_MONTHS: ImperialMonth[] = [
  { name: 'Nachhexen', days: 32 }, { name: 'Jahrdrung', days: 33 }, { name: 'Pflugzeit', days: 33 },
  { name: 'Sigmarzeit', days: 33 }, { name: 'Sommerzeit', days: 33 }, { name: 'Vorgeheim', days: 33 },
  { name: 'Nachgeheim', days: 33 }, { name: 'Erntezeit', days: 33 }, { name: 'Brauzeit', days: 33 },
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

export const DAYS_PER_YEAR = YEAR_SLOTS.length; // 395 + 6 = 401

export interface ImperialDate {
  year: number;
  /** Index 0-based du mois, ou null si jour intercalaire. */
  month: number | null;
  monthName: string | null;
  /** Jour dans le mois (1-based), ou null si intercalaire. */
  day: number | null;
  /** Nom du jour intercalaire, ou null si jour de mois. */
  intercalary: string | null;
  /** Jour de la semaine (nom). */
  weekday: string;
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
  const weekday = WEEKDAYS[((totalDays % WEEKDAYS.length) + WEEKDAYS.length) % WEEKDAYS.length];
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
