/** Typical monthly high/low °F for common DCL ports (climate averages, not forecasts). */

export type ClimateRange = { highF: number; lowF: number };

/** month 1–12 → averages */
const BY_PORT: Record<string, Partial<Record<number, ClimateRange>>> = {
  "lookout-cay": {
    10: { highF: 86, lowF: 75 },
    11: { highF: 83, lowF: 72 },
    12: { highF: 80, lowF: 69 },
  },
  nassau: {
    10: { highF: 86, lowF: 75 },
    11: { highF: 83, lowF: 72 },
    12: { highF: 80, lowF: 69 },
  },
  "castaway-cay": {
    10: { highF: 86, lowF: 75 },
    11: { highF: 83, lowF: 72 },
  },
  cozumel: {
    10: { highF: 87, lowF: 74 },
    11: { highF: 84, lowF: 72 },
  },
  "port-everglades": {
    10: { highF: 86, lowF: 73 },
  },
};

export function monthFromYmd(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const m = Number(ymd.slice(5, 7));
  return m >= 1 && m <= 12 ? m : null;
}

export function climateForPort(portId: string, month: number): ClimateRange | null {
  const table = BY_PORT[portId];
  if (!table) return null;
  return table[month] ?? null;
}

export function formatClimate(range: ClimateRange): string {
  return `avg high ${range.highF}°F / low ${range.lowF}°F`;
}
