import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, mergeState, saveState } from "../src/state";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "state-test-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("loadState/saveState", () => {
  it("round-trips seen dates", async () => {
    const file = path.join(dir, "nested", "state.json");
    const state = {
      "amzn1.pg.item.b": {
        first: "2026-01-02T00:00:00.000Z",
        last: "2026-01-03T00:00:00.000Z",
      },
      "amzn1.pg.item.a": {
        first: "2026-01-01T00:00:00.000Z",
        last: "2026-01-03T00:00:00.000Z",
      },
    };
    await saveState(file, state);
    expect(await loadState(file)).toEqual(state);
  });

  it("migrates the legacy url-to-string format", async () => {
    const file = path.join(dir, "state.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        "https://luna.amazon.de/claims/x/dp/amzn1.pg.item.abc-123?ref_=SM_X_S01":
          "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    expect(await loadState(file)).toEqual({
      "amzn1.pg.item.abc-123": {
        first: "2026-01-01T00:00:00.000Z",
        last: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns an empty state for a missing file", async () => {
    expect(await loadState(path.join(dir, "missing.json"))).toEqual({});
  });

  it("returns an empty state for corrupt JSON", async () => {
    const file = path.join(dir, "state.json");
    await fs.writeFile(file, "{not json", "utf8");
    expect(await loadState(file)).toEqual({});
  });

  it("drops malformed values", async () => {
    const file = path.join(dir, "state.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        a: { first: "2026-01-01T00:00:00.000Z", last: "2026-01-01T00:00:00.000Z" },
        b: 42,
        c: { first: "2026-01-01T00:00:00.000Z" },
      }),
      "utf8",
    );
    expect(Object.keys(await loadState(file))).toEqual(["a"]);
  });
});

describe("mergeState", () => {
  const now = "2026-07-06T00:00:00.000Z";

  it("keeps the first-seen date of offers still present", () => {
    const previous = {
      a: { first: "2026-01-01T00:00:00.000Z", last: "2026-07-05T00:00:00.000Z" },
    };
    expect(mergeState(previous, ["a"], now)).toEqual({
      a: { first: "2026-01-01T00:00:00.000Z", last: now },
    });
  });

  it("stamps unknown offers with now", () => {
    expect(mergeState({}, ["a"], now)).toEqual({
      a: { first: now, last: now },
    });
  });

  it("retains recently absent offers so a partial scrape loses nothing", () => {
    const previous = {
      gone: {
        first: "2026-01-01T00:00:00.000Z",
        last: "2026-07-05T00:00:00.000Z",
      },
    };
    const next = mergeState(previous, [], now);
    expect(next.gone.first).toBe("2026-01-01T00:00:00.000Z");
  });

  it("expires offers absent for longer than the retention window", () => {
    const previous = {
      old: {
        first: "2025-01-01T00:00:00.000Z",
        last: "2026-01-01T00:00:00.000Z",
      },
    };
    expect(mergeState(previous, [], now)).toEqual({});
  });
});
