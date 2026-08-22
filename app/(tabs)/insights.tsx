import { router } from "expo-router";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, EmptyCard, LoadingView, PrimaryButton, QuietButton, SectionLabel, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { Finding, FindingSeverity, FINDING_SEVERITIES, formatDate, moduleById } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  Critical: "#F18A93",
  High:     "#F3B34C",
  Medium:   "#F7D87B",
  Low:      "#83D2C7",
  Info:     "#AAB7C5",
};
const SEVERITY_BG: Record<FindingSeverity, string> = {
  Critical: "#3A1018",
  High:     "#3A2408",
  Medium:   "#3A3008",
  Low:      "#0E2E2A",
  Info:     "#1A2430",
};

// ── Finding Detail bottom sheet ──────────────────────────────────────────────
function FindingDetailSheet({
  finding,
  jobRef,
  onClose,
  onDelete,
}: {
  finding: Finding;
  jobRef: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const module = moduleById(finding.source);
  const color = SEVERITY_COLOR[finding.severity];
  const bg = SEVERITY_BG[finding.severity];

  const confirmDelete = () => {
    Alert.alert(
      "Delete this insight?",
      "This removes the finding from local storage. The action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <View style={sheet.container}>
      <View style={sheet.handle} />

      <ScrollView contentContainerStyle={sheet.scroll} showsVerticalScrollIndicator={false}>
        {/* Severity badge */}
        <View style={[sheet.severityBadge, { backgroundColor: bg, borderColor: color + "55" }]}>
          <View style={[sheet.severityDot, { backgroundColor: color }]} />
          <Text style={[sheet.severityText, { color }]}>{finding.severity}</Text>
          <Text style={sheet.sourceText}>{module.shortName}</Text>
        </View>

        {/* Title */}
        <Text style={sheet.title}>{finding.title}</Text>

        {/* Detail */}
        {finding.detail ? (
          <Card style={sheet.detailCard}>
            <Text style={sheet.detailLabel}>DETAIL</Text>
            <Text style={sheet.detailText}>{finding.detail}</Text>
          </Card>
        ) : null}

        {/* Meta */}
        <Card style={sheet.metaCard}>
          <View style={sheet.metaRow}>
            <View style={sheet.metaItem}>
              <Text style={sheet.metaLabel}>SOURCE MODULE</Text>
              <Text style={sheet.metaValue}>{module.name}</Text>
            </View>
            <View style={sheet.metaItem}>
              <Text style={sheet.metaLabel}>RECORDED</Text>
              <Text style={sheet.metaValue}>{formatDate(finding.createdAt)}</Text>
            </View>
          </View>
          <View style={[sheet.metaRow, { marginTop: 12 }]}>
            <View style={sheet.metaItem}>
              <Text style={sheet.metaLabel}>ANALYSIS RECORD</Text>
              <Text style={sheet.metaValue} numberOfLines={2}>{jobRef}</Text>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <View style={sheet.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View analysis record"
            onPress={() => { onClose(); router.push({ pathname: "/analysis/[id]", params: { id: finding.jobId } }); }}
            style={({ pressed }) => [sheet.viewBtn, pressed && { opacity: 0.75 }]}>
            <IconSymbol name="doc.text" size={16} color={palette.teal} />
            <Text style={sheet.viewBtnText}>View analysis record</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete this insight"
            onPress={confirmDelete}
            style={({ pressed }) => [sheet.deleteBtn, pressed && { opacity: 0.75 }]}>
            <IconSymbol name="trash" size={16} color={palette.rose} />
            <Text style={sheet.deleteBtnText}>Delete insight</Text>
          </Pressable>
        </View>
      </ScrollView>

      <QuietButton label="Close" onPress={onClose} icon="xmark.circle" />
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const { ready, findings, jobs, deleteFinding } = useWorkspace();
  const [filter, setFilter] = useState<FindingSeverity | "All">("All");
  const [selected, setSelected] = useState<Finding | null>(null);

  const visible = useMemo(
    () => findings.filter((f) => filter === "All" || f.severity === filter),
    [filter, findings],
  );

  if (!ready) return <LoadingView />;

  const handleDelete = (id: string) => {
    setSelected(null);
    deleteFinding(id);
  };

  const selectedJob = selected ? jobs.find((j) => j.id === selected.jobId) : null;

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>LOCAL REVIEW NOTES</Text>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>
              Save confirmed observations from your authorized environment. This screen starts empty by design.
            </Text>
            <View style={styles.filterRow}>
              {(["All", ...FINDING_SEVERITIES] as const).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item }}
                  onPress={() => setFilter(item as FindingSeverity | "All")}
                  style={({ pressed }) => [
                    styles.filter,
                    filter === item && styles.filterSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.filterText, filter === item && styles.filterTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            {visible.length > 0 ? (
              <SectionLabel>{`${visible.length} saved insight${visible.length === 1 ? "" : "s"}`}</SectionLabel>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const module = moduleById(item.source);
          const job = jobs.find((j) => j.id === item.jobId);
          const color = SEVERITY_COLOR[item.severity];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open insight: ${item.title}`}
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.finding, pressed && styles.pressed]}>
              <View style={styles.findingTop}>
                <View style={[styles.severityChip, { backgroundColor: SEVERITY_BG[item.severity], borderColor: color + "55" }]}>
                  <View style={[styles.severityDot, { backgroundColor: color }]} />
                  <Text style={[styles.severity, { color }]}>{item.severity}</Text>
                </View>
                <Text style={styles.source}>{module.shortName}</Text>
              </View>
              <Text style={styles.findingTitle}>{item.title}</Text>
              {item.detail ? (
                <Text style={styles.findingDetail} numberOfLines={2}>{item.detail}</Text>
              ) : null}
              <View style={styles.findingFooter}>
                <Text style={styles.findingMeta}>{job?.reference ?? "Analysis record"} · {formatDate(item.createdAt)}</Text>
                <IconSymbol name="chevron.right" size={15} color={palette.muted} />
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyCard
            title={filter === "All" ? "No saved insights" : `No ${filter.toLowerCase()} insights`}
            detail={
              jobs.length
                ? "When you have an approved analysis record, add only observations you have verified."
                : "Prepare an authorized analysis record first, then capture confirmed observations from it."
            }
            action={
              <PrimaryButton
                label={jobs.length ? "Record insight" : "Prepare analysis"}
                onPress={() => router.push(jobs.length ? "/finding/new" : "/analysis/new")}
                icon={jobs.length ? "square.and.pencil" : "plus"}
              />
            }
          />
        }
      />

      {/* Finding Detail modal */}
      <Modal
        transparent
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          {selected ? (
            <FindingDetailSheet
              finding={selected}
              jobRef={selectedJob?.reference ?? "Analysis record"}
              onClose={() => setSelected(null)}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : null}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, backgroundColor: palette.base, flexGrow: 1 },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6, marginTop: 3 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 17 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 22 },
  filter: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  filterSelected: { borderColor: palette.teal, backgroundColor: palette.tealMuted },
  filterText: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  filterTextSelected: { color: palette.teal },
  pressed: { opacity: 0.72 },
  finding: { padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18 },
  findingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  severityChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severity: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  source: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  findingTitle: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: "800" },
  findingDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  findingFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 11 },
  findingMeta: { color: "#74869A", fontSize: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2, 7, 12, 0.78)" },
});

const sheet = StyleSheet.create({
  container: { backgroundColor: "#1A2431", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, gap: 14 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#607083", alignSelf: "center", marginTop: -8 },
  scroll: { gap: 14 },
  severityBadge: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  sourceText: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3 },
  detailCard: { backgroundColor: "#101C27", borderColor: "#1D3040", gap: 8 },
  detailLabel: { color: palette.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  detailText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  metaCard: { backgroundColor: "#101C27", borderColor: "#1D3040", gap: 0 },
  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flex: 1, gap: 4 },
  metaLabel: { color: palette.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  metaValue: { color: palette.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  actions: { gap: 10 },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#276572", backgroundColor: "#0F1E2E" },
  viewBtnText: { color: palette.teal, fontSize: 14, fontWeight: "800" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#5C1E27", backgroundColor: "#2A0F14" },
  deleteBtnText: { color: palette.rose, fontSize: 14, fontWeight: "800" },
});
