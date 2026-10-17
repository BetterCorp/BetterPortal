const MAX_FORM_FIELDS = 10_000;
const MAX_FORM_NODES = 10_000;
const MAX_FORM_DEPTH = 32;
const MAX_FORM_INDEX = 999;
const MAX_FORM_NAME_LENGTH = 1024;
const UNSAFE_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

class InvalidFormError extends Error {}

type FormNode =
  | { kind: "object"; children: Map<string | number, FormNode> }
  | { kind: "array"; children: Map<string | number, FormNode> }
  | { kind: "value"; values: string[] };

function fieldPath(name: string): Array<string | number> {
  if (!name || name.length > MAX_FORM_NAME_LENGTH) throw new InvalidFormError("Invalid form field name length");
  if (Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new InvalidFormError("Invalid form property name");
  }
  const path: Array<string | number> = [];
  let offset = 0;
  const property = () => {
    const segment = /^[^.[\]]+/u.exec(name.slice(offset))?.[0];
    if (!segment || UNSAFE_SEGMENTS.has(segment)) throw new InvalidFormError("Invalid form property name");
    path.push(segment);
    offset += segment.length;
  };
  property();
  while (offset < name.length) {
    if (name[offset] === ".") {
      offset++;
      property();
    } else if (name[offset] === "[") {
      const index = /^\[(0|[1-9]\d*)\]/u.exec(name.slice(offset));
      if (!index || Number(index[1]) > MAX_FORM_INDEX) throw new InvalidFormError("Invalid form array index");
      path.push(Number(index[1]));
      offset += index[0].length;
    } else {
      throw new InvalidFormError("Invalid form field path");
    }
    if (path.length > MAX_FORM_DEPTH) throw new InvalidFormError("Form field path exceeds maximum depth");
  }
  return path;
}

function materialize(node: FormNode): unknown {
  if (node.kind === "value") return node.values.length === 1 ? node.values[0] : node.values;
  if (node.kind === "object") {
    return Object.fromEntries(Array.from(node.children, ([key, child]) => [key, materialize(child)]));
  }
  // Check density before allocating an array; sparse input must not bypass schema validation.
  const result: unknown[] = [];
  for (let index = 0; index < node.children.size; index++) {
    const child = node.children.get(index);
    if (!child) throw new InvalidFormError("Form array indices must be contiguous starting at zero");
    result.push(materialize(child));
  }
  return result;
}

/** Decode native form names before request-schema validation; file values remain filenames. */
export function decodeFormBody(form: FormData): Record<string, unknown> {
  const root: FormNode = { kind: "object", children: new Map() };
  let fields = 0;
  let nodes = 0;
  for (const [name, value] of form) {
    if (++fields > MAX_FORM_FIELDS) throw new InvalidFormError("Form exceeds maximum field count");
    const path = fieldPath(name);
    let node: FormNode = root;
    for (let depth = 0; depth < path.length; depth++) {
      const key = path[depth];
      if (node.kind === "value" || (node.kind === "array") !== (typeof key === "number")) {
        throw new InvalidFormError("Conflicting form field paths");
      }
      const kind = depth === path.length - 1 ? "value"
        : typeof path[depth + 1] === "number" ? "array" : "object";
      let child: FormNode | undefined = node.children.get(key);
      if (!child) {
        if (++nodes > MAX_FORM_NODES) throw new InvalidFormError("Form exceeds maximum structure size");
        const created: FormNode = kind === "value" ? { kind, values: [] } : { kind, children: new Map() };
        node.children.set(key, created);
        child = created;
      } else if (child.kind !== kind) {
        throw new InvalidFormError("Conflicting form field paths");
      }
      node = child;
    }
    if (node.kind === "value") node.values.push(typeof value === "string" ? value : value.name);
  }
  return materialize(root) as Record<string, unknown>;
}
