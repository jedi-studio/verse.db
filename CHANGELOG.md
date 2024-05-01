# Verse.db

### Change log:

## Version v2.0

- Added real-time data store, which's uses db.watch('dataname')
- Added more operations for each adapter, such as: [batchTasks, dataSize, docCount, search, join].
- Fixed Minor bugs in Connection and types.
- Added back the uniqueKeys for schemeless data.
- Remodeled the Schema for JSON and YAML: use SchemaTypes.String or "String".
- Changed Security into optional setting  and non required.
- Added secrets.env to store your keys safely and not to be lost.
- Made `npm create verse.db@latest` for easier setup and configuration for your data connection.
- Added .config folder in dataPath to save your secrets keys for secure.
- Added More options, and filters for find and load all data.
- Added Move Data for JSON and YAML. now you can move specific query or full data from place to another.
- Added Functionality to remove secure from specific files and store them into their original files.
- File extensions became viewable and can be `json`, `yaml`, and `sql`.

## Version 1.1

- Securing Database.
- No more `json`/`yaml`/`sql` file extension. Database became (`.verse`)

## Verseion 1.0

- going from `jsonverse` to `VERSE.DB`
- add `json` adapter
- add `yaml` adapter
- add `sql` adapter
- now we are using `connect` to let you connect to the database

# JSONVERSE
## Version 2.0.0

### Change log:

- Converting the database from `JavaScript` to `TypeScript`
- Setup `xlsx` to the database
- Setup `csv` to the database
- Setup `SQL` to the database
- Improving database stablity
- Improving database speed
- Database is now working `inside` & `outside` the module

## Contributors:

- @marco5dev
- @kmoshax
- @ANAS