import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { AnalysisJob, Finding, Workspace } from "@/lib/workspace-model";
import { moduleById, formatDate } from "@/lib/workspace-model";

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#E36D77",
  High:     "#F3B34C",
  Medium:   "#FBBF24",
  Low:      "#7DD3FC",
  Info:     "#94A4B5",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(
  job: AnalysisJob,
  workspace: Workspace | undefined,
  findings: Finding[],
): string {
  const modulesHtml = job.modules
    .map((id) => {
      const m = moduleById(id);
      return `<span class="pill" style="border-color:${m.tint};color:${m.tint}">${escapeHtml(m.shortName)}</span>`;
    })
    .join(" ");

  const findingsHtml = findings.length
    ? findings
        .map((f) => {
          const color = SEVERITY_COLOR[f.severity] ?? "#94A4B5";
          return `
          <div class="finding">
            <div class="finding-header">
              <span class="severity-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${escapeHtml(f.severity)}</span>
              <span class="finding-source">${escapeHtml(moduleById(f.source).shortName)}</span>
              <span class="finding-date">${escapeHtml(formatDate(f.createdAt))}</span>
            </div>
            <div class="finding-title">${escapeHtml(f.title)}</div>
            ${f.detail ? `<div class="finding-detail">${escapeHtml(f.detail)}</div>` : ""}
          </div>`;
        })
        .join("\n")
    : `<p class="empty-note">No findings were recorded for this analysis record.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BlackBox Analysis Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #101620; color: #F4F7FA; padding: 40px 36px; }
  .header { border-bottom: 1px solid #2A3A4C; padding-bottom: 24px; margin-bottom: 28px; }
  .brand { color: #2AD4C4; font-size: 11px; font-weight: 800; letter-spacing: 1.4px;
           text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 28px; font-weight: 800; line-height: 1.25; letter-spacing: -0.5px; }
  .meta { color: #94A4B5; font-size: 13px; margin-top: 8px; line-height: 1.6; }
  .section { margin-bottom: 28px; }
  .section-label { color: #94A4B5; font-size: 11px; font-weight: 700; letter-spacing: 1.1px;
                   text-transform: uppercase; margin-bottom: 12px; }
  .card { background: #18212E; border: 1px solid #2A3A4C; border-radius: 14px; padding: 16px; }
  .auth-card { background: #142833; border-color: #214A53; }
  .auth-row { display: flex; align-items: center; gap: 10px; }
  .auth-icon { color: #2AD4C4; font-size: 18px; }
  .auth-title { font-size: 14px; font-weight: 800; }
  .auth-detail { color: #94A4B5; font-size: 12px; margin-top: 4px; line-height: 1.5; }
  .pill { display: inline-block; border: 1px solid; border-radius: 999px;
          padding: 4px 10px; font-size: 12px; font-weight: 700; margin: 2px; }
  .summary-box { background: #18212E; border: 1px solid #2A3A4C; border-radius: 12px;
                 padding: 14px; font-size: 14px; line-height: 1.65; color: #C8D6E5;
                 white-space: pre-wrap; }
  .finding { background: #18212E; border: 1px solid #2A3A4C; border-radius: 12px;
             padding: 14px; margin-bottom: 10px; }
  .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
                    flex-wrap: wrap; }
  .severity-badge { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
  .finding-source { color: #94A4B5; font-size: 11px; font-weight: 700; }
  .finding-date { color: #94A4B5; font-size: 11px; margin-left: auto; }
  .finding-title { font-size: 14px; font-weight: 800; line-height: 1.4; }
  .finding-detail { color: #94A4B5; font-size: 13px; line-height: 1.6; margin-top: 6px; }
  .empty-note { color: #94A4B5; font-size: 14px; font-style: italic; }
  .footer { border-top: 1px solid #2A3A4C; margin-top: 36px; padding-top: 16px;
            color: #94A4B5; font-size: 11px; line-height: 1.6; }
  .state-badge { display: inline-block; padding: 4px 12px; border-radius: 999px;
                 font-size: 12px; font-weight: 800; background: #173F40; color: #69E6D9; }
</style>
</head>
<body>
<div class="header">
  <div class="brand">BlackBox · Analysis Report</div>
  <h1>${escapeHtml(job.reference)}</h1>
  <div class="meta">
    Workspace: ${escapeHtml(workspace?.name ?? "Unknown workspace")} &nbsp;·&nbsp;
    Target: ${escapeHtml(job.targetType)} &nbsp;·&nbsp;
    Prepared: ${escapeHtml(formatDate(job.createdAt))}<br/>
    State: <span class="state-badge">${escapeHtml(job.state)}</span>
    ${job.dispatchedAt ? `&nbsp;·&nbsp; Dispatched: ${escapeHtml(formatDate(job.dispatchedAt))}` : ""}
    ${job.gatewayReceiptId ? `&nbsp;·&nbsp; Receipt: ${escapeHtml(job.gatewayReceiptId)}` : ""}
  </div>
</div>

<div class="section">
  <div class="section-label">Authorization</div>
  <div class="card auth-card">
    <div class="auth-row">
      <span class="auth-icon">✓</span>
      <div>
        <div class="auth-title">Authorization recorded</div>
        <div class="auth-detail">Acknowledged ${escapeHtml(formatDate(job.authorizedAt))}. This record did not send a remote command.</div>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-label">Selected modules</div>
  <div>${modulesHtml}</div>
</div>

${
  job.summary
    ? `<div class="section">
  <div class="section-label">Reviewer summary</div>
  <div class="summary-box">${escapeHtml(job.summary)}</div>
</div>`
    : ""
}

<div class="section">
  <div class="section-label">Findings (${findings.length})</div>
  ${findingsHtml}
</div>

<div class="footer">
  Generated by BlackBox on ${new Date().toLocaleString()} &nbsp;·&nbsp;
  This report contains locally recorded data only. No remote analysis results are included.
</div>
</body>
</html>`;
}

