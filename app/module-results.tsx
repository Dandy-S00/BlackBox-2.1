import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, LoadingView, PrimaryButton, QuietButton, SectionLabel, StatusPill, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { summarizeModuleResults, type ModuleResultState } from "@/lib/module-results";
import { formatDate } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";

function stateCopy(state: ModuleResultState) {
  if (state === "recorded") return { label: "Recorded", color: "#74D6A1" };
  if (state === "empty") return { label: "No recorded result", color: palette.amber };
  return { label: "Pending", color: "#718399" };
}

export default function ModuleResultsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { ready, jobs, findings } = useWorkspace();
  const job = jobs.find((candidate) => candidate.id === jobId);

  if (!ready) return <LoadingView />;
  if (!job) {
    return <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]"><View style={styles.missing}><Text style={styles.title}>Results unavailable</Text><Text style={styles.subtitle}>This analysis record is no longer on this device.</Text><PrimaryButton label="Return to deck" onPress={() => router.replace("/(tabs)")} icon="house.fill" /></View></ScreenContainer>;
  }

  const summaries = summarizeModuleResults(job, findings);
  const recordedCount = summaries.filter((summary) => summary.state === "recorded").length;

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}><IconSymbol name="chevron.left" size={20} color={palette.text} /></Pressable>
          <Text style={styles.topTitle}>Module results</Text>
          <StatusPill state={job.state} />
        </View>

        <Text style={styles.eyebrow}>COMPLETED SCAN REVIEW</Text>
        <Text style={styles.title}>{job.reference}</Text>
        <Text style={styles.subtitle}>Authorized {formatDate(job.authorizedAt)} · {job.gatewayStatus ?? "Local record"}</Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryGlyph}><IconSymbol name="checkmark.circle.fill" size={20} color={palette.teal} /></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.cardTitle}>{recordedCount} of {summaries.length} modules have recorded results</Text>
            <Text style={styles.cardDetail}>{job.state === "Complete" ? "Results below are derived only from verified findings saved to this analysis record." : "This record is still in progress. Results will remain pending until the workflow is marked Complete."}</Text>
          </View>
        </Card>

        <SectionLabel>Selected module summaries</SectionLabel>
        <View style={styles.cards}>
          {summaries.map((summary) => {
            const status = stateCopy(summary.state);
            return <Card key={summary.moduleId} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={[styles.moduleDot, { backgroundColor: summary.tint }]} />
                <View style={styles.resultTitleWrap}><Text style={styles.resultTitle}>{summary.moduleName}</Text><Text style={[styles.resultState, { color: status.color }]}>{status.label}</Text></View>
                {summary.highestSeverity ? <View style={styles.severityBadge}><Text style={styles.severityText}>{summary.highestSeverity}</Text></View> : null}
              </View>
              <Text style={styles.cardDetail}>{summary.detail}</Text>
              {summary.findings.length ? <View style={styles.findingList}>{summary.findings.map((finding) => <View key={finding.id} style={styles.findingRow}><View style={styles.findingDot} /><Text style={styles.findingTitle} numberOfLines={2}>{finding.title}</Text></View>)}</View> : null}
            </Card>;
          })}
        </View>

        <Card style={styles.reviewerCard}>
          <Text style={styles.cardTitle}>Reviewer summary</Text>
          <Text style={styles.cardDetail}>{job.summary.trim() || "No reviewer summary has been recorded for this scan."}</Text>
        </Card>
        <QuietButton label="Open all insights" onPress={() => router.push("/(tabs)/insights")} icon="chevron.right" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 14, backgroundColor: palette.base },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 4 },
  title: { color: palette.text, fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: -8 },
  summaryCard: { flexDirection: "row", gap: 11, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" },
  summaryGlyph: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: palette.tealMuted },
  summaryCopy: { flex: 1 },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  cardDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  cards: { gap: 9 },
  resultCard: { gap: 9, backgroundColor: "#101C27" },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  moduleDot: { width: 10, height: 10, borderRadius: 5 },
  resultTitleWrap: { flex: 1 },
  resultTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  resultState: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  severityBadge: { borderRadius: 8, backgroundColor: "#38241A", paddingHorizontal: 7, paddingVertical: 4 },
  severityText: { color: palette.amber, fontSize: 10, fontWeight: "800" },
  findingList: { gap: 7, marginTop: 1 },
  findingRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  findingDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: palette.teal },
  findingTitle: { flex: 1, color: "#C9D7E5", fontSize: 12, lineHeight: 17 },
  reviewerCard: { backgroundColor: "#142833", borderColor: "#214A53" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
});
