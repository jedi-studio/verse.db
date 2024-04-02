# verse.db

verse.db isn't just a database, it's your universal data bridge. Designed for unmatched flexibility, security, and performance, verse.db empowers you to manage your data with ease.

[![Periodic testing of the Verse.db](https://github.com/Marco5dev/verse.db/actions/workflows/code-test.yml/badge.svg)](https://github.com/Marco5dev/verse.db/actions/workflows/code-test.yml)
[![Build](https://github.com/Marco5dev/verse.db/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/Marco5dev/verse.db/actions/workflows/npm-publish.yml)
[![NPM Version](https://img.shields.io/npm/v/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![NPM Downloads](https://img.shields.io/npm/dt/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![Github Repo Size](https://img.shields.io/github/repo-size/Marco5dev/verse.db.svg)](https://github.com/Marco5dev/verse.db)
[![LICENSE](https://img.shields.io/npm/l/verse.db.svg)](https://github.com/Marco5dev/verse.db/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/Marco5dev/verse.db.svg)](https://github.com/Marco5dev/verse.db/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/Marco5dev/verse.db.svg)](https://github.com/Marco5dev/verse.db/commits/master)

## Introduction

The verse.db package is a powerful utility designed to simplify the management of data files within a designated folder. It offers methods for adding, editing, deleting, and retrieving data from JSON, YAML, SQL & more files. This wiki provides detailed examples and usage scenarios to help you effectively implement the verse.db package in your projects.

## Installation

To begin using the verse.db package, you'll need to install it via npm. Open your terminal and run the following command:

```bash
npm install verse.db
yarn add verse.db
pnpm add verse.db
bun add verse.db
```

## Usage

### Import and Initialization

- to get started setup the database connection uding .connect method

<details>

```javascript
const versedb = require("verse.db"); // JS or CJS module 
// or
import versedb from "verse.db"; // TS or ES module

const adapterOptions = {
  adapter: "json" | "yaml" | "sql", // Type of the Database to use
  dataPath: "./Data", // Path to the databse folder
  devLogs: { enable: true, path: "./Logs" }, // Logs of database events
  encryption: { enable: false, secret: "" }, // Under Maintenance
  backup: { enable: false, path: "", retention: 0 }, // Under Maintenance
};

const db = new versedb.connect(adapterOptions); // use the connect method to connect a database
```

</details>

Note\*:  You can make a multiple database files in the same time with/without the same intializer

### Load a data file

- You can load any data file using .load method

<details>


```javascript
const dataname = "data"; // The name of the file of the database
const result = await db.load(dataname);

console.log(result);
```

</details>


### Add Data

- To add data, use the .add method, for example:

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
}
```

</details>


### find data

- Find the data you want with the query you want using .find method:

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


### Remove data

- Remove the data you want with the query you want using .remove method:

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
const result = await db.remove(dataname, query);

// Assert
expect(result).toEqual({
  acknowledged: true,
  message: "1 document(s) removed successfully.",
  results: null,
});
```

</details>


### Update

- Update the data you want with the query you want using .update method:

<details>


```javascript
// Arrange
const data = [
  { _id: "1234", name: "John" },
  { _id: "5678", name: "Jane" },
];
const updateQuery = { $set: { name: "Mike" } };
const dataname = "users";

// Valid operation Kyes
/*
- $set: Modifies an existing field's value or adds a new field if it doesn't exist.
- $unset: Deletes a particular field.
- $inc: Increments the value of a field by a specified amount.
- $currentDate: Sets the value of a field to the current date, either as a Date or a Timestamp.
- $push: Adds an element to an array.
- $pull: Removes all array elements that match a specified query.
- $position: Modifies the $push operator to specify the position in the array to add elements.
- $max: Updates the value of the field to the specified value if the specified value is greater than the current value.
- $min: Updates the value of the field to the specified value if the specified value is less than the current value.
- $or: Performs a logical OR operation on an array of two or more query expressions.
- $addToSet: Adds elements to an array only if they do not already exist in the set.
- $pushAll: Adds multiple values to an array.
- $pop: Removes the first or last element of an array.
- $pullAll: Removes all occurrences of specified values from an array.
- $rename: Renames a field.
- $bit: Performs bitwise AND, OR, and XOR updates of integer values.
- $mul: Multiplies the value of a field by a specified amount.
- $each: Modifies the $push and $addToSet operators to append multiple values to an array.
- $slice: Limits the number of elements in an array that matches the query condition.
- $sort: Orders the elements of an array.
*/


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

</details>

## For Further Usages (Other Adapters And Functions)

- Kindly Note: We provide here a very small sample for usage for JSON for further usage and information. Check out on our [website](https://versedb.jedi-studio.com)

- For Support And Help: Visit us on our discord server. [Link](https://discord.gg/mDyXV9hzXw)

## Conclusion

Verse.db stands as a cutting-edge database management platform engineered to effortlessly handle JSON, YAML, and SQL data formats. While presently we don't provide server hosting for user data, rest assured, it's on our roadmap and will soon become a reality. Furthermore, we're dedicated to broadening our support for diverse data formats, ensuring we meet and exceed your evolving needs and expectations. Stay tuned for an even more feature-rich experience!