#!/usr/bin/env node
// Read-only packaging check for the ORIGINAL SWISH checkout; never deploys or changes backend binding.
import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ENTRY = 'supabase/functions/swish-ebay-list/index.ts';
function localDependencies(source, filename) {
  const refs = new Set(), ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const add = value => { if (value && ts.isStringLiteralLike(value) && value.text.startsWith('.')) refs.add(value.text); };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast); return [...refs];
}

/** Validates every literal local import, re-export and dynamic import, including shared transitive files. */
export async function inspectEbayFunctionGraph(sourceRoot) {
  const root = resolve(sourceRoot), visited = new Set(), files = [], missing = [];
  const name = file => relative(root, file).split(sep).join('/');
  const pending = [{ file: resolve(root, ENTRY), importer: null, dependency: ENTRY }];
  while (pending.length) {
    const next = pending.pop();
    if (visited.has(next.file)) continue;
    visited.add(next.file);
    const rel = relative(root, next.file);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      missing.push({ importer: next.importer, dependency: next.dependency, reason: 'Outside source checkout' }); continue;
    }
    let source;
    try { source = await readFile(next.file, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      missing.push({ importer: next.importer, dependency: next.dependency, reason: 'Missing deployment dependency' }); continue;
    }
    files.push(name(next.file));
    for (const dependency of localDependencies(source, next.file)) {
      pending.push({ file: resolve(dirname(next.file), dependency), importer: name(next.file), dependency });
    }
  }
  return { ok: missing.length === 0, entry: ENTRY, files: files.sort(), missing };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/check-ebay-function-graph.mjs /path/to/original/SWISH');
    process.exitCode = 1;
  } else {
    const result = await inspectEbayFunctionGraph(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    console.error(result.ok
      ? 'Local source graph present. Also run deno cache in SWISH, package all reported files, and redeploy in the original SWISH Cloud project. This is not a deployment or live-health check.'
      : 'Restore missing files from the matching reviewed SWISH revision before packaging. No source or backend changes were made.');
  }
}
