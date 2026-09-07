import createClient from "openapi-fetch";
import type { paths } from "./schema.js";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const api = createClient<paths>({ baseUrl });

export type { components } from "./schema.js";
