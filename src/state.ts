import fs from "fs/promises";
import path from "path";
import { offerKey } from "./utils";

/** First/last sighting of an offer, both ISO 8601 timestamps. */
export interface SeenEntry {
  first: string;
  last: string;
}

/** Maps a stable offer key (see offerKey) to its sighting dates. */
export type SeenDates = Record<string, SeenEntry>;

/**
 * Offers missing from a scrape are remembered this long, so one partial
 * scrape doesn't erase first-seen dates of games that briefly drop out.
 */
const RETENTION_DAYS = 90;

export async function loadState(filePath: string): Promise<SeenDates> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("state is not an object");
    }
    const state: SeenDates = {};
    for (const [rawKey, value] of Object.entries(parsed)) {
      // Legacy keys were full URLs, legacy values plain first-seen strings.
      const key = offerKey(rawKey);
      if (typeof value === "string") {
        state[key] = { first: value, last: value };
      } else if (
        value !== null &&
        typeof value === "object" &&
        typeof (value as SeenEntry).first === "string" &&
        typeof (value as SeenEntry).last === "string"
      ) {
        state[key] = {
          first: (value as SeenEntry).first,
          last: (value as SeenEntry).last,
        };
      }
    }
    return state;
  } catch (error) {
    console.warn(`Ignoring corrupt state file ${filePath}:`, error);
    return {};
  }
}

/**
 * Merge the current scrape into the previous state: current offers are
 * stamped as seen now (keeping their original first date), absent offers are
 * retained until they haven't been seen for RETENTION_DAYS.
 */
export function mergeState(
  previous: SeenDates,
  currentKeys: string[],
  now: string,
): SeenDates {
  const cutoff = Date.parse(now) - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const next: SeenDates = {};
  for (const [key, entry] of Object.entries(previous)) {
    if (Date.parse(entry.last) >= cutoff) next[key] = entry;
  }
  for (const key of currentKeys) {
    next[key] = { first: previous[key]?.first ?? now, last: now };
  }
  return next;
}

export async function saveState(
  filePath: string,
  state: SeenDates,
): Promise<void> {
  const sorted = Object.fromEntries(
    Object.entries(state).sort(([a], [b]) => a.localeCompare(b)),
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}
