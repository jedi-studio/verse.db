![image](https://github.com/jedi-studio/verse.db/assets/100785809/269a554b-1157-4351-be16-f9c23c5ee1a2) 

verse.db isn't just a database, it's your universal data bridge. Designed for unmatched flexibility, security, and performance, verse.db empowers you to manage your data with ease.

[![Tests of Verse.db](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml/badge.svg)](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml)
![Tests deployments](https://img.shields.io/github/deployments/jedi-studio/verse.db/Tests)
[![NPM Version](https://img.shields.io/npm/v/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![NPM Downloads](https://img.shields.io/npm/dt/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![Github Repo Size](https://img.shields.io/github/repo-size/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db)
[![LICENSE](https://img.shields.io/npm/l/verse.db.svg)](https://github.com/jedi-studio/verse.db/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db/commits/master)

## Introduction

The verse.db package is a powerful utility designed to simplify the management of data files within a designated folder. It offers methods for adding, editing, deleting, and retrieving data from JSON, YAML, SQL & more files. This wiki provides detailed examples and usage scenarios to help you effectively implement the verse.db package in your projects.

## Installation

To begin using the verse.db package, you'll need to install it via npm. Open your terminal and run the following command:

```bash
npm install verse.db
yarn add verse.db
```

## Usage

### Import and Initialization

to get started setup the database connection uding .connect method

```javascript
const versedb = require("verse.db");
// or
import versedb from "verse.db";

const adapterOptions = {
  adapter: "json" | "yaml" | "sql", // the type of the adapter json, yaml or sql
  dataPath: "./Data", // the path of the data folder
  devLogs: { enable: true, path: "./Logs" }, // the path to the logs folder
  encryption: { secret: "" }, // Add your secrete key for securing your data "Note: if you forgot your Key. It will be hard to get your data"
  backup: { enable: false, path: "", retention: 0 }, // Under Development: Backing up
};

const db = new versedb.connect(adapterOptions); // use the connect method to connect a database
```

Note\*: that you can make a multiple databases in the same time with/without the same extention

## JSON Database

<details>

- **To Load Data**

<details>

```javascript
const dataname = "users"; // the name of the datafile without the extention
const result = await db.load(dataname);

console.log(result);
```

</details>


- **To Add Data**

<details>


```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const dataname = "users";

// Act
const result = await db.add(dataname, data);
```

result:

```json
{
  "acknowledged": true,
  "message": "Data added successfully.",
  "results": [
    { "_id": "1234", "name": "John" },
    { "_id": "5678", "name": "Jane" }
  ]
}
```

</details>

- **To Find Data**

<details>

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const query = { name: "John" };
const dataname = "users";

// Act
const result = await db.find(dataname, query);

// Assert
expect(result).toEqual({
  acknowledged: true,
  message: "Found data matching your query.",
  results: { _id: "1234", name: "John" },
});
```

</details>

- **To remove Data**

<details>

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const query = { _id: "1234" };
const dataname = "users";

// Act
const result = await db.remove(dataname, query, { docCount: 2 }); // (OPTIONAL) docCount => number of documents matchs the query

// Assert
expect(result).toEqual({
  acknowledged: true,
  message: "1 document(s) removed successfully.",
  results: null,
});
```

</details>

- **To Update Data**

<details>

Update the data you want with the query you want using .update method:

```javascript
// Arrange
const dataname = "users";
const data = [
    { _id: "1234", name: "John", age: 30, hobbies: ["Reading"], friends: ["Jane"], email: "john@example.com" },
    { _id: "5678", name: "Jane", age: 25, hobbies: ["Gardening"], friends: ["John"], email: "jane@example.com" },
];
const updateQuery = {
    $set: { name: "Mike" }, // Set the name field to "Mike"
    $inc: { age: 1 }, // Increment the age field by 1
    $addToSet: { hobbies: "Swimming" }, // Add "Swimming" to the hobbies array if not already present
    $push: { friends: "Alice" }, // Push "Alice" into the friends array
    $unset: { email: "" }, // Remove the email field
    $currentDate: { lastModified: true } // Set the lastModified field to the current date
};
const upsert =  true;

// Act
const result = await db.update(dataname, { _id: "1234" }, updateQuery, upsert);

// Assert
expect(result).toEqual({
    acknowledged: true,
    message: "1 document(s) updated successfully.",
    results: {
        _id: "1234",
        name: "Mike",
        age: 31,
        hobbies: ["Reading", "Swimming"],
        friends: ["Jane", "Alice"],
        lastModified: expect.any(Date)
    },
});
```

</details>

- **To Update Many Data**

<details>

```javascript
// Arrange
const dataname = "users";
const query = { age: { $gte: 25 } }; // Find documents with age greater than or equal to 25
const updateQuery = {
    $set: { name: "Updated Name" }, // Set the name field to "Updated Name"
    $inc: { age: 1 }, // Increment the age field by 1
    $addToSet: { hobbies: "Swimming" }, // Add "Swimming" to the hobbies array if not already present
    $push: { friends: "Alice" }, // Push "Alice" into the friends array
    $unset: { email: "" }, // Remove the email field
    $currentDate: { lastModified: true } // Set the lastModified field to the current date
};

// Act
const result = await db.updateMany(dataname, query, updateQuery);

// Results:
      return {
        acknowledged: true,
        message: `${updatedCount} document(s) updated successfully.`,
        results: updatedDocument,
      };
```

</details>

- **To Drop Data**

<details>

```javascript
// Arrange
const dataname = "users";
const dropResult = await db.drop(dataname);

// Results:
     return {
        acknowledged: true,
        message: `All data dropped successfully.`,
        results: '',
      };
```

</details>

- **To Search Multiples Of Data**

<details>

```javascript

// Arrange
const collectionFilters = [
  {
    dataname: "users",
    displayment: 5,
    filter: { age: 30, gender: "male" }, // Search for male users with age 30
  },
  {
    dataname: "products",
    displayment: null, // No limit on displayment
    filter: { category: "electronics", price: { $lt: 500 } }, // Search for electronics products with price less than 500
  },
];

// Perform the search
const searchResult = await db.search("/path/to/data folder", collectionFilters);

// Assert
expect(searchResult.acknowledged).toBe(true);
expect(searchResult.message).toBe("Successfully searched in data for the given query.");
expect(searchResult.results).toEqual({
  users: [
    // Assert the first 5 male users with age 30
    expect.objectContaining({ age: 30, gender: "male" }),
    expect.objectContaining({ age: 30, gender: "male" }),
    expect.objectContaining({ age: 30, gender: "male" }),
    expect.objectContaining({ age: 30, gender: "male" }),
    expect.objectContaining({ age: 30, gender: "male" }),
  ],
  products: [
    // Assert the products that match the filter criteria
    expect.objectContaining({ category: "electronics", price: expect.toBeLessThan(500) }),
    // Add more assertions for other products if needed
  ],
});
```

</details>
</details>


## Conclusion

The verse.db package simplifies the management of JSON data files within a specified folder. With the provided examples and usage instructions, you'll be able to efficiently integrate the verse.db package into your projects to streamline data operations.
Package Sidebar
Install
npm i verse.db

Repository
github.com/marco5dev/verse.db

Homepage
versedb.jedi-studio.com

Weekly Downloads
158

Version
1.1.4

License
MIT

Unpacked Size
448 kB

Total Files
70

Issues
0

Pull Requests
0

Last publish
2 hours ago

Collaborators
zenith-79
marco5dev
Try on RunKit
Report malware
