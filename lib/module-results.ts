import type { AnalysisJob, Finding, FindingSeverity, ModuleId } from "./workspace-model";
import { moduleById } from "./workspace-model";

export type ModuleResultState = "pending" | "recorded" | "empty";

export interface ModuleResultSummary {
  moduleId: ModuleId;
  moduleName: string;
  tint: string;
  state: ModuleResultState;
  findings: Finding[];
  findingCount: number;
  highestSeverity: FindingSeverity | null;
  detail: string;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { Critical: 5, High: 4, Medium: 3, Low: 2, Info: 1 };

function highestSeverity(findings: Finding[]): FindingSeverity | null {
  return findings.reduce<FindingSeverity | null>((highest, finding) => {
    if (!highest || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highest]) return finding.severity;
    return highest;
  }, null);
}

/** Build presentation summaries from verified, persisted findings only; never manufacture a scan result. */
export function summarizeModuleResults(job: AnalysisJob, findings: Finding[]): ModuleResultSummary[] {
  return job.modules.map((moduleId) => {
    const module = moduleById(moduleId);
    const moduleFindings = findings.filter((finding) => finding.jobId === job.id && finding.source === moduleId);
    const highest = highestSeverity(moduleFindings);

    if (job.state !== "Complete") {
      return {
        moduleId,
        moduleName: module.shortName,
        tint: module.tint,
        state: "pending",
        findings: moduleFindings,
        findingCount: moduleFindings.length,
        highestSeverity: highest,
        detail: "This record is not complete. Module results remain pending until the authorized run is completed and reviewed.",
      };
    }

    if (!moduleFindings.length) {
      return {
        moduleId,
        moduleName: module.shortName,
        tint: module.tint,
        state: "empty",
        findings: [],
        findingCount: 0,
        highestSeverity: null,
        detail: "No verified result has been recorded for this module. Record only observations confirmed in the authorized environment.",
      };
    }

    return {
      moduleId,
      moduleName: module.shortName,
      tint: module.tint,
      state: "recorded",
      findings: moduleFindings,
      findingCount: moduleFindings.length,
      highestSeverity: highest,
      detail: `${moduleFindings.length} verified finding${moduleFindings.length === 1 ? "" : "s"} recorded from this module.`,
    };
  });
}
