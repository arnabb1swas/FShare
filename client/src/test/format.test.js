import { describe, it, expect } from "vitest";
import { formatSize, formatCountdown } from "../lib/format.js";

describe("formatSize", () => {
  it("bytes", () => expect(formatSize(500)).toBe("500 B"));
  it("kb", () => expect(formatSize(1536)).toBe("1.5 KB"));
  it("mb", () => expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB"));
});

describe("formatCountdown", () => {
  const now = new Date("2026-07-19T00:00:00Z");
  it("hours + minutes", () =>
    expect(formatCountdown("2026-07-19T23:30:00Z", now)).toBe("expires in 23h 30m"));
  it("days", () =>
    expect(formatCountdown("2026-07-22T00:00:00Z", now)).toBe("expires in 3d 0h"));
  it("past", () =>
    expect(formatCountdown("2026-07-18T00:00:00Z", now)).toBe("expired"));
});
