import { after } from "node:test";
import versedb from "../src/index";
import { promises as fs } from "fs";

async function Setup(adapter: string): Promise<any> {
  const adapterOptions = {
    adapter: `${adapter}`,
    dataPath: `./tests/${adapter}/data`,
    devLogs: { enable: true, path: `./tests/${adapter}/logs` },
    encryption: { enable: false, secret: "" },
    backup: { enable: false, path: "", retention: 0 },
  };

  const db = new versedb.connect(adapterOptions);
  return db;
}

async function Teardown(db: string) {
  await fs.rm(`./tests/${db}`, { recursive: true, force: true });
}

describe("JSON adapter testing all the methods", () => {
  let db: any;
  console.log = function () {};

  beforeEach(async () => {
    await Setup("json");
    db = await Setup("json");
  });

  afterEach(async () => {
    await Teardown("json");
  });

  // Test 1: Adding new data
  test("setup the database", async () => {
    await Setup("json");
    db = await Setup("json");
  });

  // Test 2: Adding new data
  test("add new data to a collection", async () => {
    const newData = {
      _id: "1234",
      name: "Mark Maher",
    };

    await db.add("add/add", newData);

    after(async () => {
      await Teardown("json");
    });

    const data = await db.load("add/add");
    expect(data).toEqual([newData]);
  });

  // Test 3: Updating data
  test("update data in a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    await db.add("update/update", addData);

    const updateData = {
      $set: {
        name: "Kmoshax",
      },
    };

    await db.update(
      "update/update",
      { _id: "5678" },
      {
        $set: {
          name: "Kmoshax",
        },
      }
    );

    const latestData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Kmoshax",
      },
    ];

    const data = await db.load("update/update");
    expect(data).toEqual(latestData);
  });

  // Test 4: Removing data
  test("remove data from a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    await db.add("update/update", addData);
    await db.remove("update/update", { _id: "5678" });

    const latestData = {
      _id: "1234",
      name: "Mark Maher",
    };

    const data = await db.load("update/update");
    expect(data).toEqual([latestData]);
  });

  // Test 5: Finding data
  test("find data in a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Anas",
      },
    ];
    await db.add("find/find", addData);
    await db.find("find/find", { _id: "5678" });

    const foundData = [
      {
        _id: "5678",
        name: "Anas",
      },
    ];

    const data = await db.find("find/find", { _id: "5678" });
    expect([data.results]).toEqual(foundData);
  });

  // Test 6: drop collection
  test("drop a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
    ];
    await db.add("drop/drop", addData);
    await db.drop("drop/drop");

    const data = await db.load("drop/drop");
    expect(data).toEqual([]);
  });

  // Test 6: drop collection
  test("search in multiple collections", async () => {
    const addData1 = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "1234",
        name: "Marco",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    const addData2 = [
      {
        _id: "1234",
        name: "Anas",
      },
      {
        _id: "5678",
        name: "Anas",
      },
    ];
    const addData3 = [
      {
        _id: "1234",
        name: "kmoshax",
      },
      {
        _id: "5678",
        name: "kmoshax",
      },
    ];
    await db.add("search/search1", addData1);
    await db.add("search/search2", addData2);
    await db.add("search/search3", addData3);

    const collectionFilters = [
      {
        dataName: "search/search1",
        displayment: null,
        filter: {},
      },
      {
        dataName: "search/search2",
        displayment: null,
        filter: {},
      },
      {
        dataName: "search/search3",
        displayment: null,
        filter: {},
      },
    ];

    const searchResults = await db.search(collectionFilters);

    const resultData = {
      "search/search1": [
        { _id: "1234", name: "Mark Maher" },
        { _id: "1234", name: "Marco" },
        { _id: "5678", name: "Mark Maher" },
      ],
      "search/search2": [
        { _id: "1234", name: "Anas" },
        { _id: "5678", name: "Anas" },
      ],
      "search/search3": [
        { _id: "1234", name: "kmoshax" },
        { _id: "5678", name: "kmoshax" },
      ],
    };
    expect(resultData).toEqual(searchResults);
  });

  // Test 7: display multiple data collection
  test("display multiple data collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
    ];
    const addData2 = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "kmosha",
      },
      {
        _id: "9123",
        name: "kmosha",
      },
      {
        _id: "4567",
        name: "kmosha",
      },
      {
        _id: "8912",
        name: "kmosha",
      },
      {
        _id: "3456",
        name: "kmosha",
      },
    ];
    await db.add("displayData/displayData", addData);
    await db.add("displayData2/displayData2", addData2);
    await db.allData(["displayData/displayData", "displayData2/displayData2"]);

    const latest = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "kmosha",
      },
      {
        _id: "9123",
        name: "kmosha",
      },
      {
        _id: "4567",
        name: "kmosha",
      },
      {
        _id: "8912",
        name: "kmosha",
      },
      {
        _id: "3456",
        name: "kmosha",
      },
    ];

    expect(latest).toEqual(latest);
  });
});

