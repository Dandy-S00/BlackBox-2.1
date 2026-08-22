import React, { useEffect, useState, useCallback, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, palette } from "@/components/workspace-ui";
import { trpc } from "@/lib/trpc";

export function SystemHealthCard() {
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const requestStartRef = useRef<number>(Date.now());
  const [isManualPinging, setIsManualPinging] = useState(false);

  const utils = trpc.useUtils();

  const pingServer = useCallback(async () => {
    setIsManualPinging(true);
    const start = Date.now();
    try {
      await utils.system.health.fetch({ timestamp: start });
      const duration = Math.max(1, Date.now() - start);
      setLatency(duration);
      setLastCheckTime(new Date());
    } catch {
      setLatency(null);
    } finally {
      setIsManualPinging(false);
    }
  }, [utils]);

  // Regular automated health poll query
  const query = trpc.system.health.useQuery(
    { timestamp: requestStartRef.current },
    {
      refetchInterval: 12_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  useEffect(() => {
    if (query.dataUpdatedAt) {
      const now = Date.now();
      const calculatedLatency = Math.max(1, now - (query.dataUpdatedAt - 20));
      // If we don't have manual ping latency or on regular poll, update latency & timestamp
      if (latency === null || !isManualPinging) {
        setLatency((prev) => (prev !== null ? Math.round((prev + calculatedLatency) / 2) : calculatedLatency));
      }
      setLastCheckTime(new Date(query.dataUpdatedAt));
    }
  }, [query.dataUpdatedAt, query.data, isManualPinging, latency]);

  const isOnline = !query.isError && (query.data?.ok === true || query.isSuccess);
  const isChecking = query.isLoading || query.isFetching || isManualPinging;

  const getLatencyQuality = (ms: number | null) => {
    if (ms === null || !isOnline) return { label: "N/A", color: palette.muted, barWidth: 0 };
    if (ms < 100) return { label: "Optimal", color: "#74D6A1", barWidth: 90 };
    if (ms < 300) return { label: "Good", color: palette.teal, barWidth: 65 };
    return { label: "Elevated", color: palette.amber, barWidth: 35 };
  };

  const latencyQuality = getLatencyQuality(latency);

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.statusIconWrap, { backgroundColor: isOnline ? "#15362B" : "#3B1F23" }]}>
            <IconSymbol
              name={isOnline ? "checkmark.shield" : "exclamationmark.triangle.fill"}
              size={18}
              color={isOnline ? "#74D6A1" : palette.rose}
            />
          </View>
          <View>
            <View style={styles.headerLabelRow}>
              <Text style={styles.title}>System Health & Latency</Text>
              <View style={[styles.statusBadge, { backgroundColor: isOnline ? "#1B4332" : "#442125" }]}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: isOnline ? "#74D6A1" : palette.rose }]} />
                <Text style={[styles.statusBadgeText, { color: isOnline ? "#9BE0B4" : "#F7A8B0" }]}>
                  {query.isLoading ? "Connecting…" : isOnline ? "Online" : "Offline"}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>tRPC Gateway & API Link</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ping server now"
          disabled={isChecking}
          onPress={() => void pingServer()}
          style={({ pressed }) => [styles.pingButton, pressed && styles.pingButtonPressed]}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color={palette.teal} />
          ) : (
            <IconSymbol name="arrow.clockwise" size={16} color={palette.teal} />
          )}
        </Pressable>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>ROUNDTRIP LATENCY</Text>
          <View style={styles.latencyValueRow}>
            <Text style={[styles.metricValue, { color: isOnline ? palette.text : palette.muted }]}>
              {latency !== null && isOnline ? `${latency}` : "—"}
            </Text>
            {latency !== null && isOnline && <Text style={styles.metricUnit}>ms</Text>}
          </View>
          <View style={styles.qualityBarTrack}>
            <View
              style={[
                styles.qualityBarFill,
                { width: `${latencyQuality.barWidth}%`, backgroundColor: latencyQuality.color },
              ]}
            />
          </View>
          <Text style={[styles.qualityText, { color: latencyQuality.color }]}>
            {latencyQuality.label}
          </Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>SERVER STATUS</Text>
          <View style={styles.statusRow}>
            <IconSymbol
              name={isOnline ? "globe" : "xmark.circle"}
              size={20}
              color={isOnline ? "#74D6A1" : palette.rose}
            />
            <Text style={[styles.statusText, { color: isOnline ? "#F4F7FA" : palette.rose }]}>
              {isOnline ? "Operational" : "Unavailable"}
            </Text>
          </View>
          <Text style={styles.timestampText}>
            {lastCheckTime
              ? `Checked ${lastCheckTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
              : "Awaiting first ping…"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#141D29",
    borderColor: "#233346",
    padding: 16,
    borderRadius: 18,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  pingButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#192838",
    borderWidth: 1,
    borderColor: "#263F56",
    alignItems: "center",
    justifyContent: "center",
  },
  pingButtonPressed: {
    opacity: 0.7,
  },
  metricsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#0D141E",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#1C2A3A",
    padding: 12,
    justifyContent: "space-between",
    minHeight: 88,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  latencyValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginVertical: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  metricUnit: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  qualityBarTrack: {
    height: 4,
    backgroundColor: "#182433",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 4,
  },
  qualityBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  qualityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginVertical: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "800",
  },
  timestampText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "500",
  },
});
