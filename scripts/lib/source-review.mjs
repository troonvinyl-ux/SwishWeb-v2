const WEB_REPOSITORY = 'troonvinyl-ux/SwishWeb-v2';
const SOURCE_REVIEWER = 'troonvinyl-ux';
function snapshot(source) {
  return JSON.stringify([source.repository, source.branch, source.commit, source.backendUrl,
    Object.entries(source.contracts ?? {}).sort(([left], [right]) => left.localeCompare(right)), source.review]);
}
/** Read-only GitHub verification. Local labels and URLs alone never approve a release. */
export async function verifySourceReview(source, readGithub) {
  const match = /^https:\/\/github\.com\/troonvinyl-ux\/SwishWeb-v2\/pull\/(\d+)$/.exec(source.review?.reviewUrl ?? '');
  if (source.review?.status !== 'approved' || !match) return ['Native baseline has no claimed review to verify.'];
  const pr = await readGithub(WEB_REPOSITORY, `pulls/${match[1]}`);
  if (!pr.merged || pr.base?.ref !== 'main' || pr.base?.repo?.full_name !== WEB_REPOSITORY || !/^[a-f0-9]{40}$/.test(pr.head?.sha ?? '')) return ['Baseline review must be a merged pull request into SwishWeb main.'];
  const reviews = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await readGithub(WEB_REPOSITORY, `pulls/${match[1]}/reviews?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) return ['GitHub did not return valid review records.'];
    reviews.push(...batch);
    if (batch.length < 100) break;
    if (page === 20) return ['Review history exceeded the audit limit; manual investigation is required.'];
  }
  const latest = new Map();
  // GitHub returns reviews chronologically; comments do not withdraw an approval.
  for (const review of reviews) if (review.user?.login && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) latest.set(review.user.login, review);
  const approval = latest.get(SOURCE_REVIEWER);
  if ([...latest.values()].some(review => review.state === 'CHANGES_REQUESTED')) return ['Baseline pull request still has a change-request review.'];
  if (approval?.state !== 'APPROVED' || approval.commit_id !== pr.head.sha || approval.user.login === pr.user?.login) return ['Owner approval of the latest baseline PR commit is required; self-review or stale approval is not accepted.'];
  const content = await readGithub(WEB_REPOSITORY, `contents/config/swish-source.json?ref=${pr.head.sha}`);
  if (content.encoding !== 'base64' || typeof content.content !== 'string') return ['Reviewed baseline file could not be verified.'];
  const reviewedSource = JSON.parse(Buffer.from(content.content, 'base64').toString('utf8'));
  if (snapshot(reviewedSource) !== snapshot(source)) return ['Current native baseline differs from the baseline in the approved PR.'];
  return [];
}
