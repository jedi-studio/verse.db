import versedb from "../src/index";
const session = new versedb.session({
  dataPath: `./tests/session/data`,
  devLogs: { enable: true, path: `./tests/session/logs` },
  secure: {
    enable: false,
    secret: "",
  },
});

// Get a session
const sessionData = await session.load("sessionId1");
console.log(sessionData);
// Set a session
await session.add("sessionId1", { user: "John Doe", role: "admin" });

// Destroy a session
await session.destroy("sessionId1");
