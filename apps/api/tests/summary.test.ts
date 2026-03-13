import { describe, expect, it } from "vitest";
import { buildWhatTheyDoSummary } from "../src/services/summary.js";

describe("summary", () => {
  it("uses description when available", () => {
    const summary = buildWhatTheyDoSummary("  premium skin clinic services in london ");
    expect(summary).toBe("Premium skin clinic services in london");
  });

  it("falls back to business name", () => {
    const summary = buildWhatTheyDoSummary(undefined, "Nova Studio");
    expect(summary).toContain("Nova Studio");
  });
});
