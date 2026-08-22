import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, LoadingView, PrimaryButton, QuietButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { MODULE_SETUP } from "@/lib/module-setup";
import { STACK_MODULES } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";

const EFFECTIVE_WORKFLOW = [
  ["1", "Define the authorized target", "Create a workspace and record the approved reference, scope, and intended module set before any gateway action."],
  ["2", "Connect the right profile", "Select the named private gateway profile for the engagement. Its credentials and confirmation PIN stay encrypted on this device."],
  ["3", "Verify readiness", "Run System Test. Treat Awaiting, Manual, and Unavailable module states as action needed—not as a completed check."],
  ["4", "Dispatch deliberately", "Select only needed modules, confirm authority, enter the active profile PIN, and let the gateway independently enforce policy."],
  ["5", "Record verified evidence", "Capture findings only after review. Keep secrets, raw credentials, and unapproved sensitive data out of notes and reports."],
] as const;

export default function SettingsGuidanceScreen() {
  const { ready } = useWorkspace();
  const [workflowExpanded, setWorkflowExpanded] = useState(true);
  const [modulesExpanded, setModulesExpanded] = useState(false);
  if (!ready) return <LoadingView />;

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <FlatList
        data={modulesExpanded ? STACK_MODULES : []}
        keyExtractor={(module) => module.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>SETTINGS & GUIDANCE</Text>
            <Text style={styles.title}>Use BlackBox effectively</Text>
            <Text style={styles.subtitle}>A practical reference for preparing authorized work, using the private gateway safely, and understanding each analysis module.</Text>

            <Card style={styles.boundaryCard}>
              <View style={styles.boundaryIcon}><IconSymbol name="lock.shield" size={19} color={palette.teal} /></View>
              <View style={styles.boundaryCopy}>
                <Text style={styles.cardTitle}>Keep the boundary clear</Text>
                <Text style={styles.cardDetail}>BlackBox organizes authorized work on this device. The gateway—not the mobile app—performs approved remote work and independently checks target scope and module policy.</Text>
              </View>
            </Card>

            <View style={styles.quickActions}>
              <PrimaryButton label="Prepare an analysis" onPress={() => router.push("/analysis/new")} icon="plus" />
              <View style={styles.actionRow}>
                <QuietButton label="Gateway profiles" onPress={() => router.push("/gateway")} icon="lock.shield" />
                <QuietButton label="System Test" onPress={() => router.push("/system-test")} icon="checkmark.shield" />
              </View>
              <QuietButton label="Optional AI provider" onPress={() => router.push("/ai-settings" as never)} icon="checkmark.shield" />
            </View>

            <DisclosureCard title="Recommended workflow" detail="Five practical steps for secure, effective analysis work." expanded={workflowExpanded} onPress={() => setWorkflowExpanded((value) => !value)}>
              <View style={styles.workflowList}>
                {EFFECTIVE_WORKFLOW.map(([number, heading, detail]) => (
                  <View key={number} style={styles.workflowRow}>
                    <View style={styles.stepBadge}><Text style={styles.stepText}>{number}</Text></View>
                    <View style={styles.workflowCopy}><Text style={styles.cardTitle}>{heading}</Text><Text style={styles.cardDetail}>{detail}</Text></View>
                  </View>
                ))}
              </View>
            </DisclosureCard>

            <DisclosureCard title="Module reference" detail="Purpose, best use, and setup links for all six modules." expanded={modulesExpanded} onPress={() => setModulesExpanded((value) => !value)}>
              <Text style={styles.moduleIntro}>Expand to browse the module cards, then tap one for setup, configuration, verification, and authorized-run guidance.</Text>
            </DisclosureCard>
          </>
        }
        renderItem={({ item }) => {
          const guide = MODULE_SETUP[item.id];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name} guide`}
              onPress={() => router.push({ pathname: "/module-setup" as never, params: { moduleId: item.id } })}
              style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]}
            >
              <View style={[styles.moduleIcon, { backgroundColor: `${item.tint}20` }]}><IconSymbol name="chevron.left.forwardslash.chevron.right" size={18} color={item.tint} /></View>
              <View style={styles.moduleCopy}>
                <View style={styles.moduleTitleRow}><Text style={styles.moduleName}>{item.name}</Text><IconSymbol name="chevron.right" size={17} color={palette.muted} /></View>
                <Text style={[styles.moduleCategory, { color: item.tint }]}>{item.category}</Text>
                <Text style={styles.moduleDetail}>{guide.title}. {item.capability}</Text>
                <Text style={styles.moduleTip} numberOfLines={2}>Best use: {guide.run}</Text>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        ListFooterComponent={modulesExpanded ? <Card style={styles.footerCard}><Text style={styles.cardTitle}>Before every approved run</Text><Text style={styles.cardDetail}>Use only a real private gateway profile, keep module results honest, and review outputs before adding a finding or exporting a report.</Text></Card> : null}
      />
    </ScreenContainer>
  );
}

function DisclosureCard({ title, detail, expanded, onPress, children }: { title: string; detail: string; expanded: boolean; onPress: () => void; children: React.ReactNode }) {
  return <Card style={styles.disclosureCard}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${title}`} onPress={onPress} style={({ pressed }) => [styles.disclosureButton, pressed && styles.pressed]}>
      <View style={styles.disclosureCopy}><Text style={styles.disclosureTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text></View>
      <IconSymbol name="chevron.right" size={19} color={palette.teal} style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }} />
    </Pressable>
    {expanded ? <View style={styles.disclosureBody}>{children}</View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  content: { backgroundColor: palette.base, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 12 },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, marginTop: 2 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -4, marginBottom: 4 },
  boundaryCard: { flexDirection: "row", gap: 11, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" },
  boundaryIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: palette.tealMuted },
  boundaryCopy: { flex: 1 }, cardTitle: { color: palette.text, fontSize: 14, fontWeight: "800" }, cardDetail: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  quickActions: { gap: 8 }, actionRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  disclosureCard: { padding: 0, overflow: "hidden", backgroundColor: "#101C27", borderColor: "#1D3A4A" }, disclosureButton: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }, disclosureCopy: { flex: 1 }, disclosureTitle: { color: palette.text, fontSize: 14, fontWeight: "800" }, disclosureBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: "#1D3A4A" },
  workflowList: { gap: 12, paddingTop: 13 }, workflowRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, stepBadge: { width: 27, height: 27, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted }, stepText: { color: palette.teal, fontSize: 12, fontWeight: "800" }, workflowCopy: { flex: 1 },
  moduleIntro: { color: palette.muted, fontSize: 12, lineHeight: 17, paddingTop: 13 },
  moduleCard: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 11, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }, moduleIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, moduleCopy: { flex: 1 }, moduleTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, moduleName: { flex: 1, color: palette.text, fontSize: 15, fontWeight: "800" }, moduleCategory: { fontSize: 11, fontWeight: "800", marginTop: 2 }, moduleDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, moduleTip: { color: "#AEBCC9", fontSize: 11, lineHeight: 16, marginTop: 7 },
  footerCard: { marginTop: 10, backgroundColor: "#10251F", borderColor: "#1E5C3A" }, pressed: { opacity: 0.72 },
});
