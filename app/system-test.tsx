import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { router } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, PrimaryButton, QuietButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { searchRepos } from "@/lib/github-api";
import { getActiveGitHubTokenDiagnostics, hasGitHubPat } from "@/lib/github-auth";
import { STACK_MODULES } from "@/lib/workspace-model";
import { refreshActiveGatewayConnection } from "@/lib/gateway-connection";
import { deriveGatewaySystemChecks } from "@/lib/system-test-core";

type CheckState = "idle" | "running" | "passed" | "warning" | "failed";
type CheckResult = { id: string; name: string; category: string; state: CheckState; detail: string };

function initialChecks(): CheckResult[] {
  return [
    { id: "local", name: "Local workspace storage", category: "DEVICE", state: "idle", detail: "Tests the on-device workspace data store without changing saved records." },
    { id: "github", name: "GitHub repository search", category: "NETWORK", state: "idle", detail: "Runs a small public GitHub search request." },
    { id: "github-auth", name: "GitHub account access", category: "NETWORK", state: "idle", detail: "Checks the optional encrypted token only when one is configured." },
    { id: "pdf", name: "PDF report engine", category: "DEVICE", state: "idle", detail: "Creates a tiny temporary PDF to confirm native report support." },
    ...STACK_MODULES.map((module) => ({
      id: module.id,
      name: module.name,
      category: "PRIVATE GATEWAY",
      state: "idle" as CheckState,
      detail: "Requires a configured private gateway health response.",
    })),
  ];
}

function stateColor(state: CheckState) {
  if (state === "passed") return "#74D6A1";
  if (state === "warning") return palette.amber;
  if (state === "failed") return palette.rose;
  if (state === "running") return palette.teal;
  return "#718399";
}

function stateLabel(state: CheckState) {
  if (state === "passed") return "Passed";
  if (state === "warning") return "Action needed";
  if (state === "failed") return "Failed";
  if (state === "running") return "Testing";
  return "Not tested";
}

