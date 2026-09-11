export type ContinuityRule = {
  id: string;
  description: string;
  appliesTo: (shotNumber: number) => boolean;
  validate: (context: Record<string, unknown>) => boolean;
};

export type ContinuityResult = {
  passed: boolean;
  violations: string[];
};

export function checkContinuity(
  shotNumber: number,
  context: Record<string, unknown>,
  rules: ContinuityRule[],
): ContinuityResult {
  const violations = rules
    .filter((rule) => rule.appliesTo(shotNumber))
    .filter((rule) => !rule.validate(context))
    .map((rule) => rule.description);

  return { passed: violations.length === 0, violations };
}
