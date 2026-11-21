export interface VerificationResult { passed: boolean; failures: string[]; warnings: string[]; human?: boolean; }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
/** Native swish-verify returns both top-level and nested verification formats. Warnings stay advisory. */
export function parseListingVerification(value: unknown): VerificationResult {
  const result = object(value), nested = object(result.verification);
  const failures = strings(result.failure_reasons ?? nested.failure_reasons);
  const verdict = typeof result.passed === 'boolean' ? result.passed : nested.overall_passed ?? result.overall_passed;
  return { passed: verdict === true && failures.length === 0, failures, warnings: strings(result.warnings ?? nested.warnings), human: result.override === true || nested.verified_by === 'human' };
}
