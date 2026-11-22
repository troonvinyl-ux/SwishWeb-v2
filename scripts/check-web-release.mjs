import { readFile, appendFile, writeFile, mkdir } from 'node:fs/promises';
import { EVIDENCE_PATH, validateSource, validateEvidence, webSourceDigest, github } from './lib/swish-contracts.mjs';
import { verifySourceReview } from './lib/source-review.mjs';
const source = JSON.parse(await readFile('config/swish-source.json', 'utf8'));
validateSource(source);
const evidence = JSON.parse(await readFile(EVIDENCE_PATH, 'utf8'));
const digest = await webSourceDigest();
const failures = validateEvidence(evidence, source, digest);
// A claimed approval and a plausible-looking PR URL are not sufficient.
// Verify GitHub's merged PR, latest-commit non-author owner approval, and the
// exact source-pin snapshot. This protects the production release boundary.
const readWebReview = async (repository, path) => {
  if (repository !== 'troonvinyl-ux/SwishWeb-v2') throw new Error('Unexpected source-review repository.');
  const token = process.env.SWISH_WEB_REVIEW_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Read-only web PR review token is unavailable.');
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Web owner review could not be verified (GitHub HTTP ${response.status}).`);
  return response.json();
};
try {
  failures.push(...await verifySourceReview(source, readWebReview));
} catch (error) {
  failures.push(error instanceof Error ? error.message : 'Web source review could not be verified.');
}
// Publishing requires exact head alignment, even if unrelated changes were made.
const native = await github('commits/main');
if (native.sha !== source.commit) failures.push('Native main has advanced. Review and update the baseline before producing a release candidate.');
const report = { domain: 'swishflip.co.uk', nativeCommit: source.commit, webSourceDigest: digest, checkedAt: new Date().toISOString(), failures, candidateEligible: failures.length === 0, deployed: false };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/web-release-report.json', JSON.stringify(report, null, 2) + '\n');
const summary = `## SWISH web release evidence\nSource digest: ${digest}\n${failures.length ? failures.map(message => `- BLOCKED: ${message}`).join('\n') : 'Evidence checks passed. Protected environment approval is still required; this job does not publish.'}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
if (failures.length) process.exitCode = 1;
