import type { AppEnv } from "./types/env-types.js";

import { createFactory } from "hono/factory";

const factory = createFactory<AppEnv>();

export default factory;
