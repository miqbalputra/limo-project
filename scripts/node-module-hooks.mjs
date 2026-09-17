import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = [".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"];

function resolveSourceFile(basePath) {
  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

// Scripts run outside the Next.js bundler, so the `server-only` marker package
// and the `@/` path alias must be resolved manually.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default undefined;", shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const resolved = resolveSourceFile(path.join(projectRoot, "src", specifier.slice(2)));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
