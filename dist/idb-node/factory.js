/**
 * IDBFactory: open and deleteDatabase (pure TS WAL backend).
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { WalBackend } from "./wal-backend.js";
import { FakeIDBDatabase } from "./database.js";
import { FakeIDBOpenDBRequest } from "./request.js";
const DEFAULT_BASE_PATH = join(typeof process !== "undefined" ? process.cwd() : ".", ".spacekit-idb");
function readVersionFile(dbPath) {
    const vPath = dbPath + ".version";
    if (!existsSync(vPath))
        return 0;
    try {
        return parseInt(readFileSync(vPath, "utf8"), 10) || 0;
    }
    catch {
        return 0;
    }
}
function writeVersionFile(dbPath, version) {
    const dir = dirname(dbPath);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    writeFileSync(dbPath + ".version", String(version));
}
function readSchemaFile(dbPath) {
    const sPath = dbPath + ".schema.json";
    if (!existsSync(sPath))
        return [];
    try {
        const json = readFileSync(sPath, "utf8");
        const arr = JSON.parse(json);
        return Array.isArray(arr) ? arr : [];
    }
    catch {
        return [];
    }
}
function writeSchemaFile(dbPath, schema) {
    const dir = dirname(dbPath);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    writeFileSync(dbPath + ".schema.json", JSON.stringify(schema));
}
export function createIDBFactory(basePath = DEFAULT_BASE_PATH) {
    return {
        open(name, version) {
            const req = new FakeIDBOpenDBRequest();
            const requestedVersion = version ?? 1;
            const dbPath = join(basePath, name);
            const storedVersion = readVersionFile(dbPath);
            const backend = new WalBackend(dbPath);
            const db = new FakeIDBDatabase(name, requestedVersion, backend);
            if (requestedVersion > storedVersion) {
                queueMicrotask(() => {
                    try {
                        if (req.onupgradeneeded) {
                            const ev = new Event("upgradeneeded");
                            Object.defineProperty(ev, "newVersion", { value: requestedVersion, writable: false });
                            Object.defineProperty(ev, "oldVersion", { value: storedVersion, writable: false });
                            req.onupgradeneeded(ev);
                        }
                        writeVersionFile(dbPath, requestedVersion);
                        writeSchemaFile(dbPath, db.getStoresSchema());
                    }
                    catch (e) {
                        req._reject(e instanceof Error ? e : new Error(String(e)));
                        return;
                    }
                    req._resolve(db);
                });
            }
            else {
                const schema = readSchemaFile(dbPath);
                if (schema.length > 0)
                    db.setStoresFromSchema(schema);
                queueMicrotask(() => req._resolve(db));
            }
            return req;
        },
        deleteDatabase(name) {
            const req = new FakeIDBOpenDBRequest();
            const dbPath = join(basePath, name);
            queueMicrotask(() => {
                try {
                    const walPath = dbPath.endsWith(".wal") ? dbPath : dbPath + ".wal";
                    if (existsSync(walPath))
                        unlinkSync(walPath);
                    if (existsSync(dbPath + ".version"))
                        unlinkSync(dbPath + ".version");
                    if (existsSync(dbPath + ".schema.json"))
                        unlinkSync(dbPath + ".schema.json");
                    req._resolve(undefined);
                }
                catch (e) {
                    req._reject(e instanceof Error ? e : new Error(String(e)));
                }
            });
            return req;
        },
    };
}
