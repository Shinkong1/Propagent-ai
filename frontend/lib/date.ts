// `new Date().toISOString().slice(0, 10)` looks like "today's date" but
// toISOString() always returns UTC -- anyone west of UTC sees tomorrow's
// date for several hours every evening (confirmed by a real tester: local
// time 8:49pm showed the 11th when it was still the 10th locally). Use this
// instead anywhere a plain YYYY-MM-DD "today" (or any local Date) is needed
// for a date-only input default.
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The reverse direction has its own, nastier version of the same mistake:
// a date-only string like "2026-08-10" (no time component) parses as UTC
// MIDNIGHT per the ECMAScript spec -- unlike a datetime string, which parses
// as local time. Piping that straight into toLocaleDateString() (or reading
// .getMonth()/.getFullYear() off it) then renders in the browser's local
// timezone, so anyone west of UTC sees the date rolled back by one -- not
// just in the evening like the "today" bug, but essentially always, since
// the day always starts at UTC midnight regardless of local time. Worse for
// month-boundary dates: a payment paid_date of "2026-08-01" can get bucketed
// into July on a revenue chart. Use this for any bare "YYYY-MM-DD" field
// from the backend (Lease start_date/end_date, Payment due_date/paid_date,
// RentalInquiry desired_move_in, etc.) before formatting or reading date
// parts off it -- constructing from the parsed y/m/d forces local midnight.
export function parseLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d);
}
