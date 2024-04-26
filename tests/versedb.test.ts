import versedb from "../src/index";
import fs from "fs";

async function Setup(adapter: string): Promise<any> {
  const adapterOptions = {
    adapter: `${adapter}`,
    dataPath: `./tests/${adapter}/data`,
    devLogs: { enable: true, path: `./tests/${adapter}/logs` },
    encryption: {
      enable: true,
      secret: "versedb",
    },
  };

  const db = new versedb.connect(adapterOptions);
  return db;
}

async function Teardown(db: string) {
  await fs.promises.rm(`./tests/${db}`, { recursive: true, force: true });
}

describe("JSON", () => {
  let db: any;
  console.log = function () {};
  console.info = function () {};

  beforeEach(async () => {
    await Setup("json");
    db = await Setup("json");
  });

  afterEach(async () => {
    await Teardown("json");
  });

  test("add method should add new data to the specified file", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name: "Jane" },
    ];
    const newData = [{ name: "Mike" }];
    const dataname = "add";

    // Act
    const result = await db.add(dataname, newData);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data added successfully.",
      results: expect.anything(),
    });
  });

  test("load method should return the data from the specified file", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name: "Jane" },
    ];
    const dataname = "load";

    // Act
    await db.add(dataname, data);
    const result = await db.load(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data loaded successfully.",
      results: [
        { _id: expect.anything(), name: "John" },
        { _id: expect.anything(), name: "Jane" },
      ],
    });
  });

  test("remove method should remove data from the specified file", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name: "Jane" },
    ];
    const query = { name: "John" };
    const dataname = "remove";

    // Act
    await db.add(dataname, data);
    const result = await db.remove(dataname, query);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) removed successfully.",
      results: null,
    });
  });

  test("update method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name: "Jane" },
    ];
    const updateQuery = { $set: { name: "Mike" } };
    const dataname = "update";

    // Act
    await db.add(dataname, data);
    const result = await db.update(dataname, { name: "John" }, updateQuery);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) updated successfully.",
      results: {
        _id: expect.anything(),
        name: "Mike",
      },
    });
  });

  test("updateMany method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name: "Jane" },
    ];
    const filter = { name: ["John", "Jane"] };
    const updateQuery = { name: "Mike" };
    const dataname = "updateMany";

    // Act
    await db.add(dataname, data);
    const result = await db.updateMany(dataname, filter, updateQuery);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) updated successfully.",
      results: [
        {
          _id: expect.anything(),
          name: "Mike",
        },
      ],
    });
  });

  test("find method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { name: "John" },
      { name:"Jane" },
    ];
    const query = { name: "John" };
    const dataname = "find";

    // Act
    await db.add(dataname, data);
    const result = await db.find(dataname, query);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Found data matching your query.",
      results: { _id: expect.anything(), name: "John" },
    });
  });

  test("loadAll method should return all the data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"Mark" },
      { name:"Anas" },
      { name:"Anas" },
      { name:"Mark" },
    ];
    const dataname = "loadAll";
    const displayOptions = {
      filter: {
        name: "Mark",
      },
      sortField: "name",
      sortOrder: "asc",
      page: 1,
      pageSize: 10,
      displayment: 10,
    };

    // Act
    await db.add(dataname, data);
    const result = await db.loadAll(dataname, displayOptions);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data found with the given options.",
      results: {
        allData: [
          { _id: expect.anything(), name: "Mark" },
          { _id: expect.anything(), name: "Mark" },
        ],
      },
    });
  });

  test("drop method should delete all the data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const dataname = "drop";

    // Act
    await db.add(dataname, data);
    const result = await db.drop(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "All data dropped successfully.",
      results: "",
    });
  });

  test("search method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { name:"mark", author: "maher" },
      { name:"anas", author: "kmosha" },
    ];
    const data2 = [
      { name:"anas", author: "kmosha" },
      { name:"mark", author: "maher" },
    ];
    const collectionFilters = [
      {
        dataname: "users",
        displayment: 10,
        filter: { name: "mark" },
      },
      {
        dataname: "posts",
        displayment: 5,
        filter: { author: "maher" },
      },
    ];
    const dataname = "users";
    const dataname2 = "posts";

    // Act
    await db.add(dataname, data);
    await db.add(dataname2, data2);
    const result = await db.search(collectionFilters);

    // Assert
    expect(result).toEqual({
      posts: [{ _id: expect.anything(), author: "maher", name: "mark" }],
      users: [{ _id: expect.anything(), author: "maher", name: "mark" }],
    });
  });
});

