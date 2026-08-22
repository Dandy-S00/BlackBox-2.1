import { describe, expect, it } from "vitest";
import { summarizeModuleResults } from "../lib/module-results";
import type { AnalysisJob, Finding } from "../lib/workspace-model";

const completedJob: AnalysisJob = { id: "analysis-1", workspaceId: "workspace-1", reference: "sample.apk", targetType: "Mobile package", modules: ["mobsf", "frida"], state: "Complete", authorizedAt: "2026-08-20T10:00:00.000Z", createdAt: "2026-08-20T10:00:00.000Z", summary: "Reviewed", gatewayStatus: "Accepted" };
const findings: Finding[] = [
  { id: "finding-1", jobId: "analysis-1", source: "mobsf", severity: "Low", title: "Low finding", detail: "Details", createdAt: "2026-08-20T11:00:00.000Z" },
  { id: "finding-2", jobId: "analysis-1", source: "mobsf", severity: "High", title: "High finding", detail: "Details", createdAt: "2026-08-20T11:10:00.000Z" },
];

describe("module result summaries", () => {
  it("groups persisted findings by each selected module and reports the highest severity", () => {
    const results = summarizeModuleResults(completedJob, findings);
    expect(results[0]).toMatchObject({ moduleId: "mobsf", state: "recorded", findingCount: 2, highestSeverity: "High" });
    expect(results[1]).toMatchObject({ moduleId: "frida", state: "empty", findingCount: 0, highestSeverity: null });
  });

  it("keeps all selected module results pending until the record is complete", () => {
    const results = summarizeModuleResults({ ...completedJob, state: "Review" }, findings);
    expect(results.map((result) => result.state)).toEqual(["pending", "pending"]);
  });
});
