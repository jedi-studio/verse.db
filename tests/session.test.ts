import fs from "fs";
import versedb from "../src/index";
import { SessionAdapter, SessionData } from "../src/types/adapter";
const testDir = "./tests/session/data";

describe("SessionAdapter", () => {
  const adapterOptions = {
    dataPath: testDir,
    maxSize: 10,
    ttl: 10000, // 10 seconds TTL
    secure: { enable: false, secret: "" },
    devLogs: { enable: false, path: "" },
  };
  let adapter: SessionAdapter;

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      fs.promises.rmdir(testDir, { recursive: true });
    }
    fs.promises.mkdir(testDir, { recursive: true });
    adapter = new versedb.session(adapterOptions);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.promises.rm(testDir, { recursive: true });
    }
  });

  test("add a session", async () => {
    const sessionId = "test-session";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    const result = await adapter.add(sessionId, sessionData);
    expect(result.acknowledged).toBe(true);
    expect(result.message).toBe(`Session ${sessionId} saved`);

    const loadedSession = await adapter.load(sessionId);
    expect(loadedSession).not.toBeNull();
    expect(loadedSession?.session).toEqual(sessionData);
  });

  test("load a session", async () => {
    const sessionId = "test-session-2";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    await adapter.add(sessionId, sessionData);

    const result = await adapter.load(sessionId);
    expect(result).not.toBeNull();
    expect(result?.session).toEqual(sessionData);
  });

  test("destroy a session", async () => {
    const sessionId = "test-session-3";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    await adapter.add(sessionId, sessionData);
    const destroyResult = await adapter.destroy(sessionId);
    expect(destroyResult.acknowledged).toBe(true);
    expect(destroyResult.message).toBe(`Session ${sessionId} destroyed`);

    const loadResult = await adapter.load(sessionId);
    expect(loadResult).toBeNull();
  });

  test("clear all sessions", async () => {
    const sessionId1 = "test-session-4";
    const sessionId2 = "test-session-5";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    await adapter.add(sessionId1, sessionData);
    await adapter.add(sessionId2, sessionData);

    const clearResult = await adapter.clear();
    expect(clearResult.acknowledged).toBe(true);
    expect(clearResult.message).toBe("All sessions cleared");

    const loadResult1 = await adapter.load(sessionId1);
    const loadResult2 = await adapter.load(sessionId2);
    expect(loadResult1).toBeNull();
    expect(loadResult2).toBeNull();
  });

  test("invalidate sessions based on predicate", async () => {
    const sessionId1 = "test-session-6";
    const sessionId2 = "test-session-7";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    await adapter.add(sessionId1, sessionData);
    await adapter.add(sessionId2, sessionData);

    const invalidateResult = await adapter.invalidate(
      (key, data) => data.key === "value"
    );
    expect(invalidateResult.acknowledged).toBe(true);
    expect(invalidateResult.message).toBe("Session invalidation complete");

    const loadResult1 = await adapter.load(sessionId1);
    const loadResult2 = await adapter.load(sessionId2);
    expect(loadResult1).toBeNull();
    expect(loadResult2).toBeNull();
  });

  test("regenerate session ID", async () => {
    const oldSessionId = "test-session-8";
    const newSessionId = "test-session-9";
    const sessionData: SessionData = {
      key: "value",
      expiry: Date.now() + adapterOptions.ttl,
    };

    await adapter.add(oldSessionId, sessionData);

    const regenerateResult = await adapter.regenerateSessionId(
      oldSessionId,
      newSessionId
    );
    expect(regenerateResult.acknowledged).toBe(true);
    expect(regenerateResult.message).toBe(
      `Session ID regenerated from ${oldSessionId} to ${newSessionId}`
    );

    const loadResult = await adapter.load(newSessionId);
    expect(loadResult).not.toBeNull();
    expect(loadResult?.session).toEqual(sessionData);

    const oldSessionLoadResult = await adapter.load(oldSessionId);
    expect(oldSessionLoadResult).toBeNull();
  });
});
