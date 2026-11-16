import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { github, contractDrift, validateSource, webSourceDigest } from './lib/swish-contracts.mjs';
import { workflowImpact, impactMarkdown } from './lib/source-impact.mjs';
const source = JSON.parse(await readFile('config/swish-source.json', 'utf8'));
validateSource(source);
const args = process.argv.slice(2);
const recordIndex = args.indexOf('--record');
if (recordIndex !== -1) {
  const sha = args[recordIndex + 1];
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Recording requires an explicit full native commit SHA.');
  const candidate = await github(`commits/${sha}`);
  if (candidate.sha !== sha) throw new Error('GitHub did not resolve the exact requested commit.');
  const tree = await github(`git/trees/${candidate.commit.tree.sha}`);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete source tree.');
  source.commit = candidate.sha;
  source.inspectedAt = new Date().toISOString().slice(0, 10);
  source.review = { status: 'pending', reviewUrl: null };
  for (const path of Object.keys(source.contracts)) {
    const entry = tree.tree.find(item => item.path === path);
    if (!entry) throw new Error(`Contract removed: ${path}. Review the contract map explicitly.`);
    source.contracts[path] = entry.sha;
  }
  validateSource(source);
  await writeFile('config/swish-source.json', JSON.stringify(source, null, 2) + '\n');
  console.log('Recorded pending source candidate. Human workflow impact review is required; nothing was merged, deployed or approved.');
} else {
  const pinned = await github(`commits/${source.commit}`);
  const pinnedTree = await github(`git/trees/${pinned.commit.tree.sha}`);
  if (pinnedTree.truncated || !Array.isArray(pinnedTree.tree) || contractDrift(source.contracts, pinnedTree.tree).length) throw new Error('Source baseline does not match its pinned native commit.');
  const latest = await github(`commits/${source.branch}`);
  const latestTree = await github(`git/trees/${latest.commit.tree.sha}`);
  if (latestTree.truncated || !Array.isArray(latestTree.tree)) throw new Error('Incomplete latest source tree.');
  const advanced = latest.sha !== source.commit;
  const comparison = advanced ? await github(`compare/${source.commit}...${latest.sha}`) : { files: [], total_commits: 0 };
  const files = Array.isArray(comparison.files) ? comparison.files.map(file => ({ filename: file.filename, status: file.status, previous_filename: file.previous_filename })) : [];
  const drift = contractDrift(source.contracts, latestTree.tree);
  const report = { repository: source.repository, pinnedCommit: source.commit, latestCommit: latest.sha, checkedAt: new Date().toISOString(), compareUrl: `https://github.com/${source.repository}/compare/${source.commit}...${latest.sha}`, advanced, drift, files, fileListingMayBeTruncated: files.length >= 300 || !Array.isArray(comparison.files), impacts: workflowImpact(drift, files), releaseApproved: false };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/swish-source-report.json', JSON.stringify(report, null, 2) + '\n');
  const summary = impactMarkdown(report) + (advanced ? '\nBLOCKED: Native main has advanced. Review its workflow impact and record a pending candidate; do not auto-approve the pin.\n' : '\nSource is aligned. Live acceptance and reviewed release approval remain separate.\n');
  await writeFile('artifacts/swish-source-review.md', summary);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (args.includes('--digest')) console.log(`Web source digest: ${await webSourceDigest()}`);
  if (advanced || drift.length) process.exitCode = 1;
}
