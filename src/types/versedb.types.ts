import { PathLike } from "fs";

export interface Connect {
  options: versedbOptions;
  backaupFolder?: PathLike | undefined;
}

export interface versedbOptions {
  adapter: Adapter;
  backaupFolder?: PathLike;
}

export interface Adapter {
  filePath: string;
  devLogs: boolean;
  logsPath?: string;
}

export interface versedbFindOptions {
  first: boolean;
  limit: number;
}