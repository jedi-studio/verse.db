# Verse.db

### Change log:

## v2.3 [Beta]

- Added new adapter "Session" Adapter
- Added new adapter "Cache" Adapter
- Added redis for more advanced adapter for "Session" adapter
- New SQL Adapter

## Version v2.2

- Fixed batchTasks in json/yaml.
- Fixed types.
- Fixed events.
- Remodelled SQL (from scratch).
- Added Schema and schemaless SQL.
- New branded SQL as JSON.
- Made new secure for data for sql files

## Version v2.1

- Enhanced JSON and YAML adapter supporting complex queries and more helper operations.
- Enhanced update & updateMany & loadAll & find & remove & search & moveData.
- Remodelled Schema to support nested data.
- Recoded batchTasks.
- Added Aggregate method in JSON and YAML and adapter.
- Fixed Types.
- Fixed dropData.
- Fixed search.
- Fixed Real-time data.
- Fixed Find operation Keys
- Fixed Unique Keys for add method and schema
- Fixed remove method in JSON/Yaml adapter.

## Version v2.0

- Added real-time data store, which uses db.watch('dataname')
- Added more operations for each adapter, such as: [batchTasks, dataSize, docCount, search, join].
- Fixed Minor bugs in Connection and types.
- Added back the uniqueKeys for schemaless data.
- Remodelled the Schema for Json and Yaml: use SchemaTypes.String or "String".
- Changed Security into optional setting  and non required.
- Added secrets.env to store your keys safely and not to be lost.
- Made `npm create verse.db@latest` for easier setup and configuration for your data connection,
- Added More options, and filters for find and load all data.
- Added Move Data for json and yaml. now you can move specific query or full data from place to another.
- Added Functionality to remove secure from specific files and store them into their original files.
- Fixed Bugs in update and updateMany functionality for JSON and YAML adapter.
- Fixed logger became optional.
- Updated SecureData functionality for SQL.
- Improved Schema to have ability to make trees schema.
- Added .config folder in dataPath to save your secrets keys for secure.
- Added more methods for all adapters.
- Enhanced older methods.
- Encryption changed to secure and became optional.

## Version 1.1

- Securing Database.
- No more `json`/`yaml`/`sql` file extension. Database became (`.verse`)

## Version 1.0

- going from `jsonverse` to `VERSE.DB`
- add `json` adapter
- add `yaml` adapter
- add `sql` adapter
- now we are using `connect` to let you connect to the database

# JSONVERSE
## Version 2.0.0

### Change log:

- Converting the database from `JavaScript` to `TypeScript`
- 
- Setup `xlsx` to the database
- Setup `csv` to the database
- Setup `SQL` to the database
- Improving database stability
- Improving database speed
- Database is now working `inside` & `outside` the module

## Contributors:

- @Marco5dev
- @kmoshax
- @ANAS