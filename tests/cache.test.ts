import versedb from "../src/index";
const cache = new versedb.cache({
  devLogs: { enable: false, path: "" },
  dataPath: "./tests/cache/data",
  maxSize: 1000,
  ttl: 0,
});

cache.stats()