import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from "date-fns";
import type { CalendarEntry } from "./inventory-types";

export function localDateIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function calendarDaysForMonth(monthIso: string) {
  const month = parseISO(monthIso);
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start: first, end: last }).map((date) => ({
    dateIso: localDateIso(date),
    dayNumber: format(date, "d"),
    inMonth: isSameMonth(date, month)
  }));
}

export function calendarEntryOccursOnDate(entry: CalendarEntry, dateIso: string) {
  const start = parseISO(entry.date);
  const candidate = parseISO(dateIso);
  const dayDifference = differenceInCalendarDays(candidate, start);
  if (dayDifference < 0) return false;
  if (entry.repeatUntil && dateIso > entry.repeatUntil) return false;
  if (entry.repeat === "Daily") return true;
  if (entry.repeat === "Weekly") return dayDifference % 7 === 0;
  if (entry.repeat === "Monthly") {
    const startDay = start.getDate();
    const candidateDay = candidate.getDate();
    if (candidateDay === startDay) return true;
    // An event on a day the month doesn't have (e.g. the 31st in February)
    // occurs on that month's last day instead of being skipped entirely.
    const lastDayOfCandidateMonth = endOfMonth(candidate).getDate();
    return startDay > lastDayOfCandidateMonth && candidateDay === lastDayOfCandidateMonth;
  }
  if (entry.repeat === "Yearly") return format(candidate, "MM-dd") === format(start, "MM-dd");
  return dateIso === entry.date;
}

export function upcomingCalendarOccurrences(entries: CalendarEntry[], fromIso: string, numberOfDays = 60) {
  const days = eachDayOfInterval({ start: parseISO(fromIso), end: addDays(parseISO(fromIso), numberOfDays) });
  return days
    .flatMap((date) => {
      const dateIso = localDateIso(date);
      return entries
        .filter((entry) => calendarEntryOccursOnDate(entry, dateIso))
        .map((entry) => ({ entry, dateIso }));
    })
    .sort((a, b) => `${a.dateIso}T${a.entry.startTime || "00:00"}`.localeCompare(`${b.dateIso}T${b.entry.startTime || "00:00"}`));
}

export function calendarTimeLabel(entry: CalendarEntry) {
  if (entry.allDay) return "All day";
  if (!entry.startTime) return "Time not set";
  return entry.endTime ? `${entry.startTime} - ${entry.endTime}` : entry.startTime;
}
