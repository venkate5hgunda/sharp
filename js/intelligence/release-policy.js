import { checkModelReport } from './evaluation-quality.js';
import { checkCoachEvaluation } from './coach-evaluation.js';
// Development commits validate code without hardware. Enabling either qualification
// or public inference requires current, full, real-model evidence on every machine.
export function checkReleasePolicy({ inferenceEnabled, qualified, report, inputs, requireQualification = false }) {
  if (inferenceEnabled && !qualified) throw new Error('Release blocked: public inference requires a qualified model profile.');
  if (requireQualification && !qualified) throw new Error('Release blocked: model profile is not qualified.');
  if (!inferenceEnabled && !qualified && !requireQualification) return { evidenceRequired: false, status: 'disabled-unqualified' };
  const arithmetic = checkModelReport(report, inputs);
  const coach = checkCoachEvaluation(report.coachEvaluation);
  return { evidenceRequired: true, status: 'evidence-verified', arithmetic, coach };
}
