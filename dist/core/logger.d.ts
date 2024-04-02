import { DevLogsOptions } from "../types/connect";
type logsPath = string;
/**
 * @param content the content to log error it
 */
export declare function logError({ content, throwErr, devLogs, }: {
    content: any;
    throwErr?: boolean;
    devLogs?: DevLogsOptions;
}): void;
/**
 * @param content the content to log success it
 */
export declare function logSuccess({ content, devLogs, }: {
    content: any;
    devLogs?: DevLogsOptions;
    logsPath?: logsPath;
}): void;
/**
 * @param content the content to log warning it
 */
export declare function logWarning({ content, devLogs, }: {
    content: any;
    devLogs?: DevLogsOptions;
    logsPath?: logsPath;
}): void;
/**
 * @param content the content to log Info it
 */
export declare function logInfo({ content, devLogs, }: {
    content: any;
    devLogs?: DevLogsOptions;
    logsPath?: logsPath;
}): void;
export {};
