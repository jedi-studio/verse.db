import { group } from "console";
import jsonverse from "../src/index";
import { promises as fs } from "fs";

async function jsonSetup(): Promise<any> {
  const adapterOptions = {
    adapter: "json",
    dataPath: "./tests/json/data",
    devLogs: { enable: true, path: "./tests/json/logs" },
    encryption: { enable: false, secret: "" },
    backup: { enable: false, path: "", retention: 0 },
  };

  const db = new jsonverse.connect(adapterOptions);
  return db;
}

async function sqlSetup(): Promise<any> {
  const adapterOptions = {
    adapter: "sql",
    dataPath: "./tests/sql/data",
    devLogs: { enable: false, path: "./tests/sql/logs" },
    encryption: { enable: false, secret: "" },
    backup: { enable: false, path: "", retention: 0 },
  };

  const db = new jsonverse.connect(adapterOptions);
  return db;
}

(async () => {
const adapter = await jsonSetup();
    const newData = [
        { name: 'John Doe', age: 30, city: 'New York' },
        { name: 'Jane Smith', age: 25, city: 'Los Angeles' }
      ];
      
      const dataFilePath = 'usersInfo';
      
      adapter.add(dataFilePath, newData)
        .then((result: any) => {
          if (result.acknowledged) {
            console.log(result); 
          } else {
            console.error(result.errorMessage);
          }
        })
        .catch((error: any) => {
          console.error('An error occurred:', error);
        });

}) ();