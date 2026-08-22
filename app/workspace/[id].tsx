import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, EmptyCard, LoadingView, ModulePill, PrimaryButton, QuietButton, SectionLabel, StatusPill, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { formatDate } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";
import { exportWorkspaceReportPdf } from "@/lib/pdf-export";

export default function WorkspaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, workspaces, jobs, findings, archiveWorkspace } = useWorkspace();
  const workspace = workspaces.find((w) => w.id === id);
  const workspaceJobs = jobs.filter((j) => j.workspaceId === id);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (!ready) return <LoadingView />;
  if (!workspace) return <MissingWorkspace />;

  const archive = () =>
    Alert.alert(
      "Archive workspace?",
      "Local records remain visible, but new analysis records will not be attached here.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: () => archiveWorkspace(workspace.id) },
      ],
    );

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      await exportWorkspaceReportPdf(workspace, workspaceJobs, findings);
      setExportMsg({ kind: "ok", text: "Workspace report exported — check your share sheet or downloads." });
    } catch {
      setExportMsg({ kind: "err", text: "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <FlatList
        data={workspaceJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Top bar */}
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <IconSymbol name="chevron.left" size={21} color={palette.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Archive workspace" onPress={archive}
                style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed]}>
                <IconSymbol name="archivebox" size={18} color={palette.muted} />
              </Pressable>
            </View>

            {/* Title */}
            <Text style={styles.eyebrow}>{workspace.status === "Active" ? "ACTIVE WORKSPACE" : "ARCHIVED WORKSPACE"}</Text>
            <Text style={styles.title}>{workspace.name}</Text>
            <Text style={styles.subtitle}>{workspace.targetType} · Created {formatDate(workspace.createdAt)}</Text>

            {/* Action area */}
            <View style={styles.actionArea}>
              {workspace.status === "Active" ? (
                <PrimaryButton label="Prepare analysis" onPress={() => router.push("/analysis/new")} icon="plus" />
              ) : (
                <Card>
                  <Text style={styles.cardTitle}>This workspace is archived</Text>
                  <Text style={styles.cardDetail}>Existing records are retained locally. Create or reopen an active workspace for new work.</Text>
                </Card>
              )}
            </View>

            {/* ── Export workspace report ─────────────────────────── */}
            <Card style={styles.exportCard}>
              <View style={styles.exportHeader}>
                <View style={styles.exportGlyph}>
                  <IconSymbol name="arrow.down.doc.fill" size={18} color={palette.teal} />
                </View>
                <View style={styles.exportCopy}>
                  <Text style={styles.cardTitle}>Export workspace report</Text>
                  <Text style={styles.cardDetail}>
                    Bundles all {workspaceJobs.length} analysis record{workspaceJobs.length === 1 ? "" : "s"} and their findings into a single PDF.
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
                    label="Export workspace PDF"
                    onPress={() => void handleExport()}
                    icon="arrow.down.doc.fill"
                    disabled={exporting || workspaceJobs.length === 0}
                  />
                )}
                {exportMsg ? (
                  <QuietButton label="Dismiss" onPress={() => setExportMsg(null)} icon="xmark.circle" />
                ) : null}
              </View>
            </Card>

            <SectionLabel>
              {workspaceJobs.length ? `${workspaceJobs.length} analysis record${workspaceJobs.length === 1 ? "" : "s"}` : "Analysis timeline"}
            </SectionLabel>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open analysis ${item.reference}`}
            onPress={() => router.push({ pathname: "/analysis/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.jobRow, pressed && styles.pressed]}>
            <View style={styles.jobBody}>
              <View style={styles.jobTop}>
                <Text style={styles.jobRef} numberOfLines={1}>{item.reference}</Text>
                <StatusPill state={item.state} />
              </View>
              <View style={styles.moduleRow}>
                {item.modules.map((mid) => <ModulePill key={mid} id={mid} />)}
              </View>
              <Text style={styles.jobDate}>Prepared {formatDate(item.createdAt)}</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={palette.muted} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyCard
            title="No analysis records"
            detail="Prepare a local handoff record when you are ready to coordinate an authorized review."
            action={workspace.status === "Active" ? (
              <PrimaryButton label="Prepare analysis" onPress={() => router.push("/analysis/new")} icon="plus" />
            ) : undefined}
          />
        }
      />
    </ScreenContainer>
  );
}

function MissingWorkspace() {
  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <View style={styles.missing}>
        <Text style={styles.title}>Workspace unavailable</Text>
        <Text style={styles.subtitle}>It may have been cleared from this device.</Text>
        <PrimaryButton label="View workspaces" onPress={() => router.replace("/workspaces")} icon="folder.fill" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34, backgroundColor: palette.base, flexGrow: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 17 },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  archiveButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 28, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: 3 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  actionArea: { marginTop: 19, marginBottom: 18 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  // Export card
  exportCard: { backgroundColor: "#0F1E2E", borderColor: "#1D3A4A", gap: 14, marginBottom: 20 },
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
  // Job list
  jobRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, borderColor: palette.border, borderWidth: 1, backgroundColor: palette.surface },
  jobBody: { flex: 1, gap: 8 },
  jobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  jobRef: { color: palette.text, fontSize: 15, fontWeight: "800", flex: 1 },
  moduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  jobDate: { color: palette.muted, fontSize: 12 },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
});
