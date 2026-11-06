import * as fs from "node:fs";
import * as path from "node:path";
import { findPackageJson, normalizeRegistryUrl, parseContract, readContract, readProjectConfig, registryRefParts } from "./project.js";

async function contractInputs(input: string): Promise<Array<{ name: string; contract: ReturnType<typeof parseContract> }>> {
  if (/^https?:\/\//i.test(input)) {
    const url = `${input.replace(/\/+$/, "")}/.well-known/bp/schema.json`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Contract fetch failed (${response.status}): ${url}`);
    return [{ name: url, contract: parseContract(await response.json()) }];
  }
  const absolute = path.resolve(input);
  if (!fs.existsSync(absolute)) throw new Error(`Contract path not found: ${absolute}`);
  const files = fs.statSync(absolute).isDirectory()
    ? fs.readdirSync(absolute).filter((name) => name.endsWith(".json")).map((name) => path.join(absolute, name))
    : [absolute];
  return files.map((file) => ({ name: file, contract: readContract(file) }));
}

export async function publishContracts(input = "lib/bp-contracts", options: { token?: string; registryUrl?: string } = {}): Promise<string[]> {
  const packageDir = path.dirname(findPackageJson());
  const config = readProjectConfig(packageDir);
  if (!config.registryRef) throw new Error("betterportal.json must define registryRef before publishing");
  const [namespace, name] = registryRefParts(config.registryRef);
  const token = options.token;
  if (!token) throw new Error("An explicit registry token is required (--token-file)");
  const published: string[] = [];
  for (const item of await contractInputs(input)) {
    const response = await fetch(`${normalizeRegistryUrl(options.registryUrl)}/v1/packages/${namespace}/${name}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(item.contract)
    });
    const body = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(body.message ?? `Publish failed (${response.status}): ${item.name}`);
    published.push(`${config.registryRef}@${item.contract.manifest.version}`);
  }
  return published;
}
