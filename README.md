![Verse.db Logo](https://github.com/jedi-studio/verse.db/assets/100785809/269a554b-1157-4351-be16-f9c23c5ee1a2)

Unlock the potential of your data with Verse.db, the premier data management tool that transcends the ordinary database experience. With unparalleled flexibility, security, and performance, Verse.db empowers you to wield your data with precision and ease.

### Elevate Your Data Experience

- **Flexible**: Seamlessly manage various data formats including JSON, YAML, SQL, and more.
- **Secure**: Safeguard your data with robust encryption and security features.
- **Performance-Driven**: Experience lightning-fast performance for all your data operations.
- **Real-Time Data Store**: Harness the power of real-time data storage for instantaneous updates and access to your data. Keep your applications synchronized and up-to-date with the latest information.
- **Logging System for Developers**: Streamline your development process with Verse.db's built-in logging system. Gain insights into your application's behavior and track changes effectively. Debugging and troubleshooting become effortless with detailed logs at your disposal.
- **Support for Complex Queries**: Effortlessly execute complex queries with Verse.db's advanced query capabilities. Utilize powerful filtering, sorting, and aggregation functionalities to extract valuable insights from your data with ease.
- **User-Friendly Interface**: Enjoy an intuitive and easy-to-use interface that simplifies data management tasks for developers of all levels. Whether you're a seasoned professional or a beginner, Verse.db ensures a smooth and seamless experience.
- **Continuous Improvement**: Benefit from regular updates and enhancements to ensure Verse.db stays ahead of the curve. Our dedicated team is committed to delivering the best-in-class data management solution tailored to your needs.

[![Tests of Verse.db](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml/badge.svg)](https://github.com/jedi-studio/verse.db/actions/workflows/code-test.yml)
[![Tests deployments](https://img.shields.io/github/deployments/jedi-studio/verse.db/Tests)](https://github.com/jedi-studio/verse.db/deployments/Tests)
[![NPM Version](https://img.shields.io/npm/v/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![NPM Downloads](https://img.shields.io/npm/dt/verse.db.svg)](https://www.npmjs.com/package/verse.db)
[![Github Repo Size](https://img.shields.io/github/repo-size/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db)
[![LICENSE](https://img.shields.io/npm/l/verse.db.svg)](https://github.com/jedi-studio/verse.db/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/jedi-studio/verse.db.svg)](https://github.com/jedi-studio/verse.db/commits/master)

## Discover Verse.db

### Introduction

Verse.db is your go-to solution for managing data files effortlessly within a designated folder structure. It provides a comprehensive set of methods for adding, editing, deleting, and retrieving data across various file formats including JSON, YAML, SQL, and more. This comprehensive wiki offers detailed examples and practical usage scenarios to seamlessly integrate Verse.db into your projects.

### Easy Installation

To begin harnessing the power of Verse.db, kickstart your installation journey via npm. Open your terminal and execute the following command:

```bash
npm install verse.db
# or
yarn add verse.db
# or
bun add verse.db
# or
pnpm add verse.db
```

- **Alternatively, you can utilize**:

```bash
npm create verse.db@latest
# or
yarn create verse.db@latest
# or
bun create verse.db@latest
# or
pnpm create verse.db@latest
```

### Import and Initialization

Set up your database connection effortlessly with the `.connect` method:

```javascript
const versedb = require("verse.db");
// or
import versedb from "verse.db";

const adapterOptions = {
  adapter: "json" | "yaml" | "sql", // Specify the adapter type: json, yaml, or sql
  dataPath: "./Data", // Define the data folder path
  devLogs: { enable: true, path: "./Logs" }, // Configure development logs path
  secure: { enable: false, secret: "" }, // Set up data encryption with your secret key
  backup: { enable: false, path: "", retention: 0 }, // Backup functionality under development
};

const db = new versedb.connect(adapterOptions); // Connect to the database
```

Note\*: You can create multiple databases simultaneously with/without the same extension.

## Comprehensive Documentation

For detailed information on usage, operations, and methods, visit [Verse.db Documentation](https://versedb.jedi-studio.com). Unlock the full potential of Verse.db and elevate your data management experience today!

### Soon: SQON

- In the future updates we will introduce our new brand database SQON: (Structured Query Object Notation). Stay tuned ;).
- Check it out its structure on [Git-Hub](https://github.com/jedi-studio/).