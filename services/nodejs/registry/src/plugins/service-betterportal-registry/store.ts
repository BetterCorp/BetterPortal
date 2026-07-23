import { contractDigest, type BpSchemaOutput } from "@betterportal/framework";
import * as fs from "node:fs";
import * as path from "node:path";

interface PackageIndexEntry {
  pluginId: string;
  versions: string[];
}

interface RegistryIndex {
  packages: Record<string, PackageIndexEntry>;
  pluginIds: Record<string, string>;
}

export interface StoredContract {
  registryRef: string;
  pluginId: string;
  version: string;
  digest: string;
  publishedAt: string;
  contract: BpSchemaOutput;
}

export type PublishResult =
  | { status: "created" | "unchanged"; stored: StoredContract }
  | { status: "identity_conflict" | "version_conflict"; message: string };

function semverCompare(left: string, right: string): number {
  const parse = (value: string) => {
    const withoutBuild = value.split("+", 1)[0];
    const separator = withoutBuild.indexOf("-");
    const core = separator < 0 ? withoutBuild : withoutBuild.slice(0, separator);
    const prerelease = separator < 0 ? undefined : withoutBuild.slice(separator + 1).split(".");
    return { core: core.split(".").map(Number), prerelease };
  };
  const a = parse(left);
  const b = parse(right);
  const core = (a.core[0] - b.core[0]) || (a.core[1] - b.core[1]) || (a.core[2] - b.core[2]);
  if (core) return core;
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const av = a.prerelease[index];
    const bv = b.prerelease[index];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    const an = /^[0-9]+$/.test(av);
    const bn = /^[0-9]+$/.test(bv);
    if (an && bn) return Number(av) - Number(bv);
    if (an !== bn) return an ? -1 : 1;
    return av.localeCompare(bv);
  }
  return 0;
}

export class ContractRegistryStore {
  private index: RegistryIndex = { packages: {}, pluginIds: {} };

  constructor(private readonly dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(this.indexFile())) {
      this.index = JSON.parse(fs.readFileSync(this.indexFile(), "utf8")) as RegistryIndex;
    }
  }

  publish(registryRef: string, contract: BpSchemaOutput): PublishResult {
    const { pluginId, version } = contract.manifest;
    const existingRef = this.index.pluginIds[pluginId];
    const entry = this.index.packages[registryRef];
    if ((existingRef && existingRef !== registryRef) || (entry && entry.pluginId !== pluginId)) {
      return { status: "identity_conflict", message: "Registry reference and plugin ID are permanently bound" };
    }
    const digest = contractDigest(contract);
    const existing = this.get(registryRef, version);
    if (existing) {
      return existing.digest === digest
        ? { status: "unchanged", stored: existing }
        : { status: "version_conflict", message: `${registryRef}@${version} already exists with different content` };
    }
    const stored: StoredContract = { registryRef, pluginId, version, digest, publishedAt: new Date().toISOString(), contract };
    this.atomicWrite(this.packageFile(registryRef, version), stored);
    this.index.packages[registryRef] = {
      pluginId,
      versions: [...(entry?.versions ?? []), version].sort(semverCompare)
    };
    this.index.pluginIds[pluginId] = registryRef;
    this.atomicWrite(this.indexFile(), this.index);
    return { status: "created", stored };
  }

  get(registryRef: string, version: string): StoredContract | null {
    const entry = this.index.packages[registryRef];
    if (!entry) return null;
    const resolved = version === "latest" ? entry.versions.at(-1) : version;
    if (!resolved) return null;
    const file = this.packageFile(registryRef, resolved);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) as StoredContract : null;
  }

  getByPluginId(pluginId: string, version: string): StoredContract | null {
    const registryRef = this.index.pluginIds[pluginId];
    return registryRef ? this.get(registryRef, version) : null;
  }

  list(name?: string): Array<{ registryRef: string; contract: BpSchemaOutput; versions: string[] }> {
    return Object.entries(this.index.packages)
      .filter(([registryRef]) => !name || registryRef.split("/")[1] === name)
      .flatMap(([registryRef, entry]) => {
        const stored = this.get(registryRef, "latest");
        return stored ? [{ registryRef, contract: stored.contract, versions: entry.versions }] : [];
      });
  }

  versions(registryRef: string): { pluginId: string; versions: string[] } | null {
    return this.index.packages[registryRef] ?? null;
  }

  private indexFile(): string {
    return path.join(this.dataDir, "index.json");
  }

  private packageFile(registryRef: string, version: string): string {
    const [namespace, name] = registryRef.split("/");
    return path.join(this.dataDir, "packages", namespace, name, `${version}.json`);
  }

  private atomicWrite(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temp, file);
  }
}
