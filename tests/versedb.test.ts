import versedb from "../src/index";
import fs from "fs";

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
  await fs.promises.rm(`./tests/${db}`, { recursive: true, force: true });
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

  test("add method should add new data to the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const newData = [{ name: "Mike" }];
    const dataname = "add";

    // Act
    const result = await db.add(dataname, newData);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data added successfully.",
    });
  });

  test("load method should return the data from the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const dataname = "load";

    // Act
    await db.add(dataname, data);
    const result = await db.load(dataname);

    // Assert
    expect(result).toEqual(data);
  });

  test("remove method should remove data from the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const query = { _id: "1234" };
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
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
        _id: "1234",
        name: "Mike",
      },
    });
  });

  test("updateMany method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
          _id: "1234",
          name: "Mike",
        },
      ],
    });
  });

  test("find method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
      results: { _id: "1234", name: "John" },
    });
  });

  test("loadAll method should return all the data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "Mark" },
      { _id: "5678", name: "Anas" },
      { _id: "1234", name: "Anas" },
      { _id: "5678", name: "Mark" },
    ];
    const dataname = "loadAll";
    const displayOptions = {
      filters: {
        name: "Mark",
      },
      sortBy: "name",
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
      results: [
        { _id: "1234", name: "Mark" },
        { _id: "5678", name: "Mark" },
      ],
    });
  });

  test("drop method should delete all the data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const dataname = "drop";

    // Act
    await db.add(dataname, data);
    const result = await db.drop(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "All data dropped successfully.",
      results: null,
    });
  });

  test("search method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "mark", author: "maher" },
      { _id: "5678", name: "anas", author: "kmosha" },
    ];
    const data2 = [
      { _id: "1234", name: "anas", author: "kmosha" },
      { _id: "5678", name: "mark", author: "maher" },
    ];
    const query = [
      {
        dataname: "users",
        filter: { name: "mark" },
        displayment: 10,
      },
      {
        dataname: "posts",
        filter: { author: "maher" },
        displayment: 5,
      },
    ];
    const dataname = "users";
    const dataname2 = "posts";

    // Act
    await db.add(dataname, data);
    await db.add(dataname2, data2);
    const result = await db.search(query);

    // Assert
    expect(result).toEqual({
      posts: [{ _id: "5678", author: "maher", name: "mark" }],
      users: [{ _id: "1234", author: "maher", name: "mark" }],
    });
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

  test("add method should add new data to the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const newData = [{ name: "Mike" }];
    const dataname = "add";

    // Act
    const result = await db.add(dataname, newData);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "Data added successfully.",
    });
  });

  test("load method should return the data from the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const dataname = "load";

    // Act
    await db.add(dataname, data);
    const result = await db.load(dataname);

    // Assert
    expect(result).toEqual(data);
  });

  test("remove method should remove data from the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const query = { _id: "1234" };
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
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
        _id: "1234",
        name: "Mike",
      },
    });
  });

  test("updateMany method should update data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
          _id: "1234",
          name: "Mike",
        },
      ],
    });
  });

  test("find method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
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
      results: { _id: "1234", name: "John" },
    });
  });

  test("loadAll method should return all the data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "Mark" },
      { _id: "5678", name: "Anas" },
      { _id: "1234", name: "Anas" },
      { _id: "5678", name: "Mark" },
    ];
    const dataname = "loadAll";
    const displayOptions = {
      filters: {
        name: "Mark",
      },
      sortBy: "name",
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
      results: [
        { _id: "1234", name: "Mark" },
        { _id: "5678", name: "Mark" },
      ],
    });
  });

  test("drop method should delete all the data in the specified file", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "John" },
      { _id: "5678", name: "Jane" },
    ];
    const dataname = "drop";

    // Act
    await db.add(dataname, data);
    const result = await db.drop(dataname);

    // Assert
    expect(result).toEqual({
      acknowledged: true,
      message: "All data dropped successfully.",
      results: null,
    });
  });

  test("search method should return the data that matches the specified query", async () => {
    // Arrange
    const data = [
      { _id: "1234", name: "mark", author: "maher" },
      { _id: "5678", name: "anas", author: "kmosha" },
    ];
    const data2 = [
      { _id: "1234", name: "anas", author: "kmosha" },
      { _id: "5678", name: "mark", author: "maher" },
    ];
    const query = [
      {
        dataname: "users",
        filter: { name: "mark" },
        displayment: 10,
      },
      {
        dataname: "posts",
        filter: { author: "maher" },
        displayment: 5,
      },
    ];
    const dataname = "users";
    const dataname2 = "posts";

    // Act
    await db.add(dataname, data);
    await db.add(dataname2, data2);
    const result = await db.search(query);

    // Assert
    expect(result).toEqual({
      posts: [{ _id: "5678", author: "maher", name: "mark" }],
      users: [{ _id: "1234", author: "maher", name: "mark" }],
    });
  });
});
