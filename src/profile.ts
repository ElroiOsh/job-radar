import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { Profile } from "./types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadProfile(): Profile {
  const raw = readFileSync(join(root, "profile.yaml"), "utf8");
  return yaml.load(raw) as Profile;
}

export function projectRoot(): string {
  return root;
}
