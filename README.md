
![image](https://github.com/jedi-studio/verse.db/assets/100785809/269a554b-1157-4351-be16-f9c23c5ee1a2) 

verse.db isn't just a database, it's your universal data bridge. Designed for unmatched flexibility, security, and performance, verse.db empowers you to manage your data with ease.

[![Tests of Verse.db](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml/badge.svg)](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml)
[![Tests deployments](https://img.shields.io/github/deployments/jedi-studio/verse.db/Tests)](https://github.com/jedi-studio/verse.db/deployments/Tests)
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
#or
yarn add verse.db
#or
bun add verse.db
#or
pnpm add verse.db
```

- **You Can also use:**

```bash
npm create verse.db@latest
#or
yarn create verse.db@latest
#or
bun create verse.db@latest
#or
pnpm create verse.db@latest
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
  secure: { enable: false, secret: "" }, // Add your secrete key for securing your data "Note: if you forgot your Key. It will be hard to get your data"
  backup: { enable: false, path: "", retention: 0 }, // Under Development: Backing up
};

const db = new versedb.connect(adapterOptions); // use the connect method to connect a database
```

Note\*: that you can make a multiple databases in the same time with/without the same extention

## Documentation And Usage Information

- Kindly Note: Database usage and explaination has been  moved fully to our verse.db website. You can visit us on [verse.db](https://versedb.jedi-studio.com)
