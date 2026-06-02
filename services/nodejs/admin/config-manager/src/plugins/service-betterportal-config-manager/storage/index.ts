import * as av from "anyvali";
import path from "node:path";
import type { PlatformConfigStore } from "@betterportal/framework";
import {
  type StorageOptions
} from "./core.js";
import { FileStorage } from "./file.js";
import { PostgresStorage } from "./postgres.js";

export * from "./core.js";
export * from "./file.js";
export * from "./postgres.js";

export const FilePlatformConfigStorageSchema = av.object({
  backend: av.literal("file"),
  configPath: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const PostgresPlatformConfigStorageSchema = av.object({
  backend: av.literal("postgres"),
  connectionString: av.string().minLength(1),
  tableName: av.optional(av.string().minLength(1)),
  rowId: av.optional(av.string().minLength(1))
}, { unknownKeys: "strip" });

export const PlatformConfigStorageSchema = av.union([
  FilePlatformConfigStorageSchema,
  PostgresPlatformConfigStorageSchema
]).default({
  backend: "file",
  configPath: "./bp-config.yaml"
});

export type PlatformConfigStorage = typeof PlatformConfigStorageSchema["_output"];

export function createStorage(options: StorageOptions): PlatformConfigStore {
  if (options.backend === "postgres") {
    return new PostgresStorage(options);
  }

  return new FileStorage(options.configPath);
}

export function createStorageFromConfig(
  storage: PlatformConfigStorage,
  cwd: string
): { store: PlatformConfigStore; backend: "file" | "postgres" } {
  if (storage.backend === "postgres") {
    return {
      backend: "postgres",
      store: createStorage(storage)
    };
  }

  return {
    backend: "file",
    store: createStorage({
      backend: "file",
      configPath: path.isAbsolute(storage.configPath)
        ? storage.configPath
        : path.resolve(cwd, storage.configPath)
    })
  };
}
