import fs from "fs/promises";
import path from "path";

/** Maps offer URL to the ISO timestamp it was first seen. */
export type SeenDates = Record<string, string>;

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
    for (const [url, date] of Object.entries(parsed)) {
      if (typeof date === "string") state[url] = date;
    }
    return state;
  } catch (error) {
    console.warn(`Ignoring corrupt state file ${filePath}:`, error);
    return {};
  }
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
