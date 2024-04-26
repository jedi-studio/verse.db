import fs from "fs";
import { decodeJSON } from "./secureData";

async function readFileContent(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(`Error reading ${filePath}: ${err}`);
      } else {
        resolve(data);
      }
    });
  });
}

export async function fileWatcher(
  filePath: string,
  key: string
): Promise<string> {
  let watcher: fs.FSWatcher | null = null;
  let lastContent: any;

  return new Promise((resolve, reject) => {
    const startWatcher = () => {
      watcher = fs.watch(filePath, async (eventType, filename) => {
        if (filename && eventType === "change") {
          try {
            const content = await readFileContent(filePath);

            if (content !== lastContent) {
              lastContent = await decodeJSON(filePath, key);
              resolve(lastContent);
              stopWatcher(); // Stop watcher after detecting a change
            }
          } catch (error) {
            reject(error);
          }
        }
      });

      watcher.on("error", (error) => {
        reject(`Error watching file: ${error}`);
      });
    };

    const stopWatcher = () => {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    };

    // Start watching the file
    startWatcher();

    // Watch for changes to restart the watcher
    fs.watch(filePath, (eventType, filename) => {
      if (filename && eventType === "change") {
        // Restart the watcher
        stopWatcher();
        startWatcher();
      }
    });
  });
}
