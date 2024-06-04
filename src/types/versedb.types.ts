import { JSONAdapter, SQLAdapter, YAMLAdapter } from "./connect";

export interface Connect {
  adapter: 'json' | 'yaml' | 'sql' | string;
  dataPath: string;
  devLogs?: { enable: boolean, path: string };
  secure?: { enable: boolean, secret?: string };
  backup?: any;
}

export interface verseManagers {
  JsonManager?: JSONAdapter;
  YamlManager?: YAMLAdapter;
  SqlManager?: SQLAdapter;
 }
