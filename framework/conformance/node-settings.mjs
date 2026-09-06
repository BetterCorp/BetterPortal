// Test adapter for the real Node encrypted settings store, without copied policy.
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileBackedServiceConfigStore } from "../nodejs/lib/runtime/configStore.js";

export async function settingsStore(body) {
  const directory = await mkdtemp(join(tmpdir(), "bp-settings-"));
  const filePath = join(directory, "state.json");
  try {
    if (body.stored !== undefined) await writeFile(filePath, body.stored);
    const store = new FileBackedServiceConfigStore({ filePath, encryptionKey: body.key, configSchemas: body.descriptors });
    const outcomes = [];
    for (const step of body.steps) {
      const ticket = { tenantId: step.tenantId };
      let values;
      if (step.kind === "write") {
        for (const key of step.clearKeys ?? []) store.clearKey(step.tenantId, step.appId, key, ticket);
        const state = store.write(step.tenantId, step.appId, step.values, ticket);
        values = step.appId ? state.app[step.appId] : state.tenant;
      } else if (step.kind === "read") {
        const state = store.read(ticket);
        values = step.appId ? state.app[step.appId] ?? {} : state.tenant;
      } else if (step.kind !== "initialize") throw new Error("Unsupported Node probe step");
      outcomes.push({ valid: true, ...(values ? { values } : {}) });
    }
    return { outcomes, stored: await readFile(filePath, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; }) };
  } finally { await rm(directory, { recursive: true }); }
}
