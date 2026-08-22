import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, LoadingView, ModulePill, PrimaryButton, QuietButton, SectionLabel, StatusPill, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { WorkflowState, formatDate } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";
import { exportAnalysisReportPdf } from "@/lib/pdf-export";

const STATES: WorkflowState[] = ["Ready", "Review", "Complete", "Archived"];

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, jobs, workspaces, findings, updateJob, setJobState } = useWorkspace();
  const job = jobs.find((c) => c.id === id);
  const [summary, setSummary] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { if (job) setSummary(job.summary); }, [job]);

  if (!ready) return <LoadingView />;
  if (!job) return <MissingRecord />;

  const workspace = workspaces.find((c) => c.id === job.workspaceId);
  const jobFindings = findings.filter((f) => f.jobId === job.id);

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      await exportAnalysisReportPdf(job, workspace, jobFindings);
      setExportMsg({ kind: "ok", text: "Report exported — check your share sheet or downloads." });
    } catch {
      setExportMsg({ kind: "err", text: "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Top bar */}
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <IconSymbol name="chevron.left" size={21} color={palette.text} />
          </Pressable>
          <Text style={styles.topTitle}>Analysis record</Text>
          <StatusPill state={job.state} />
        </View>

        {/* Title block */}
        <Text style={styles.eyebrow}>LOCAL HANDOFF RECORD</Text>
        <Text style={styles.title}>{job.reference}</Text>
        <Text style={styles.subtitle}>
          {workspace?.name ?? "Saved workspace"} · {job.targetType} · Prepared {formatDate(job.createdAt)}
        </Text>

        {/* Authorization card */}
        <Card style={styles.authorizationCard}>
          <View style={styles.authorizationIcon}>
            <IconSymbol name="checkmark.shield" size={18} color={palette.teal} />
          </View>
          <View style={styles.authorizationText}>
            <Text style={styles.cardTitle}>Authorization recorded</Text>
            <Text style={styles.cardDetail}>
              Acknowledged {formatDate(job.authorizedAt)}. This record did not send a remote command.
            </Text>
          </View>
        </Card>

        {/* Modules */}
        <View style={styles.block}>
          <SectionLabel>Selected modules</SectionLabel>
          <View style={styles.moduleRow}>
            {job.modules.map((mid) => <ModulePill key={mid} id={mid} />)}
          </View>
        </View>

        <View style={styles.block}>
          <SectionLabel>Run selected modules</SectionLabel>
          <Card style={styles.runCard}>
            <View style={styles.runHeader}>
              <View style={styles.runGlyph}><IconSymbol name="play.fill" size={18} color="#74D6A1" /></View>
              <View style={styles.runCopy}>
                <Text style={styles.cardTitle}>Guarded test run</Text>
                <Text style={styles.cardDetail}>
                  Send only this record&apos;s {job.modules.length} selected module{job.modules.length === 1 ? "" : "s"} and approved target reference to your private gateway.
                </Text>
              </View>
            </View>
            <Text style={styles.runNote}>The mobile app does not execute privileged tools directly. Gateway approval is still required before a test starts.</Text>
            <PrimaryButton
              label={job.state === "Ready" ? "Run selected modules" : "Set state to Ready to run"}
              onPress={() => router.push({ pathname: "/(tabs)/gateway", params: { runJobId: job.id } })}
              icon="play.fill"
              disabled={job.state !== "Ready"}
            />
          </Card>
        </View>

        {job.state === "Complete" ? (
          <View style={styles.block}>
            <SectionLabel>Completed scan</SectionLabel>
            <Card style={styles.resultsCard}>
              <View style={styles.runHeader}>
                <View style={styles.resultsGlyph}><IconSymbol name="checkmark.circle.fill" size={18} color={palette.teal} /></View>
                <View style={styles.runCopy}>
                  <Text style={styles.cardTitle}>Module result summaries</Text>
                  <Text style={styles.cardDetail}>Review recorded findings and explicit no-result states for every module selected in this completed scan.</Text>
                </View>
              </View>
              <PrimaryButton label="View module results" onPress={() => router.push({ pathname: "/module-results", params: { jobId: job.id } })} icon="chevron.right" />
            </Card>
          </View>
        ) : null}

        {/* Workflow state */}
        <View style={styles.block}>
          <SectionLabel>Workflow state</SectionLabel>
          <View style={styles.stateWrap}>
            {STATES.map((state) => (
              <Pressable key={state} accessibilityRole="button"
                accessibilityState={{ selected: job.state === state }}
                onPress={() => setJobState(job.id, state)}
                style={({ pressed }) => [
                  styles.stateChoice,
                  job.state === state && styles.stateSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.stateText, job.state === state && styles.stateTextSelected]}>
                  {state}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.block}>
          <SectionLabel>Reviewer summary</SectionLabel>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Record a concise, verified summary after reviewing approved results."
            placeholderTextColor="#718399"
            multiline
            textAlignVertical="top"
            style={styles.summaryInput}
          />
          <PrimaryButton label="Save summary" onPress={() => updateJob(job.id, { summary: summary.trim() })} icon="checkmark.circle.fill" />
        </View>

        {/* Findings */}
        <View style={styles.block}>
          <SectionLabel>Insights</SectionLabel>
          <Card>
            <Text style={styles.cardTitle}>
              {jobFindings.length
                ? `${jobFindings.length} verified insight${jobFindings.length === 1 ? "" : "s"} saved`
                : "No saved insights yet"}
            </Text>
            <Text style={styles.cardDetail}>
              {jobFindings.length
                ? "Open Insights to review all observations across workspaces."
                : "Add only a confirmed observation from your authorized analysis environment."}
            </Text>
            <View style={styles.cardAction}>
              <PrimaryButton label="Record insight"
                onPress={() => router.push({ pathname: "/finding/new", params: { jobId: job.id } })}
                icon="square.and.pencil" />
            </View>
          </Card>
        </View>

        {/* ── PDF Export ─────────────────────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Export</SectionLabel>
          <Card style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportGlyph}>
                <IconSymbol name="arrow.down.doc.fill" size={18} color={palette.teal} />
              </View>
              <View style={styles.exportCopy}>
                <Text style={styles.cardTitle}>PDF report</Text>
                <Text style={styles.cardDetail}>
                  Export this analysis record, its selected modules, reviewer summary, and all
                  {jobFindings.length > 0 ? ` ${jobFindings.length} saved insight${jobFindings.length === 1 ? "" : "s"}` : " insights"} as a
                  shareable PDF.
                </Text>
              </View>
            </View>

            {exportMsg ? (
              <View style={[styles.exportMsg, exportMsg.kind === "ok" ? styles.exportMsgOk : styles.exportMsgErr]}>
                <IconSymbol
                  name={exportMsg.kind === "ok" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
                  size={15}
                  color={exportMsg.kind === "ok" ? "#74D6A1" : palette.rose}
                />
                <Text style={[styles.exportMsgText, { color: exportMsg.kind === "ok" ? "#74D6A1" : palette.rose }]}>
                  {exportMsg.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.exportActions}>
              {exporting ? (
                <View style={styles.exportingRow}>
                  <ActivityIndicator size="small" color={palette.teal} />
                  <Text style={styles.exportingText}>Generating PDF…</Text>
                </View>
              ) : (
                <PrimaryButton
                  label="Export PDF report"
                  onPress={() => void handleExport()}
                  icon="arrow.down.doc.fill"
                  disabled={exporting}
                />
              )}
              {exportMsg ? (
                <QuietButton label="Dismiss" onPress={() => setExportMsg(null)} icon="xmark.circle" />
              ) : null}
            </View>
          </Card>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

function MissingRecord() {
  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <View style={styles.missing}>
        <Text style={styles.title}>Record unavailable</Text>
        <Text style={styles.subtitle}>It may have been cleared from this device.</Text>
        <PrimaryButton label="Return to deck" onPress={() => router.replace("/")} icon="house.fill" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: palette.base, padding: 20, paddingBottom: 36, gap: 18 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 4 },
  title: { color: palette.text, fontSize: 28, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -11 },
  authorizationCard: { flexDirection: "row", gap: 11, backgroundColor: "#142833", borderColor: "#214A53" },
  authorizationIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  authorizationText: { flex: 1 },
  runCard: { gap: 12, backgroundColor: "#10251F", borderColor: "#1E5C3A" },
  runHeader: { flexDirection: "row", gap: 11 },
  runGlyph: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#153A28" },
  runCopy: { flex: 1 },
  runNote: { color: "#A5CDB5", fontSize: 12, lineHeight: 17 },
  resultsCard: { gap: 12, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" },
  resultsGlyph: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  block: { gap: 10 },
  moduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stateWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stateChoice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  stateSelected: { borderColor: palette.teal, backgroundColor: palette.tealMuted },
  stateText: { color: palette.muted, fontSize: 13, fontWeight: "800" },
  stateTextSelected: { color: palette.teal },
  summaryInput: { minHeight: 118, color: palette.text, fontSize: 14, lineHeight: 20, padding: 14, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 16 },
  cardAction: { marginTop: 15 },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  // Export card
  exportCard: { gap: 14, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" },
  exportHeader: { flexDirection: "row", gap: 12 },
  exportGlyph: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  exportCopy: { flex: 1 },
  exportMsg: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderRadius: 11, borderWidth: 1 },
  exportMsgOk: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A" },
  exportMsgErr: { backgroundColor: "#2A0F14", borderColor: "#5C1E27" },
  exportMsgText: { fontSize: 13, lineHeight: 18, flex: 1 },
  exportActions: { gap: 10 },
  exportingRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, justifyContent: "center" },
  exportingText: { color: palette.muted, fontSize: 15, fontWeight: "700" },
});
