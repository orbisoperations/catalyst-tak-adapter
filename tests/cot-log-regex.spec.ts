import { describe, it, expect, spyOn } from "bun:test";
import { buildCotLogRegex } from "../src/tak";

describe("buildCotLogRegex", () => {
  it("returns null when pattern is undefined", () => {
    expect(buildCotLogRegex(undefined)).toBeNull();
  });

  it("returns null when pattern is empty string", () => {
    expect(buildCotLogRegex("")).toBeNull();
  });

  it("returns a RegExp for a valid pattern", () => {
    const regex = buildCotLogRegex("a-f-G");
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test("type=a-f-G-U-C")).toBe(true);
    expect(regex!.test("type=b-t-f")).toBe(false);
  });

  it("supports full regex syntax", () => {
    const regex = buildCotLogRegex('uid="ANDROID-.*?"');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test('uid="ANDROID-deadbeef"')).toBe(true);
    expect(regex!.test('uid="iPhone-abc"')).toBe(false);
  });

  it("exits with code 1 for an invalid regex", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    expect(() => buildCotLogRegex("[invalid")).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
