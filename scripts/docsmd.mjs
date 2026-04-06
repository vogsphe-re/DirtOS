#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "docs.versions.json");
const docsDir = path.join(rootDir, "docs");

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function saveManifest(manifest) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function runDocmd(command, args) {
  const result = spawnSync(
    "pnpm",
    ["exec", "docmd", command, ...args],
    {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function validateVersionId(id) {
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(id)) {
    throw new Error(
      "Docs version IDs must start with an alphanumeric character and only use letters, numbers, dots, or hyphens.",
    );
  }

  return id;
}

function snapshotDocs(args) {
  const nextId = validateVersionId(args[0] ?? "");
  const nextLabel = args[1] ?? nextId;
  const manifest = loadManifest();
  const currentVersion = manifest.current;

  if (!currentVersion?.id || !currentVersion?.label) {
    throw new Error("docs.versions.json is missing the current docs version.");
  }

  if (currentVersion.id === nextId) {
    throw new Error("The new docs version ID must be different from the current one.");
  }

  const archiveDir = `docs-${currentVersion.id}`;
  const archivePath = path.join(rootDir, archiveDir);

  if (existsSync(archivePath)) {
    throw new Error(`Archive directory already exists: ${archiveDir}`);
  }

  cpSync(docsDir, archivePath, {
    recursive: true,
    errorOnExist: true,
  });

  manifest.archives = [
    {
      id: currentVersion.id,
      dir: archiveDir,
      label: currentVersion.label,
    },
    ...(manifest.archives ?? []).filter((archive) => archive.id !== currentVersion.id),
  ];

  manifest.current = {
    id: nextId,
    label: nextLabel,
  };

  saveManifest(manifest);

  console.log(
    `Archived docs ${currentVersion.label} to ${archiveDir} and set the new current docs version to ${nextLabel}.`,
  );
}

function main() {
  const [command = "build", ...rawArgs] = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  try {
    switch (command) {
      case "build":
        runDocmd("build", args);
        break;
      case "dev":
        runDocmd("dev", args);
        break;
      case "snapshot":
        if (args.length === 0) {
          throw new Error("Usage: node scripts/docsmd.mjs snapshot <new-version-id> [label]");
        }
        snapshotDocs(args);
        break;
      default:
        throw new Error(`Unknown docsmd command: ${command}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();