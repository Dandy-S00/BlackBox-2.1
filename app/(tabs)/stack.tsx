import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, LoadingView, QuietButton, SectionLabel, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { STACK_MODULES } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";

export default function StackScreen() {
  const { ready } = useWorkspace();
  if (!ready) return <LoadingView />;

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <FlatList
        data={STACK_MODULES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>SUPPLIED ARCHITECTURE</Text>
            <Text style={styles.title}>Analysis Stack</Text>
            <Text style={styles.subtitle}>
              A mobile reference for the six services in your privately operated stack. Select a service to prepare it for an authorized record.
            </Text>

            {/* Connection boundary card */}
            <Card style={styles.boundaryCard}>
              <View style={styles.boundaryIcon}>
                <IconSymbol name="lock.shield" size={18} color={palette.teal} />
              </View>
              <View style={styles.boundaryText}>
                <Text style={styles.boundaryTitle}>Connection boundary</Text>
                <Text style={styles.boundaryDetail}>
                  This client does not contain MCP tools, host credentials, or direct privileged access. It remains a local organizer until a secure gateway is supplied.
                </Text>
              </View>
            </Card>

            {/* ── GitHub App Loader entry ────────────────────────── */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open GitHub App Loader"
              onPress={() => router.push("/github-loader")}
              style={({ pressed }) => [styles.githubCard, pressed && styles.pressed]}>
              <View style={styles.githubIcon}>
                <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color="#2AD4C4" />
              </View>
              <View style={styles.githubBody}>
                <View style={styles.githubTitleRow}>
                  <Text style={styles.githubTitle}>GitHub App Loader</Text>
                  <IconSymbol name="chevron.right" size={16} color={palette.muted} />
                </View>
                <Text style={styles.githubCategory}>Repository target</Text>
                <Text style={styles.githubCapability}>
                  Search public GitHub repositories, browse releases and branches, and queue a repo as an analysis target in any workspace.
                </Text>
                <View style={styles.connectionLine}>
                  <View style={[styles.connectionDot, { backgroundColor: "#2AD4C4" }]} />
                  <Text style={styles.connectionText}>Public GitHub API (unauthenticated)</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Run BlackBox system test"
              onPress={() => router.push("/system-test")}
              style={({ pressed }) => [styles.systemTestCard, pressed && styles.pressed]}>
              <View style={styles.systemTestIcon}>
                <IconSymbol name="checkmark.shield" size={20} color="#74D6A1" />
              </View>
              <View style={styles.githubBody}>
                <View style={styles.githubTitleRow}>
                  <Text style={styles.githubTitle}>Run System Test</Text>
                  <IconSymbol name="chevron.right" size={16} color={palette.muted} />
                </View>
                <Text style={[styles.githubCategory, { color: "#74D6A1" }]}>Release readiness</Text>
                <Text style={styles.githubCapability}>
                  Verify local storage, GitHub access, native PDF support, and every private gateway module before deployment.
                </Text>
                <View style={styles.connectionLine}>
                  <View style={[styles.connectionDot, { backgroundColor: "#74D6A1" }]} />
                  <Text style={styles.connectionText}>Read-only and non-destructive</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open version and updates"
              onPress={() => router.push("/app-update")}
              style={({ pressed }) => [styles.updateCard, pressed && styles.pressed]}>
              <View style={styles.updateIcon}>
                <IconSymbol name="arrow.down.doc.fill" size={20} color="#F7C948" />
              </View>
              <View style={styles.githubBody}>
                <View style={styles.githubTitleRow}>
                  <Text style={styles.githubTitle}>Version & updates</Text>
                  <IconSymbol name="chevron.right" size={16} color={palette.muted} />
                </View>
                <Text style={[styles.githubCategory, { color: "#F7C948" }]}>Android APK</Text>
                <Text style={styles.githubCapability}>Compare the installed build with the latest release manifest and view controlled APK update guidance.</Text>
                <View style={styles.connectionLine}>
                  <View style={[styles.connectionDot, { backgroundColor: "#F7C948" }]} />
                  <Text style={styles.connectionText}>Manual install, always user-controlled</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.stackLabel}>
              <SectionLabel>Available modules</SectionLabel>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Prepare ${item.name} analysis`}
            onPress={() => router.push({ pathname: "/module-setup" as never, params: { moduleId: item.id } })}
            style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]}>
            <View style={[styles.moduleIcon, { backgroundColor: `${item.tint}20` }]}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={18} color={item.tint} />
            </View>
            <View style={styles.moduleBody}>
              <View style={styles.moduleTitleRow}>
                <Text style={styles.moduleName}>{item.name}</Text>
                <IconSymbol name="chevron.right" size={17} color={palette.muted} />
              </View>
              <Text style={styles.moduleCategory}>{item.category}</Text>
              <Text style={styles.moduleCapability}>{item.capability}</Text>
              <View style={styles.connectionLine}>
                <View style={[styles.connectionDot, { backgroundColor: item.tint }]} />
                <Text style={styles.connectionText}>{item.connection}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={
          <View style={styles.footer}>
            <QuietButton label="Prepare an analysis" onPress={() => router.push("/analysis/new")} icon="plus" />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, backgroundColor: palette.base },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6, marginTop: 3 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 17 },
  boundaryCard: { flexDirection: "row", gap: 12, backgroundColor: "#142833", borderColor: "#214A53" },
  boundaryIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  boundaryText: { flex: 1 },
  boundaryTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  boundaryDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  // GitHub Loader card
  githubCard: { marginTop: 12, padding: 15, flexDirection: "row", gap: 12, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A", borderWidth: 1, borderRadius: 19 },
  systemTestCard: { marginTop: 10, padding: 15, flexDirection: "row", gap: 12, backgroundColor: "#10251F", borderColor: "#1E5C3A", borderWidth: 1, borderRadius: 19 },
  updateCard: { marginTop: 10, padding: 15, flexDirection: "row", gap: 12, backgroundColor: "#2A2010", borderColor: "#5C461A", borderWidth: 1, borderRadius: 19 },
  githubIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  systemTestIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#153A28" },
  updateIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#382A12" },
  githubBody: { flex: 1 },
  githubTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  githubTitle: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: "800", flex: 1 },
  githubCategory: { color: palette.teal, fontSize: 12, fontWeight: "800", marginTop: 2 },
  githubCapability: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  // Shared
  stackLabel: { marginTop: 20 },
  moduleCard: { padding: 15, flexDirection: "row", gap: 12, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 19 },
  moduleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  moduleBody: { flex: 1 },
  moduleTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  moduleName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: "800", flex: 1 },
  moduleCategory: { color: palette.teal, fontSize: 12, fontWeight: "800", marginTop: 2 },
  moduleCapability: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  connectionLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 11 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: "#AEBCC9", fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  footer: { alignItems: "center", paddingTop: 18 },
});
