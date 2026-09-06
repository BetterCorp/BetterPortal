// Exercise the existing BSB store; do not duplicate its encryption or persistence policy.
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { BootstrapStateStore } from "../../plugins/nodejs/betterportal-bsb/lib/bootstrapState.js";

export async function bootstrapRequest(body) {
  const directory = await mkdtemp(join(tmpdir(), "bp-bootstrap-"));
  const filePath = join(directory, "state.json");
  try {
    await writeFile(filePath + ".key", body.key, { mode: 0o600 });
    const store = new BootstrapStateStore({ filePath });
    if (body.operation === "encrypt") {
      store.write(body.state);
      return { valid: true, stored: await readFile(filePath, "utf8") };
    }
    await writeFile(filePath, body.stored, { mode: 0o600 });
    return { valid: true, state: store.read() };
  } catch (error) { return { valid: false, error: error.message }; }
  finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error("Invalid temporary directory");
    await rm(directory, { recursive: true });
  }
}
