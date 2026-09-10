export function dateKey(value: string | Date): string {
  if (typeof value === "string") {
    const isoDay = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDay) return isoDay[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00`));
}

/** Étiquette relative pour en-têtes d’agenda (Aujourd’hui / Hier / Demain). */
export function relativeDayLabel(day: string, today = todayKey()): string | null {
  if (day === today) return "Aujourd’hui";
  const base = new Date(`${today}T00:00:00`);
  const prev = new Date(base);
  prev.setDate(base.getDate() - 1);
  const next = new Date(base);
  next.setDate(base.getDate() + 1);
  if (day === dateKey(prev)) return "Hier";
  if (day === dateKey(next)) return "Demain";
  return null;
}

export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
}

export function weekdayLabel(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(new Date(`${day}T00:00:00`));
}

/** Agenda style Google Calendar : « jeu » + « 10 ». */
export function scheduleDayParts(day: string): { weekday: string; dayNum: string } {
  const date = new Date(`${day}T00:00:00`);
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" })
    .format(date)
    .replace(/\./g, "")
    .toLowerCase();
  return { weekday, dayNum: String(date.getDate()) };
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
}

export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const weekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: weekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(dateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Dimanche de la semaine contenant `day` (semaine dim → sam). */
export function startOfWeekSunday(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return dateKey(date);
}

/** Sept jours dim → sam pour la semaine de `anchor`. */
export function weekDaysSunday(anchor: string): string[] {
  const start = startOfWeekSunday(anchor);
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
}

/** Libellé court de semaine, ex. « 7 – 13 sept. ». */
export function weekRangeLabel(anchor: string): string {
  const days = weekDaysSunday(anchor);
  const start = days[0]!;
  const end = days[6]!;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  }).format(startDate);
  const endFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(endDate);
  return `${startFmt} – ${endFmt}`;
}
