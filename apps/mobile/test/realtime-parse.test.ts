import { describe, expect, it } from "vitest";

import { frameToData, reactionFor, splitFrames } from "../src/sync/realtime-parse.js";

/**
 * The mobile realtime stream's pure parsing/classification (Phase R3). These are
 * the bits that turn a raw SSE byte stream into "delta-pull now" decisions, so
 * they're isolated from `expo/fetch` and tested directly: frame boundaries across
 * chunk splits, heartbeat/comment filtering, and topic → reaction routing.
 */

describe("splitFrames", () => {
  it("splits complete frames and keeps the partial remainder", () => {
    const { frames, rest } = splitFrames("data: a\n\ndata: b\n\ndata: c");
    expect(frames).toEqual(["data: a", "data: b"]);
    expect(rest).toBe("data: c"); // incomplete — carried to the next chunk
  });

  it("returns no frames until a blank-line terminator arrives", () => {
    expect(splitFrames("data: half").frames).toEqual([]);
    expect(splitFrames("data: half").rest).toBe("data: half");
  });

  it("tolerates CRLF line endings", () => {
    const { frames } = splitFrames("data: a\r\n\r\n");
    expect(frames).toEqual(["data: a"]);
  });

  it("reassembles a frame that arrives across two chunks", () => {
    const first = splitFrames("data: hel");
    expect(first.frames).toEqual([]);
    const second = splitFrames(first.rest + "lo\n\n");
    expect(second.frames).toEqual(["data: hello"]);
  });
});

describe("frameToData", () => {
  it("extracts the data payload", () => {
    expect(frameToData("data: {\"topic\":\"ncr\"}")).toBe('{"topic":"ncr"}');
  });
  it("ignores heartbeat/comment frames", () => {
    expect(frameToData(": ping")).toBeNull();
    expect(frameToData("retry: 3000")).toBeNull();
  });
  it("joins multiple data lines", () => {
    expect(frameToData("data: a\ndata: b")).toBe("a\nb");
  });
  it("strips exactly one leading space after the colon", () => {
    expect(frameToData("data:  x")).toBe(" x"); // only the first space is the SSE delimiter
  });
});

describe("reactionFor", () => {
  it("delta-pulls for mirrored entities", () => {
    expect(reactionFor("ncr")).toBe("sync");
    expect(reactionFor("inspection")).toBe("sync");
  });
  it("refreshes the bell for notifications", () => {
    expect(reactionFor("notifications")).toBe("notifications");
  });
  it("ignores topics the device does not mirror or show", () => {
    for (const t of ["capa", "eightd", "supplier", "ppap", "scar", "document", "fmea", "audit"]) {
      expect(reactionFor(t), t).toBe("ignore");
    }
  });
});