describe("YAML", () => {
  let db: any;
  console.log = function () {};
  console.info = function () {};

  beforeEach(async () => {
    await Setup("yaml");
    db = await Setup("yaml");
  });

  afterEach(async () => {
    await Teardown("yaml");
  });

  test("add method should add new data to the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const newData = [{ name: "Mike" }];
    const dataname = "add";

    // Act
    const result = await db.add(dataname, newData);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data added successfully.",
      results: expect.anything(),
    });
  });

  test("load method should return the data from the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const dataname = "load";

    // Act
    await db.add(dataname, data);
    const result = await db.load(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data loaded successfully.",
      results: [
        { _id: expect.anything(), name: "John" },
        { _id: expect.anything(), name: "Jane" },
      ],
    });
  });

  test("remove method should remove data from the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const query = { name: "John" };
    const dataname = "remove";

    // Act
    await db.add(dataname, data);
    const result = await db.remove(dataname, query);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) removed successfully.",
      results: null,
    });
  });

  test("update method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const updateQuery = { $set: { name: "Mike" } };
    const dataname = "update";

    // Act
    await db.add(dataname, data);
    const result = await db.update(dataname, { name: "John" }, updateQuery);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) updated successfully.",
      results: {
        _id: expect.anything(),
        name: "Mike",
      },
    });
  });

  test("updateMany method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const filter = { name: ["John", "Jane"] };
    const updateQuery = { name: "Mike" };
    const dataname = "updateMany";

    // Act
    await db.add(dataname, data);
    const result = await db.updateMany(dataname, filter, updateQuery);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "1 document(s) updated successfully.",
      results: [
        {
          _id: expect.anything(),
          name: "Mike",
        },
      ],
    });
  });

  test("find method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const query = { name: "John" };
    const dataname = "find";

    // Act
    await db.add(dataname, data);
    const result = await db.find(dataname, query);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Found data matching your query.",
      results: { _id: expect.anything(), name: "John" },
    });
  });

  test("loadAll method should return all the data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"Mark" },
      { name:"Anas" },
      { name:"Anas" },
      { name:"Mark" },
    ];
    const dataname = "loadAll";
    const displayOptions = {
      filter: {
        name: "Mark",
      },
      sortField: "name",
      sortOrder: "asc",
      page: 1,
      pageSize: 10,
      displayment: 10,
    };

    // Act
    await db.add(dataname, data);
    const result = await db.loadAll(dataname, displayOptions);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data found with the given options.",
      results: {
        allData: [
          { _id: expect.anything(), name: "Mark" },
          { _id: expect.anything(), name: "Mark" },
        ],
      },
    });
  });

  test("drop method should delete all the data in the specified file", async () => {
    // Arrange
    const data = [
      { name:"John" },
      { name:"Jane" },
    ];
    const dataname = "drop";

    // Act
    await db.add(dataname, data);
    const result = await db.drop(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "All data dropped successfully.",
      results: "",
    });
  });

  test("search method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { name:"mark", author: "maher" },
      { name:"anas", author: "kmosha" },
    ];
    const data2 = [
      { name:"anas", author: "kmosha" },
      { name:"mark", author: "maher" },
    ];
    const collectionFilters = [
      {
        dataname: "users",
        displayment: 10,
        filter: { name: "mark" },
      },
      {
        dataname: "posts",
        displayment: 5,
        filter: { author: "maher" },
      },
    ];
    const dataname = "users";
    const dataname2 = "posts";

    // Act
    await db.add(dataname, data);
    await db.add(dataname2, data2);
    const result = await db.search(collectionFilters);

    // Assert
    expect(result).toEqual({
      posts: [{ _id: expect.anything(), author: "maher", name: "mark" }],
      users: [{ _id: expect.anything(), author: "maher", name: "mark" }],
    });
  });
});
