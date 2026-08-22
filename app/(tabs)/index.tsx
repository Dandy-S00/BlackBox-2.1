import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Card, EmptyCard, LoadingView, ModulePill, PrimaryButton, QuietButton,
  SectionLabel, StatusPill, palette,
} from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { formatDate, STACK_MODULES } from "@/lib/workspace-model";
import type { AnalysisJob } from "@/lib/workspace-model";
import { summarizeDispatchHistory } from "@/lib/dashboard";
import { useWorkspace } from "@/lib/workspace-context";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/lib/toast";
import { SystemHealthCard } from "@/components/system-health-card";

type HealthTone = "healthy" | "unavailable" | "manual" | "unknown";
const healthColor: Record<HealthTone, string> = {
  healthy: "#74D6A1",
  unavailable: palette.rose,
  manual: palette.amber,
  unknown: "#708093",
};

// State-change toast messages
const STATE_TOAST: Record<string, { kind: "success" | "info" | "warning"; label: string }> = {
  Review:   { kind: "info",    label: "moved to Review" },
  Complete: { kind: "success", label: "marked Complete" },
  Archived: { kind: "warning", label: "archived" },
  Ready:    { kind: "info",    label: "set to Ready" },
  Draft:    { kind: "info",    label: "returned to Draft" },
};

// Animated pulsing dot for "in-flight" states
function StateDot({ state }: { state: AnalysisJob["state"] }) {
  const pulse = state === "Review";
  const color =
    state === "Complete" ? "#74D6A1" :
    state === "Review"   ? palette.amber :
    state === "Archived" ? "#708093" :
    state === "Ready"    ? palette.teal :
    "#708093";
  return (
    <View style={[styles.stateDot, { backgroundColor: color, opacity: pulse ? 0.9 : 0.7 }]} />
  );
}