export default function SystemTestScreen() {
  const [checks, setChecks] = useState<CheckResult[]>(initialChecks);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const summary = useMemo(() => ({
    passed: checks.filter((check) => check.state === "passed").length,
    needsAction: checks.filter((check) => check.state === "warning" || check.state === "failed").length,
  }), [checks]);

  const updateCheck = (id: string, state: CheckState, detail: string) => {
    setChecks((current) => current.map((check) => check.id === id ? { ...check, state, detail } : check));
  };

  const markGatewayPending = (detail: string, state: CheckState = "warning") => {
    STACK_MODULES.forEach((module) => updateCheck(module.id, state, detail));
  };

  const runAll = async () => {
    setRunning(true);
    setLastRun(null);
    setChecks(initialChecks().map((check) => ({ ...check, state: "running", detail: "Running a read-only verification…" })));

    try {
      const marker = `blackbox-system-test-${Date.now()}`;
      await AsyncStorage.setItem(marker, "ok");
      const persisted = await AsyncStorage.getItem(marker);
      await AsyncStorage.removeItem(marker);
      updateCheck("local", persisted === "ok" ? "passed" : "failed", persisted === "ok" ? "Read/write/remove completed without touching saved workspace records." : "The temporary storage check did not return its expected value.");
    } catch {
      updateCheck("local", "failed", "The on-device workspace storage check failed.");
    }

    try {
      const repositories = await searchRepos("github", 1);
      updateCheck("github", repositories.length ? "passed" : "warning", repositories.length ? `GitHub search returned ${repositories[0].full_name}.` : "GitHub replied but no repository result was returned.");
    } catch {
      updateCheck("github", "failed", "GitHub search could not reach the public API. Check network access or rate limits.");
    }

    try {
      const tokenConfigured = await hasGitHubPat();
      if (!tokenConfigured) {
        updateCheck("github-auth", "warning", "No GitHub personal access token is saved. Public search is available; private repositories are unavailable.");
      } else {
        const diagnostics = await getActiveGitHubTokenDiagnostics();
        updateCheck("github-auth", "passed", `Connected as ${diagnostics.login}; ${diagnostics.rateRemaining ?? "?"}/${diagnostics.rateLimit ?? "?"} core requests remain.`);
      }
    } catch {
      updateCheck("github-auth", "failed", "A saved GitHub token could not be verified. Open GitHub access settings to refresh or replace it.");
    }

    if (Platform.OS === "web") {
      updateCheck("pdf", "warning", "Native PDF generation is verified in the installed Android build; web preview does not run the native test.");
    } else {
      try {
        const result = await Print.printToFileAsync({ html: "<html><body><h1>BlackBox system test</h1><p>Native PDF report engine verified.</p></body></html>" });
        updateCheck("pdf", result.uri ? "passed" : "failed", result.uri ? "Native PDF generation completed successfully." : "No temporary PDF URI was returned.");
      } catch {
        updateCheck("pdf", "failed", "Native PDF generation failed. Reinstall the Android build and try again.");
      }
    }

    try {
      const health = await refreshActiveGatewayConnection();
      deriveGatewaySystemChecks(STACK_MODULES.map((module) => module.id), health.profileName, health.modules).forEach((result) => updateCheck(result.id, result.state, result.detail));
    } catch (error) {
      markGatewayPending(error instanceof Error ? `${error.message} Open Gateway controls to connect a profile, then run this test again.` : "The gateway verification request could not be completed.", "failed");
    }

    setLastRun(new Date().toISOString());
    setRunning(false);
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={20} color={palette.text} />
          </Pressable>
          <Text style={styles.topTitle}>System Test</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.eyebrow}>RELEASE READINESS</Text>
        <Text style={styles.title}>Verify your stack</Text>
        <Text style={styles.subtitle}>Run a non-destructive check from the app before deployment. Private module checks query only your configured gateway health endpoint.</Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}><IconSymbol name="checkmark.shield" size={18} color={palette.teal} /></View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>{lastRun ? "Latest verification" : "Ready to verify"}</Text>
              <Text style={styles.summaryDetail}>{lastRun ? `Last run ${new Date(lastRun).toLocaleString()}` : "No workspace data or gateway jobs are changed by this test."}</Text>
            </View>
          </View>
          {lastRun ? <View style={styles.summaryMetrics}><Text style={styles.metricPass}>{summary.passed} passed</Text><Text style={styles.metricAction}>{summary.needsAction} need action</Text></View> : null}
        </Card>

        <PrimaryButton label={running ? "Running verification…" : "Run all system tests"} onPress={() => void runAll()} icon="arrow.clockwise" disabled={running} />

        <Text style={styles.sectionLabel}>CHECK RESULTS</Text>
        <View style={styles.checkList}>
          {checks.map((check) => (
            <Card key={check.id} style={styles.checkCard}>
              <View style={styles.checkTop}>
                <View style={[styles.statusDot, { backgroundColor: stateColor(check.state) }]} />
                <View style={styles.checkCopy}>
                  <Text style={styles.checkName}>{check.name}</Text>
                  <Text style={styles.category}>{check.category}</Text>
                </View>
                {check.state === "running" ? <ActivityIndicator size="small" color={palette.teal} /> : <Text style={[styles.state, { color: stateColor(check.state) }]}>{stateLabel(check.state)}</Text>}
              </View>
              <Text style={styles.checkDetail}>{check.detail}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.noteCard}>
          <IconSymbol name="info.circle.fill" size={16} color={palette.amber} />
          <Text style={styles.noteText}>A private module can only pass after the operator gateway is configured and reports it healthy. Automated fixtures validate this rule in tests but never appear as an app profile or live result.</Text>
        </Card>
        <QuietButton label="Open gateway controls" onPress={() => router.replace("/(tabs)/gateway")} icon="lock.shield" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 14, backgroundColor: palette.base },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: -8 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -5 },
  summaryCard: { backgroundColor: "#0F1E2E", borderColor: "#1D3A4A", gap: 12 },
  summaryTop: { flexDirection: "row", gap: 11 },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  summaryDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  summaryMetrics: { flexDirection: "row", gap: 12, paddingTop: 1 },
  metricPass: { color: "#74D6A1", fontSize: 12, fontWeight: "800" },
  metricAction: { color: palette.amber, fontSize: 12, fontWeight: "800" },
  sectionLabel: { color: "#AEBCC9", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 5 },
  checkList: { gap: 8 },
  checkCard: { gap: 8, backgroundColor: "#101C27" },
  checkTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  checkCopy: { flex: 1 },
  checkName: { color: palette.text, fontSize: 14, fontWeight: "800" },
  category: { color: "#718399", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 2 },
  state: { fontSize: 11, fontWeight: "800", textAlign: "right" },
  checkDetail: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#211D10", borderColor: "#51401C" },
  noteText: { color: "#D6BD78", fontSize: 12, lineHeight: 17, flex: 1 },
});
