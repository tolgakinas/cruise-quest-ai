export function hoursAshore(arrival: string | null, departure: string | null) {
  if (!arrival || !departure) return null;
  const a = arrival.split(":").map(Number);
  const d = departure.split(":").map(Number);
  const minutes = (d[0] ?? 0) * 60 + (d[1] ?? 0) - ((a[0] ?? 0) * 60 + (a[1] ?? 0));
  return minutes > 0 ? minutes / 60 : null;
}

export function shortTime(value: string | null) {
  return value ? value.slice(0, 5) : "—";
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function formatMoney(amount: number | string, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLong(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
