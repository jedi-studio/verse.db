import path from "path";
import fs from "fs/promises";
import colors from "../lib/colors";
import { currentDate } from "../lib/date";
import { DevLogsOptions } from "../types/connect";
type logsPath = string;
type LogFile = string;

/**
 * @param content the content to log it in a file and the console the both in the same time
 */
async function logToFile({
  content,
  logFile,
  logsPath,
}: {
  content: any;
  logFile: LogFile;
  logsPath: logsPath;
}): Promise<void> {
  function removeAnsiEscapeCodes(input: string): string {
    return input.replace(/\x1b\[\d+m/g, "");
  }

  const logFilePath: string = path.join(logsPath, logFile);
  try {
    await fs.mkdir(logsPath, { recursive: true });
    await fs.appendFile(
      logFilePath,
      `${currentDate} ${removeAnsiEscapeCodes(content)}\n`,
      "utf8"
    );
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.mkdir(logsPath, { recursive: true });
      try {
        await fs.writeFile(
          logFilePath,
          `${removeAnsiEscapeCodes(content)}\n`,
          "utf8"
        );
      } catch (readError) {
        logError({
          content: `Failed to create log file: ${readError}`,
        });
      }
    } else {
      logError({
        content: `Failed to save logs: ${error}`,
      });
    }
  }
}

/**
 * @param content the content to log error it
 */
export function logError({
  content,
  throwErr,
  devLogs,
}: {
  content: any;
  throwErr?: boolean;
  devLogs?: DevLogsOptions;
}): void {
  if (devLogs?.enable === true) {
    logToFile({
      content: `${colors.bright}${colors.fg.red}[Error]:${colors.reset} ${content}`,
      logsPath: devLogs.path,
      logFile: "error.log",
    });
    if (throwErr === true) {
      throw new Error(
        `${colors.bright}${colors.fg.red}[Error]:${colors.reset} ${content}`
      );
    } else {
      console.error(
        `${colors.bright}${colors.fg.red}[Error]:${colors.reset} ${content}`
      );
    }
  } else {
    if (throwErr === true) {
      throw new Error(
        `${colors.bright}${colors.fg.red}[Error]:${colors.reset} ${content}`
      );
    } else {
      console.error(
        `${colors.bright}${colors.fg.red}[Error]:${colors.reset} ${content}`
      );
    }
  }
}

/**
 * @param content the content to log success it
 */
export function logSuccess({
  content,
  devLogs,
}: {
  content: any;
  devLogs?: DevLogsOptions;
  logsPath?: logsPath;
}): void {
  if (devLogs?.enable === true) {
    logToFile({
      content: `${colors.bright}${colors.fg.green}[Successful]:${colors.reset} ${content}`,
      logsPath: devLogs.path,
      logFile: "success.log",
    });
    console.log(
      `${colors.bright}${colors.fg.green}[Successful]:${colors.reset} ${content}`
    );
  } else {
    console.log(
      `${colors.bright}${colors.fg.green}[Successful]:${colors.reset} ${content}`
    );
  }
}

/**
 * @param content the content to log warning it
 */
export function logWarning({
  content,
  devLogs,
}: {
  content: any;
  devLogs?: DevLogsOptions;
  logsPath?: logsPath;
}): void {
  if (devLogs?.enable === true) {
    logToFile({
      content: `${colors.bright}${colors.fg.yellow}[Warning]:${colors.reset} ${content}`,
      logsPath: devLogs.path,
      logFile: "warning.log",
    });
    console.warn(
      `${colors.bright}${colors.fg.yellow}[Warning]:${colors.reset} ${content}`
    );
  } else {
    console.warn(
      `${colors.bright}${colors.fg.yellow}[Warning]:${colors.reset} ${content}`
    );
  }
}

/**
 * @param content the content to log Info it
 */
export function logInfo({
  content,
  devLogs,
}: {
  content: any;
  devLogs?: DevLogsOptions;
  logsPath?: logsPath;
}): void {
  if (devLogs?.enable === true) {
    logToFile({
      content: `${colors.bright}${colors.fg.blue}[Info]:${colors.reset} ${content}`,
      logsPath: devLogs.path,
      logFile: "info.log",
    });
    console.info(
      `${colors.bright}${colors.fg.blue}[Info]:${colors.reset} ${content}`
    );
  } else {
    console.info(
      `${colors.bright}${colors.fg.blue}[Info]:${colors.reset} ${content}`
    );
  }
}