export default function DashboardScreen() {
  const { ready, jobs } = useWorkspace();
  const toast = useToast();
  const dashboard = summarizeDispatchHistory(jobs);

  const statusQuery = trpc.gateway.status.useQuery(undefined, { retry: false });
  const healthQuery = trpc.gateway.health.useQuery(undefined, {
    enabled: statusQuery.data?.configured === true,
    retry: false,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // Track job state changes and fire toasts
  const prevStatesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!ready) return;
    const prev = prevStatesRef.current;
    jobs.forEach((job) => {
      const prevState = prev[job.id];
      if (prevState && prevState !== job.state) {
        const t = STATE_TOAST[job.state];
        if (t) {
          toast.show(t.kind, `Job ${t.label}`, job.reference);
        }
      }
      prev[job.id] = job.state;
    });
    prevStatesRef.current = { ...prev };
  }, [jobs, ready, toast]);

  if (!ready) return <LoadingView />;

  const healthMap = new Map(
    healthQuery.data?.modules.map((m) => [m.id, m.status]) ?? [],
  );
  const configured = statusQuery.data?.configured === true;
  const lastChecked = healthQuery.dataUpdatedAt
    ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <FlatList
        data={dashboard.recentDispatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* ── Header ──────────────────────────────────────────── */}
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>OPERATIONS OVERVIEW</Text>
                <Text style={styles.title}>Dashboard</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Open gateway controls"
                onPress={() => router.push("/gateway")}
                style={({ pressed }) => [styles.gatewayButton, pressed && styles.pressed]}>
                <IconSymbol name="lock.shield" size={19} color={palette.teal} />
              </Pressable>
            </View>

            {/* ── System Health & Latency Monitor ────────────────── */}
            <SystemHealthCard />

            {/* ── Stack health card ────────────────────────────────── */}
            <Card style={styles.healthCard}>
              <View style={styles.healthTop}>
                <View style={styles.healthTitleWrap}>
                  <View style={styles.healthGlyph}>
                    <IconSymbol name="server.rack" size={18} color={configured ? palette.teal : palette.amber} />
                  </View>
                  <View>
                    <Text style={styles.healthTitle}>Live stack health</Text>
                    <Text style={styles.healthDetail}>
                      {healthQuery.isFetching
                        ? "Refreshing operator-authorized status…"
                        : configured
                        ? healthQuery.data?.status ?? "Awaiting health response"
                        : "Gateway has not been configured"}
                    </Text>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Refresh stack health"
                  onPress={() => void healthQuery.refetch()}
                  style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
                  <IconSymbol name="arrow.clockwise" size={17} color={palette.teal} />
                </Pressable>
              </View>

              {/* Module grid with live status indicators */}
              <View style={styles.moduleGrid}>
                {STACK_MODULES.map((module) => {
                  const state = (healthMap.get(module.id) ?? "unknown") as HealthTone;
                  const dotColor = healthColor[state];
                  return (
                    <View key={module.id} style={styles.healthModule}>
                      <View style={styles.healthModuleTop}>
                        <View style={[styles.healthDot, { backgroundColor: dotColor }]} />
                        {/* Pulsing ring for degraded modules */}
                        {state === "unavailable" && (
                          <View style={[styles.healthDotRing, { borderColor: dotColor }]} />
                        )}
                      </View>
                      <Text style={styles.healthModuleName}>{module.shortName}</Text>
                      <Text style={[styles.healthModuleState, { color: dotColor }]}>
                        {state === "unknown"      ? "Awaiting"
                          : state === "manual"    ? "Manual"
                          : state === "healthy"   ? "Online"
                          : "Unavailable"}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.healthFoot}>
                <Text style={styles.healthFootText}>
                  {statusQuery.error
                    ? "Operator sign-in is required for health visibility."
                    : lastChecked
                    ? `Auto-refreshes every 15 s · checked ${lastChecked}`
                    : "Configure the private gateway to activate automatic health refresh."}
                </Text>
                <QuietButton label="Gateway" onPress={() => router.push("/gateway")} icon="chevron.right" />
              </View>
            </Card>

            {/* ── Metrics ─────────────────────────────────────────── */}
            <View style={styles.metrics}>
              <Metric label="Local dispatches" value={String(dashboard.totalDispatches)} />
              <Metric label="In review" value={String(dashboard.reviewCount)} accent={dashboard.reviewCount > 0 ? palette.amber : undefined} />
              <Metric label="Accepted" value={String(dashboard.acceptedCount)} accent={dashboard.acceptedCount > 0 ? "#74D6A1" : undefined} />
            </View>

            <View style={styles.sectionGap}>
              <SectionLabel
                action={<QuietButton label="Prepare analysis" onPress={() => router.push("/analysis/new")} icon="plus" />}>
                Dispatch history
              </SectionLabel>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open dispatched analysis ${item.reference}`}
            onPress={() => router.push({ pathname: "/analysis/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.dispatchRow, pressed && styles.pressed]}>
            <View style={styles.dispatchBody}>
              <View style={styles.dispatchTop}>
                <View style={styles.dispatchTitleRow}>
                  <StateDot state={item.state} />
                  <Text style={styles.dispatchRef} numberOfLines={1}>{item.reference}</Text>
                </View>
                <StatusPill state={item.state} />
              </View>
              <View style={styles.moduleRow}>
                {item.modules.map((id) => <ModulePill key={id} id={id} />)}
              </View>
              <Text style={styles.dispatchMeta}>
                {item.gatewayStatus ?? "Accepted"} · {item.dispatchedAt ? `Dispatched ${formatDate(item.dispatchedAt)}` : "Local record"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={palette.muted} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyCard
            title="No local dispatches yet"
            detail="Approved jobs will appear here after the operator gateway accepts them. Module coverage remains local and never fabricates a remote result."
            action={<PrimaryButton label="Open gateway controls" onPress={() => router.push("/gateway")} icon="lock.shield" />}
          />
        }
        ListFooterComponent={
          <View style={styles.coverage}>
            <SectionLabel>Module coverage</SectionLabel>
            <View style={styles.coverageGrid}>
              {STACK_MODULES.map((module) => (
                <View key={module.id} style={styles.coverageItem}>
                  <View style={[styles.coverageMark, { backgroundColor: module.tint }]} />
                  <Text style={styles.coverageName}>{module.shortName}</Text>
                  <Text style={styles.coverageValue}>{dashboard.moduleCounts[module.id]}</Text>
                </View>
              ))}
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 12, backgroundColor: palette.base, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6, marginTop: 3 },
  gatewayButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#276572", borderRadius: 14, backgroundColor: "#142833" },
  healthCard: { backgroundColor: "#142833", borderColor: "#214A53" },
  healthTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  healthTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  healthGlyph: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.tealMuted, alignItems: "center", justifyContent: "center" },
  healthTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  healthDetail: { color: palette.muted, fontSize: 12, marginTop: 3 },
  refreshButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderColor: "#2A5962", borderWidth: 1 },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  healthModule: { width: "31%", minHeight: 68, borderRadius: 13, backgroundColor: "#101C27", padding: 10, gap: 3 },
  healthModuleTop: { position: "relative", width: 14, height: 14, marginBottom: 2 },
  healthDot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 3, left: 3 },
  healthDotRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, position: "absolute", top: 0, left: 0, opacity: 0.5 },
  healthModuleName: { color: palette.text, fontSize: 12, fontWeight: "800" },
  healthModuleState: { fontSize: 10, fontWeight: "800" },
  healthFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14, borderTopColor: "#214A53", borderTopWidth: 1, paddingTop: 11 },
  healthFootText: { color: palette.muted, fontSize: 11, lineHeight: 16, flex: 1 },
  metrics: { flexDirection: "row", gap: 9, marginTop: 10 },
  metric: { flex: 1, padding: 14, minHeight: 85, borderColor: palette.border, borderWidth: 1, backgroundColor: palette.surface, borderRadius: 17, justifyContent: "space-between" },
  metricValue: { color: palette.text, fontSize: 23, lineHeight: 28, fontWeight: "800" },
  metricLabel: { color: palette.muted, fontSize: 11, lineHeight: 14, fontWeight: "600" },
  sectionGap: { marginTop: 10 },
  // Dispatch rows
  dispatchRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18 },
  dispatchBody: { flex: 1, gap: 8 },
  dispatchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dispatchTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  stateDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dispatchRef: { color: palette.text, fontSize: 15, fontWeight: "800", flex: 1 },
  moduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dispatchMeta: { color: palette.muted, fontSize: 12 },
  // Coverage
  coverage: { marginTop: 20, marginBottom: 10 },
  coverageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  coverageItem: { width: "31%", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 10 },
  coverageMark: { width: 7, height: 7, borderRadius: 4 },
  coverageName: { color: palette.muted, fontSize: 11, fontWeight: "700", flex: 1 },
  coverageValue: { color: palette.text, fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
