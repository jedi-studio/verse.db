/// <reference types="node" />
import { EventEmitter } from "events";
import { AdapterOptions, AdapterResults, versedbAdapter, CollectionFilter, SearchResult } from "../types/adapter";
import { DevLogsOptions, AdapterSetting } from "../types/adapter";
export declare class jsonAdapter extends EventEmitter implements versedbAdapter {
    devLogs: DevLogsOptions;
    constructor(options: AdapterSetting);
    load(dataname: string): Promise<any[]>;
    add(dataname: string, newData: any, options?: AdapterOptions): Promise<AdapterResults>;
    private indexes;
    private createIndexesIfNotExists;
    find(dataname: string, query: any): Promise<AdapterResults>;
    loadAll(dataname: string, displayOptions: any): Promise<AdapterResults>;
    remove(dataname: string, query: any, options?: {
        docCount: number;
    }): Promise<AdapterResults>;
    update(dataname: string, query: any, updateQuery: any, upsert?: boolean): Promise<AdapterResults>;
    updateMany(dataname: string, query: any, updateQuery: any): Promise<AdapterResults>;
    drop(dataname: string): Promise<AdapterResults>;
    search(dataPath: string, collectionFilters: CollectionFilter[]): Promise<{
        acknowledged: boolean;
        message: string;
        errorMessage: null;
        results: SearchResult;
    } | {
        acknowledged: boolean;
        errorMessage: string;
        results: null;
        message?: undefined;
    }>;
    initFile({ dataname }: {
        dataname: string;
    }): void;
    initDir({ dataFolder }: {
        dataFolder: string;
    }): void;
}