describe("YAML adapter testing all the methods", () => {
  let db: any;
  console.log = function () {};

  beforeEach(async () => {
    await Setup("yaml");
    db = await Setup("yaml");
  });

  afterEach(async () => {
    await Teardown("yaml");
  });

  // Test 1: Adding new data
  test("setup the database", async () => {
    await Setup("yaml");
    db = await Setup("yaml");
  });

  // Test 2: Adding new data
  test("add new data to a collection", async () => {
    const newData = {
      _id: "1234",
      name: "Mark Maher",
    };

    await db.add("add/add", newData);

    const data = await db.load("add/add");
    expect(data).toEqual([newData]);
  });

  // Test 3: Updating data
  test("update data in a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    await db.add("update/update", addData);

    const updateData = {
      name: "Kmoshax",
    };

    await db.update("update/update", { _id: "5678" });

    const latestData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Kmoshax",
      },
    ];

    const data = await db.load("update/update");
    expect(data).toEqual(latestData);
  });

  // Test 4: Removing data
  test("remove data from a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    await db.add("update/update", addData);
    await db.remove("update/update", { _id: "5678" });

    const latestData = {
      _id: "1234",
      name: "Mark Maher",
    };

    const data = await db.load("update/update");
    expect(data).toEqual([latestData]);
  });

  // Test 5: Finding data
  test("find data in a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Anas",
      },
    ];
    await db.add("find/find", addData);
    await db.find("find/find", { _id: "5678" });

    const foundData = [
      {
        _id: "5678",
        name: "Anas",
      },
    ];

    const data = await db.find("find/find", { _id: "5678" });
    expect([data.results]).toEqual(foundData);
  });

  // Test 6: drop collection
  test("drop a collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
    ];
    await db.add("drop/drop", addData);
    await db.drop("drop/drop");

    const data = await db.load("drop/drop");
    expect(data).toEqual([]);
  });

  // Test 6: drop collection
  test("search in multiple collections", async () => {
    const addData1 = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "1234",
        name: "Marco",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
    ];
    const addData2 = [
      {
        _id: "1234",
        name: "Anas",
      },
      {
        _id: "5678",
        name: "Anas",
      },
    ];
    const addData3 = [
      {
        _id: "1234",
        name: "kmoshax",
      },
      {
        _id: "5678",
        name: "kmoshax",
      },
    ];
    await db.add("search/search1", addData1);
    await db.add("search/search2", addData2);
    await db.add("search/search3", addData3);

    const collectionFilters = [
      {
        dataName: "search/search1",
        displayment: null,
        filter: {},
      },
      {
        dataName: "search/search2",
        displayment: null,
        filter: {},
      },
      {
        dataName: "search/search3",
        displayment: null,
        filter: {},
      },
    ];

    const searchResults = await db.search(collectionFilters);

    const resultData = {
      "search/search1": [
        { _id: "1234", name: "Mark Maher" },
        { _id: "1234", name: "Marco" },
        { _id: "5678", name: "Mark Maher" },
      ],
      "search/search2": [
        { _id: "1234", name: "Anas" },
        { _id: "5678", name: "Anas" },
      ],
      "search/search3": [
        { _id: "1234", name: "kmoshax" },
        { _id: "5678", name: "kmoshax" },
      ],
    };
    expect(resultData).toEqual(searchResults);
  });

  // Test 7: display multiple data collection
  test("display multiple data collection", async () => {
    const addData = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
    ];
    const addData2 = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "kmosha",
      },
      {
        _id: "9123",
        name: "kmosha",
      },
      {
        _id: "4567",
        name: "kmosha",
      },
      {
        _id: "8912",
        name: "kmosha",
      },
      {
        _id: "3456",
        name: "kmosha",
      },
    ];
    await db.add("displayData/displayData", addData);
    await db.add("displayData2/displayData2", addData2);
    await db.allData(["displayData/displayData", "displayData2/displayData2"]);

    const latest = [
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "Mark Maher",
      },
      {
        _id: "9123",
        name: "Mark Maher",
      },
      {
        _id: "4567",
        name: "Mark Maher",
      },
      {
        _id: "8912",
        name: "Mark Maher",
      },
      {
        _id: "3456",
        name: "Mark Maher",
      },
      {
        _id: "1234",
        name: "Mark Maher",
      },
      {
        _id: "5678",
        name: "kmosha",
      },
      {
        _id: "9123",
        name: "kmosha",
      },
      {
        _id: "4567",
        name: "kmosha",
      },
      {
        _id: "8912",
        name: "kmosha",
      },
      {
        _id: "3456",
        name: "kmosha",
      },
    ];

    expect(latest).toEqual(latest);
  });
});
