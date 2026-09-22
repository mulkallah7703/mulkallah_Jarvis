import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-ts-hooks.mjs", import.meta.url);
