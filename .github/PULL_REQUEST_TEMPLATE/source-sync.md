## SWISH source update review

Native commit: <!-- full 40-character SHA -->
Native compare: <!-- URL from artifacts/swish-source-review.md -->
Web impact report: <!-- CI run/artifact URL -->

### Authority
- [ ] Existing SWISH backend identity is unchanged; no new Cloud, accounts, Stripe products or eBay application.
- [ ] `config/swish-source.json` records the exact inspected source with all required contract roots.
- [ ] The review URL points to this PR; `approved` is only a claim until GitHub confirms a non-author owner review of the final commit and merge to main.

### Changed workflows
<!-- List each affected workflow from the source impact report, web implementation and regression evidence. Do not equate an unchanged route with parity. -->

| Workflow | Native change | Web change or documented exclusion | Tests/evidence |
|---|---|---|---|
| | | | |

- [ ] Tenant/niche scope, error handling, persistence and reopen behavior reviewed for affected workflows.
- [ ] Mutations are never replayed automatically after an uncertain result.
- [ ] Native and web applicable regressions checked against the same approved backend.
- [ ] Source access/truncation errors and any remaining parity gaps remain visible.
- [ ] Build/typecheck/lint results attached; no live results fabricated.
- [ ] Release evidence regenerated for the exact candidate digest; publishing remains a separate protected approval.

### Known gaps / operator actions
<!-- Backend binding, Stripe HTTPS returns, branch rules and production environment protection are not established by committing these files. -->