// ── Workspace-level multi-job PDF export ─────────────────────────────────────

function buildWorkspaceHtml(
  workspace: Workspace,
  jobs: AnalysisJob[],
  allFindings: Finding[],
): string {
  const totalFindings = allFindings.filter((f) => jobs.some((j) => j.id === f.jobId)).length;

  const jobSections = jobs
    .map((job) => {
      const jobFindings = allFindings.filter((f) => f.jobId === job.id);
      const modulesHtml = job.modules
        .map((id) => {
          const m = moduleById(id);
          return `<span class="pill" style="border-color:${m.tint};color:${m.tint}">${escapeHtml(m.shortName)}</span>`;
        })
        .join(" ");

      const findingsHtml = jobFindings.length
        ? jobFindings
            .map((f) => {
              const color = SEVERITY_COLOR[f.severity] ?? "#94A4B5";
              return `
              <div class="finding">
                <div class="finding-header">
                  <span class="severity-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${escapeHtml(f.severity)}</span>
                  <span class="finding-source">${escapeHtml(moduleById(f.source).shortName)}</span>
                  <span class="finding-date">${escapeHtml(formatDate(f.createdAt))}</span>
                </div>
                <div class="finding-title">${escapeHtml(f.title)}</div>
                ${f.detail ? `<div class="finding-detail">${escapeHtml(f.detail)}</div>` : ""}
              </div>`;
            })
            .join("\n")
        : `<p class="empty-note">No findings recorded for this analysis record.</p>`;

      return `
      <div class="job-section">
        <div class="job-header">
          <div class="job-ref">${escapeHtml(job.reference)}</div>
          <span class="state-badge">${escapeHtml(job.state)}</span>
        </div>
        <div class="job-meta">
          ${escapeHtml(job.targetType)} &nbsp;·&nbsp; Prepared ${escapeHtml(formatDate(job.createdAt))}
          ${job.dispatchedAt ? ` &nbsp;·&nbsp; Dispatched ${escapeHtml(formatDate(job.dispatchedAt))}` : ""}
        </div>
        <div class="modules-row">${modulesHtml}</div>
        ${job.summary ? `<div class="summary-box">${escapeHtml(job.summary)}</div>` : ""}
        <div class="findings-label">Findings (${jobFindings.length})</div>
        ${findingsHtml}
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BlackBox Workspace Report — ${escapeHtml(workspace.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #101620; color: #F4F7FA; padding: 40px 36px; }
  .header { border-bottom: 1px solid #2A3A4C; padding-bottom: 24px; margin-bottom: 28px; }
  .brand { color: #2AD4C4; font-size: 11px; font-weight: 800; letter-spacing: 1.4px;
           text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 28px; font-weight: 800; line-height: 1.25; letter-spacing: -0.5px; }
  .meta { color: #94A4B5; font-size: 13px; margin-top: 8px; line-height: 1.6; }
  .toc { background: #18212E; border: 1px solid #2A3A4C; border-radius: 14px; padding: 16px;
         margin-bottom: 28px; }
  .toc-title { color: #94A4B5; font-size: 11px; font-weight: 700; letter-spacing: 1.1px;
               text-transform: uppercase; margin-bottom: 10px; }
  .toc-row { display: flex; justify-content: space-between; align-items: center;
             padding: 6px 0; border-bottom: 1px solid #1E2C3A; font-size: 13px; }
  .toc-row:last-child { border-bottom: none; }
  .toc-ref { color: #F4F7FA; font-weight: 700; }
  .toc-state { color: #69E6D9; font-size: 11px; font-weight: 800;
               background: #173F40; padding: 3px 9px; border-radius: 999px; }
  .job-section { margin-bottom: 36px; padding-bottom: 28px;
                 border-bottom: 1px solid #2A3A4C; }
  .job-header { display: flex; align-items: center; justify-content: space-between;
                gap: 12px; margin-bottom: 6px; }
  .job-ref { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
  .job-meta { color: #94A4B5; font-size: 13px; margin-bottom: 10px; }
  .modules-row { margin-bottom: 12px; }
  .pill { display: inline-block; border: 1px solid; border-radius: 999px;
          padding: 4px 10px; font-size: 12px; font-weight: 700; margin: 2px; }
  .summary-box { background: #18212E; border: 1px solid #2A3A4C; border-radius: 12px;
                 padding: 14px; font-size: 14px; line-height: 1.65; color: #C8D6E5;
                 white-space: pre-wrap; margin-bottom: 12px; }
  .findings-label { color: #94A4B5; font-size: 11px; font-weight: 700; letter-spacing: 1.1px;
                    text-transform: uppercase; margin-bottom: 8px; }
  .finding { background: #18212E; border: 1px solid #2A3A4C; border-radius: 12px;
             padding: 14px; margin-bottom: 8px; }
  .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
                    flex-wrap: wrap; }
  .severity-badge { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
  .finding-source { color: #94A4B5; font-size: 11px; font-weight: 700; }
  .finding-date { color: #94A4B5; font-size: 11px; margin-left: auto; }
  .finding-title { font-size: 14px; font-weight: 800; line-height: 1.4; }
  .finding-detail { color: #94A4B5; font-size: 13px; line-height: 1.6; margin-top: 6px; }
  .state-badge { display: inline-block; padding: 4px 12px; border-radius: 999px;
                 font-size: 12px; font-weight: 800; background: #173F40; color: #69E6D9; }
  .empty-note { color: #94A4B5; font-size: 13px; font-style: italic; }
  .footer { border-top: 1px solid #2A3A4C; margin-top: 28px; padding-top: 16px;
            color: #94A4B5; font-size: 11px; line-height: 1.6; }
</style>
</head>
<body>
<div class="header">
  <div class="brand">BlackBox · Workspace Report</div>
  <h1>${escapeHtml(workspace.name)}</h1>
  <div class="meta">
    Target type: ${escapeHtml(workspace.targetType)} &nbsp;·&nbsp;
    Created: ${escapeHtml(formatDate(workspace.createdAt))} &nbsp;·&nbsp;
    Status: ${escapeHtml(workspace.status)}<br/>
    ${jobs.length} analysis record${jobs.length === 1 ? "" : "s"} &nbsp;·&nbsp; ${totalFindings} total finding${totalFindings === 1 ? "" : "s"}
  </div>
</div>

<div class="toc">
  <div class="toc-title">Analysis records in this report</div>
  ${jobs.map((j) => `<div class="toc-row"><span class="toc-ref">${escapeHtml(j.reference)}</span><span class="toc-state">${escapeHtml(j.state)}</span></div>`).join("\n")}
</div>

${jobSections}

<div class="footer">
  Generated by BlackBox on ${new Date().toLocaleString()} &nbsp;·&nbsp;
  This report contains locally recorded data only. No remote analysis results are included.
</div>
</body>
</html>`;
}

export async function exportWorkspaceReportPdf(
  workspace: Workspace,
  jobs: AnalysisJob[],
  allFindings: Finding[],
): Promise<void> {
  const html = buildWorkspaceHtml(workspace, jobs, allFindings);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (Platform.OS === "web") {
    const win = globalThis.window?.open(uri, "_blank");
    if (!win) {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blackbox-workspace-${workspace.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `BlackBox workspace report — ${workspace.name}`,
      UTI: "com.adobe.pdf",
    });
  }
}

export async function exportAnalysisReportPdf(
  job: AnalysisJob,
  workspace: Workspace | undefined,
  findings: Finding[],
): Promise<void> {
  const html = buildHtml(job, workspace, findings);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (Platform.OS === "web") {
    // On web, open the PDF in a new tab
    const win = globalThis.window?.open(uri, "_blank");
    if (!win) {
      // Fallback: trigger download via blob
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blackbox-${job.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `BlackBox report — ${job.reference}`,
      UTI: "com.adobe.pdf",
    });
  }
}
