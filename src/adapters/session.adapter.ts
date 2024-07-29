import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { logError, logInfo, logSuccess } from "../core/functions/logger";
import {
  DevLogsOptions,
  AdapterSetting,
  AdapterResults,
  SessionAdapter as ISessionAdapter,
  SessionData,
} from "../types/adapter";
import { SecureSystem } from "../types/connect";
import zlib from "zlib";

export class sessionAdapter extends EventEmitter implements ISessionAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public secure: SecureSystem = { enable: false, secret: "" };
  private dataPath: string;
  private maxSize: number;
  private ttl: number;
  private sessions: Map<string, { data: SessionData; expiry: number | null }>;
  private useMemory: boolean;

  /**
   * Create a new SessionAdapter instance
   * @param {AdapterSetting & { secure: SecureSystem, maxSize?: number, ttl?: number, useMemory?: boolean }} options - Session settings including security options, max size, time-to-live, in-memory caching
   */
  constructor(
    options: AdapterSetting & {
      maxSize?: number;
      ttl?: number;
      useMemory?: boolean;
    },
    key: SecureSystem
  ) {
    super();
    this.devLogs = options.devLogs;
    this.secure = key;
    this.dataPath = options.dataPath || "./sessions";
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 0;
    this.useMemory = options.useMemory || false;
    this.sessions = new Map();

    if (this.devLogs.enable && !this.devLogs.path) {
      logError({
        content: "You need to provide a logs path if devLogs is enabled.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Get the file path for a session
   * @param {string} sessionId - The session ID
   * @returns {string} - The file path for the session
   */
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.dataPath, `${sessionId}.json`);
  }

  /**
   * Check if a session has expired
   * @param {number | null} expiry - The expiry timestamp
   * @returns {boolean} - True if expired, otherwise false
   */
  private isExpired(expiry: number | null): boolean {
    if (expiry === null) return false;
    return Date.now() > expiry;
  }

  /**
   * Prune expired sessions
   */
  private prune(): void {
    const keys = Array.from(this.sessions.keys());
    for (const key of keys) {
      const entry = this.sessions.get(key)!;
      if (this.isExpired(entry.expiry)) {
        this.sessions.delete(key);
        logInfo({
          content: `Session ${key} expired and removed from memory`,
          devLogs: this.devLogs,
        });
      }
    }

    if (this.sessions.size > this.maxSize) {
      while (this.sessions.size > this.maxSize) {
        const oldestKey = this.sessions.keys().next().value;
        this.sessions.delete(oldestKey);
        logInfo({
          content: `Session ${oldestKey} evicted from memory due to max size limit`,
          devLogs: this.devLogs,
        });
      }
    }
  }

  /**
   * Load a session by ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<AdapterResults | null>} - A Promise that resolves with the session data or null if not found
   */
  public async load(sessionId: string): Promise<AdapterResults | null> {
    this.prune();

    if (this.sessions.has(sessionId)) {
      const entry = this.sessions.get(sessionId)!;
      if (this.isExpired(entry.expiry)) {
        this.sessions.delete(sessionId);
        logInfo({
          content: `Session ${sessionId} expired and removed from memory`,
          devLogs: this.devLogs,
        });
        return null;
      } else {
        logInfo({
          content: `Session ${sessionId} loaded from memory`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: true,
          message: `Session ${sessionId} loaded from memory`,
          session: entry.data,
        };
      }
    }

    const sessionFilePath = this.getSessionFilePath(sessionId);

    if (fs.existsSync(sessionFilePath)) {
      try {
        const data = zlib.gunzipSync(fs.readFileSync(sessionFilePath));
        const sessionData: SessionData = JSON.parse(data.toString());
        const expiry = sessionData.expiry
          ? new Date(sessionData.expiry).getTime()
          : null;

        if (this.isExpired(expiry)) {
          fs.unlinkSync(sessionFilePath);
          logInfo({
            content: `Session ${sessionId} expired and removed from disk`,
            devLogs: this.devLogs,
          });
          return null;
        }

        this.sessions.set(sessionId, { data: sessionData, expiry });
        logInfo({
          content: `Session ${sessionId} loaded from disk`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: true,
          message: `Session ${sessionId} loaded from disk`,
          session: sessionData,
        };
      } catch (err) {
        logError({
          content: `Failed to read session ${sessionId}: ${err}`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Failed to read session ${sessionId}: ${err}`,
        };
      }
    }

    return null;
  }

  /**
   * Add or update a session
   * @param {string} sessionId - The session ID
   * @param {SessionData} sessionData - The session data
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the session is saved
   */
  public async add(
    sessionId: string,
    sessionData: SessionData
  ): Promise<AdapterResults> {
    const expiry = this.ttl > 0 ? Date.now() + this.ttl : null;
    this.sessions.set(sessionId, { data: sessionData, expiry });
    this.prune();

    const sessionFilePath = this.getSessionFilePath(sessionId);

    try {
      const compressedData = zlib.gzipSync(
        JSON.stringify(sessionData, null, 2)
      );
      fs.writeFileSync(sessionFilePath, compressedData);
      logSuccess({
        content: `Session ${sessionId} saved`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: true,
        message: `Session ${sessionId} saved`,
      };
    } catch (err) {
      logError({
        content: `Failed to save session ${sessionId}: ${err}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to save session ${sessionId}: ${err}`,
      };
    }
  }

  /**
   * drop a session by ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the session is droped
   */
  public async drop(sessionId: string): Promise<AdapterResults> {
    this.sessions.delete(sessionId);
    const sessionFilePath = this.getSessionFilePath(sessionId);

    try {
      if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
        logSuccess({
          content: `Session ${sessionId} droped`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: true,
          message: `Session ${sessionId} droped`,
        };
      } else {
        return {
          acknowledged: false,
          errorMessage: `Session ${sessionId} does not exist`,
        };
      }
    } catch (err) {
      logError({
        content: `Failed to drop session ${sessionId}: ${err}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to drop session ${sessionId}: ${err}`,
      };
    }
  }

  /**
   * Clear all sessions
   * @returns {Promise<AdapterResults>} - A Promise that resolves when all sessions are cleared
   */
  public async clear(): Promise<AdapterResults> {
    this.sessions.clear();

    try {
      const files = fs.readdirSync(this.dataPath);
      for (const file of files) {
        fs.unlinkSync(path.join(this.dataPath, file));
      }
      logSuccess({
        content: "All sessions cleared",
        devLogs: this.devLogs,
      });
      return {
        acknowledged: true,
        message: "All sessions cleared",
      };
    } catch (err) {
      logError({
        content: `Failed to clear sessions: ${err}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to clear sessions: ${err}`,
      };
    }
  }

  /**
   * Get statistics about the session store
   * @returns {Promise<AdapterResults>} - A Promise that resolves with session statistics
   */
  public async stats(): Promise<AdapterResults> {
    try {
      const files = fs.readdirSync(this.dataPath);
      return {
        acknowledged: true,
        message: "Session statistics retrieved",
        results: {
          count: files.length,
        },
      };
    } catch (err) {
      logError({
        content: `Failed to retrieve session statistics: ${err}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to retrieve session statistics: ${err}`,
      };
    }
  }

  /**
   * Invalidate sessions based on a predicate function
   * @param {(key: string, data: SessionData) => boolean} predicate - The predicate function to determine which sessions to invalidate
   * @returns {Promise<AdapterResults>} - A Promise that resolves when sessions are invalidated
   */
  public async invalidate(
    predicate: (key: string, data: SessionData) => boolean
  ): Promise<AdapterResults> {
    const keys = Array.from(this.sessions.keys());
    for (const key of keys) {
      const entry = this.sessions.get(key)!;
      if (predicate(key, entry.data)) {
        this.sessions.delete(key);
        logInfo({
          content: `Session ${key} invalidated`,
          devLogs: this.devLogs,
        });
      }
    }

    try {
      const files = fs.readdirSync(this.dataPath);
      for (const file of files) {
        const sessionFilePath = path.join(this.dataPath, file);
        const data = zlib.gunzipSync(fs.readFileSync(sessionFilePath));
        const sessionData: SessionData = JSON.parse(data.toString());
        if (predicate(file.replace(".json", ""), sessionData)) {
          fs.unlinkSync(sessionFilePath);
          logInfo({
            content: `Session ${file} invalidated and removed from disk`,
            devLogs: this.devLogs,
          });
        }
      }
      return {
        acknowledged: true,
        message: "Session invalidation complete",
      };
    } catch (err) {
      logError({
        content: `Failed to invalidate sessions: ${err}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to invalidate sessions: ${err}`,
      };
    }
  }

  /**
   * Regenerate session ID to prevent fixation attacks
   * @param {string} oldSessionId - The old session ID
   * @param {string} newSessionId - The new session ID
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the session ID is regenerated
   */
  public async regenerateSessionId(
    oldSessionId: string,
    newSessionId: string
  ): Promise<AdapterResults> {
    const sessionData = this.sessions.get(oldSessionId);
    if (sessionData) {
      this.sessions.set(newSessionId, sessionData);
      this.sessions.delete(oldSessionId);
      const oldSessionFilePath = this.getSessionFilePath(oldSessionId);
      const newSessionFilePath = this.getSessionFilePath(newSessionId);

      try {
        if (fs.existsSync(oldSessionFilePath)) {
          fs.renameSync(oldSessionFilePath, newSessionFilePath);
        }
        logSuccess({
          content: `Session ID regenerated from ${oldSessionId} to ${newSessionId}`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: true,
          message: `Session ID regenerated from ${oldSessionId} to ${newSessionId}`,
        };
      } catch (err) {
        logError({
          content: `Failed to regenerate session ID from ${oldSessionId} to ${newSessionId}: ${err}`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Failed to regenerate session ID from ${oldSessionId} to ${newSessionId}: ${err}`,
        };
      }
    }

    return {
      acknowledged: false,
      errorMessage: `Session ${oldSessionId} does not exist`,
    };
  }

  /**
   * Integrate with Express middleware
   * @returns {function} - The Express middleware function
   */
  public expressMiddleware() {
    return (req: any, res: any, next: any) => {
      req.session = this;
      next();
    };
  }

  /**
   * Integrate with Next.js middleware
   * @returns {function} - The Next.js middleware function
   */
  public nextMiddleware() {
    return async (req: any, res: any, next: any) => {
      req.session = this;
      await next();
    };
  }

  /**
   * Provide hooks for custom logic
   */
  private triggerEvent(
    eventName: string,
    sessionId: string,
    sessionData?: SessionData
  ): void {
    this.emit(eventName, { sessionId, sessionData });
  }
}
