import { hostname } from "node:os";

export const configManagerInstance = `${hostname()}:${process.pid}`;
