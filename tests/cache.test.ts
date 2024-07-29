import fs from "fs";
import path from "path";
import versedb from "../src/index";
import { CacheAdapter, CacheData } from "../src/types/adapter";

describe("CacheAdapter", () => {
  const testDir = path.join(__dirname, "__test_cache__");
  const adapterOptions = {
    maxSize: 2,
    ttl: 10000,
    devLogs: { enable: false, path: "" },
  };
  let cacheAdapter: CacheAdapter;

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    cacheAdapter = new versedb.cache(adapterOptions);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
  });

  test("should add a cache entry", async () => {
    const key = "test-key";
    const data: CacheData = { some: "data" };

    const result = await cacheAdapter.add(key, data);
    expect(result.acknowledged).toBe(true);
    expect(result.message).toBe(`Cache entry ${key} added`);

    const loadedEntry = await cacheAdapter.load(key);
    expect(loadedEntry).not.toBeNull();
    expect(loadedEntry?.results).toEqual(data);
  });

  test("should load a cache entry", async () => {
    const key = "test-key-2";
    const data: CacheData = { some: "data" };

    await cacheAdapter.add(key, data);

    const result = await cacheAdapter.load(key);
    expect(result).not.toBeNull();
    expect(result?.results).toEqual(data);
  });

  test("should handle cache expiration", async () => {
    const key = "test-key-expired";
    const data: CacheData = { some: "data" };

    cacheAdapter = new versedb.cache({ ...adapterOptions, ttl: 1 }); // 1 ms TTL for quick expiration
    await cacheAdapter.add(key, data);

    // Wait for the cache to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await cacheAdapter.load(key);
    expect(result).toBeNull();
  });

  test("should destroy a cache entry", async () => {
    const key = "test-key-3";
    const data: CacheData = { some: "data" };

    await cacheAdapter.add(key, data);
    const destroyResult = await cacheAdapter.destroy(key);
    expect(destroyResult.acknowledged).toBe(true);
    expect(destroyResult.message).toBe(`Cache entry ${key} destroyed`);

    const loadResult = await cacheAdapter.load(key);
    expect(loadResult).toBeNull();
  });

  test("should clear all cache entries", async () => {
    const key1 = "test-key-4";
    const key2 = "test-key-5";
    const data: CacheData = { some: "data" };

    await cacheAdapter.add(key1, data);
    await cacheAdapter.add(key2, data);

    const clearResult = await cacheAdapter.clear();
    expect(clearResult.acknowledged).toBe(true);
    expect(clearResult.message).toBe("All cache entries cleared");

    const loadResult1 = await cacheAdapter.load(key1);
    const loadResult2 = await cacheAdapter.load(key2);
    expect(loadResult1).toBeNull();
    expect(loadResult2).toBeNull();
  });

  test("should invalidate cache entries based on predicate", async () => {
    const key1 = "test-key-6";
    const key2 = "test-key-7";
    const data: CacheData = { some: "data" };

    await cacheAdapter.add(key1, data);
    await cacheAdapter.add(key2, data);

    const invalidateResult = await cacheAdapter.invalidate(
      (key, data) => data.some === "data"
    );
    expect(invalidateResult.acknowledged).toBe(true);
    expect(invalidateResult.message).toBe("Cache invalidation complete");

    const loadResult1 = await cacheAdapter.load(key1);
    const loadResult2 = await cacheAdapter.load(key2);
    expect(loadResult1).toBeNull();
    expect(loadResult2).toBeNull();
  });

  test("should handle devLogs error", () => {
    jest.spyOn(console, "error").mockImplementation(() => {}); // Mock console.error

    expect(() => {
      new versedb.cache({
        devLogs: { enable: true, path: "" },
        maxSize: 2,
        ttl: 10000,
      });
    }).toThrowError("You need to provide a logs path if devLogs is enabled.");
  });
});
