"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXACT_EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".build-tools",
  ".electron-cache",
  ".electron-builder-cache",
  ".git",
  "gfpgan",
  "__pycache__",
  ".idea",
  ".vscode"
]);

function excludedDirectory(name) {
  const lower = String(name || "").toLowerCase();
  return EXACT_EXCLUDED_DIRECTORIES.has(lower)
    || lower.endsWith("-output")
    || lower.startsWith(".qa-")
    || lower.startsWith("qa-report-")
    || /^\.rc.*-backup-/.test(lower);
}

function excludedFile(name) {
  const lower = String(name || "").toLowerCase();
  return lower.endsWith("-build.log")
    || /^avelune-enhance-.*\.zip$/.test(lower)
    || lower.endsWith("-source-snapshot.zip")
    || lower.startsWith("package-lock.before-")
    || lower.endsWith(".pyc")
    || lower.endsWith(".pyo")
    || lower.endsWith(".tmp")
    || lower.endsWith(".bak");
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    values.set(key.slice(2), value);
    index += 1;
  }
  return {
    source: values.get("source"),
    destination: values.get("destination"),
    version: values.get("version") || "unknown",
    nativeSourceComplete: values.get("native-source-complete") === "true",
    report: values.get("report") || ""
  };
}

async function copySourceTree({
  source,
  destination,
  version,
  nativeSourceComplete,
  report = ""
}) {
  if (!source || !destination) throw new Error("source and destination are required");

  const sourceRoot = path.resolve(source);
  const destinationRoot = path.resolve(destination);
  if (sourceRoot === destinationRoot || inside(sourceRoot, destinationRoot)) {
    throw new Error("Snapshot destination must be outside the source tree");
  }

  const sourceStats = await fs.promises.stat(sourceRoot);
  if (!sourceStats.isDirectory()) throw new Error("Source path is not a directory");

  await fs.promises.rm(destinationRoot, { recursive: true, force: true });
  await fs.promises.mkdir(destinationRoot, { recursive: true });

  const summary = {
    version,
    source: sourceRoot,
    destination: destinationRoot,
    filesCopied: 0,
    bytesCopied: 0,
    directoriesCreated: 1,
    excludedDirectories: [],
    excludedFiles: [],
    skippedLinks: []
  };

  async function visit(currentSource, currentDestination, relativeDirectory) {
    const entries = await fs.promises.readdir(currentSource, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      const relative = relativeDirectory
        ? path.join(relativeDirectory, entry.name)
        : entry.name;
      const sourcePath = path.join(currentSource, entry.name);
      const destinationPath = path.join(currentDestination, entry.name);

      if (entry.isSymbolicLink()) {
        summary.skippedLinks.push(relative.replaceAll(path.sep, "/"));
        continue;
      }

      if (entry.isDirectory()) {
        if (excludedDirectory(entry.name)) {
          summary.excludedDirectories.push(relative.replaceAll(path.sep, "/"));
          continue;
        }
        await fs.promises.mkdir(destinationPath, { recursive: true });
        summary.directoriesCreated += 1;
        await visit(sourcePath, destinationPath, relative);
        continue;
      }

      if (!entry.isFile()) continue;
      if (excludedFile(entry.name)) {
        summary.excludedFiles.push(relative.replaceAll(path.sep, "/"));
        continue;
      }

      const stats = await fs.promises.stat(sourcePath);
      await fs.promises.copyFile(sourcePath, destinationPath);
      summary.filesCopied += 1;
      summary.bytesCopied += stats.size;
    }
  }

  await visit(sourceRoot, destinationRoot, "");

  const required = [
    "package.json",
    "package-lock.json",
    "LICENSE",
    "src/main.js",
    "renderer/out/index.html",
    "resources/resource-manifest.json"
  ];
  for (const relative of required) {
    const candidate = path.join(destinationRoot, ...relative.split("/"));
    const stats = await fs.promises.stat(candidate).catch(() => null);
    if (!stats?.isFile()) throw new Error(`Required snapshot file is missing: ${relative}`);
  }

  if (summary.filesCopied < 20 || summary.bytesCopied < 1024 * 1024) {
    throw new Error(
      `Snapshot is unexpectedly small: ${summary.filesCopied} files, ${summary.bytesCopied} bytes`
    );
  }

  const notice = `# Source completeness notice

This archive is an Avelune Enhance ${version} source snapshot.

Native engine corresponding source detected: ${nativeSourceComplete}

The packaged application contains resources/win/bin/avelune-engine.exe.
If Native engine corresponding source detected is False, this archive must
not be represented as complete AGPL Corresponding Source. Before public
distribution, add the exact source code and reproducible build instructions
for the distributed native engine, or document a legally valid independent
third-party component and its licence.

The AI model-weight licence and provenance must also remain documented in
MODEL_PROVENANCE.md and THIRD_PARTY_NOTICES.md.
`;
  await fs.promises.writeFile(
    path.join(destinationRoot, "SOURCE_COMPLETENESS_NOTICE.md"),
    notice,
    "utf8"
  );
  summary.filesCopied += 1;
  summary.bytesCopied += Buffer.byteLength(notice);

  const reportPath = report
    ? path.resolve(report)
    : path.join(path.dirname(destinationRoot), "source-staging-report.json");
  await fs.promises.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const summary = await copySourceTree(options);
  process.stdout.write(
    `[PASS] Source snapshot staged: ${summary.filesCopied} files, ${summary.bytesCopied} bytes.\n`
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[FAIL] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  copySourceTree,
  excludedDirectory,
  excludedFile,
  inside
};
