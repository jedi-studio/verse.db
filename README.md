# jsonVerse

jsonVerse is a lightweight JSON-based database package for Node.js. It provides a simple interface to store, retrieve, and manage data using JSON files.

[![Periodic testing of the JsonVerse](https://github.com/Marco5dev/jsonverse/actions/workflows/code-test.yml/badge.svg)](https://github.com/Marco5dev/jsonverse/actions/workflows/code-test.yml)
[![Build](https://github.com/Marco5dev/jsonverse/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/Marco5dev/jsonverse/actions/workflows/npm-publish.yml)
[![NPM Version](https://img.shields.io/npm/v/jsonverse.svg)](https://www.npmjs.com/package/jsonverse)
[![NPM Downloads](https://img.shields.io/npm/dt/jsonverse.svg)](https://www.npmjs.com/package/jsonverse)
[![Github Repo Size](https://img.shields.io/github/repo-size/Marco5dev/jsonverse.svg)](https://github.com/Marco5dev/jsonverse)
[![LICENSE](https://img.shields.io/npm/l/jsonverse.svg)](https://github.com/Marco5dev/jsonverse/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/Marco5dev/jsonverse.svg)](https://github.com/Marco5dev/jsonverse/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/Marco5dev/jsonverse.svg)](https://github.com/Marco5dev/jsonverse/commits/master)

## Introduction

The jsonVerse package is a powerful utility designed to simplify the management of JSON data files within a designated folder. It offers methods for adding, editing, deleting, and retrieving data from JSON files. This wiki provides detailed examples and usage scenarios to help you effectively implement the jsonVerse package in your projects.

## Installation

To begin using the jsonVerse package, you'll need to install it via npm. Open your terminal and run the following command:

```bash
npm install jsonverse
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
  encryption: { enable: false, secret: "" }, // Under Development: Encryption option
  backup: { enable: false, path: "", retention: 0 }, // Under Development: Backing up
};

const db = new versedb.connect(adapterOptions); // use the connect method to connect a database
```

Note\*: that you can make a multiple databases in the same time with/without the same extention

### Load a data file

You can load any data file using .load method

```javascript
const dataname = "data"; // the name of the datafile without the extention
const result = await db.load(dataname);

console.log(result);
```

### Add Data

To add data, use the .add method, for example:

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const dataname = "dataFileName";

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

### find data

Find the data you want with the query you want using .find method:

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const query = { name: "John" };
const dataname = "dataFileName";

// Act
const result = await db.find(dataname, query);

// Assert
expect(result).toEqual({
  acknowledged: true,
  message: "Found data matching your query.",
  results: { _id: "1234", name: "John" },
});
```

### Remove data

Remove the data you want with the query you want using .remove method:

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const query = { _id: "1234" };
const dataname = "remove";

// Act
const result = await db.remove(dataname, query);

// Assert
expect(result).toEqual({
  acknowledged: true,
  message: "1 document(s) removed successfully.",
  results: null,
});
```

### Update

Update the data you want with the query you want using .update method:

```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const updateQuery = { $set: { name: "Mike" } };
const dataname = "update";

// Act
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
```

###

## Conclusion

The jsonVerse package simplifies the management of JSON data files within a specified folder. With the provided examples and usage instructions, you'll be able to efficiently integrate the jsonVerse package into your projects to streamline data operations.
