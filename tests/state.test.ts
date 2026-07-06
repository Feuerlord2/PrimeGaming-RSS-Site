import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "../src/state";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "state-test-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("state", () => {
  it("round-trips seen dates", async () => {
    const file = path.join(dir, "nested", "state.json");
    const state = {
      "https://example.com/b": "2026-01-02T00:00:00.000Z",
      "https://example.com/a": "2026-01-01T00:00:00.000Z",
    };
    await saveState(file, state);
    expect(await loadState(file)).toEqual(state);
  });

  it("returns an empty state for a missing file", async () => {
    expect(await loadState(path.join(dir, "missing.json"))).toEqual({});
  });

  it("returns an empty state for corrupt JSON", async () => {
    const file = path.join(dir, "state.json");
    await fs.writeFile(file, "{not json", "utf8");
    expect(await loadState(file)).toEqual({});
  });

  it("drops non-string values", async () => {
    const file = path.join(dir, "state.json");
    await fs.writeFile(
      file,
      JSON.stringify({ a: "2026-01-01T00:00:00.000Z", b: 42 }),
      "utf8",
    );
    expect(await loadState(file)).toEqual({ a: "2026-01-01T00:00:00.000Z" });
  });
});
