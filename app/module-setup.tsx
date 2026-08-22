import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, PrimaryButton, QuietButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { MODULE_SETUP } from "@/lib/module-setup";
import { moduleById, type ModuleId } from "@/lib/workspace-model";

const STEPS = ["Setup", "Configure", "Verify", "Run"] as const;

export default function ModuleSetupScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId?: ModuleId }>();
  const module = moduleById(moduleId ?? "ghidra");
  const guide = MODULE_SETUP[module.id];
  const content = { Setup: guide.setup, Configure: guide.configure, Verify: guide.verify, Run: guide.run };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={20} color={palette.text} /></Pressable><Text style={styles.topTitle}>Module setup</Text><View style={styles.back} /></View>
        <Text style={styles.eyebrow}>PRIVATE MODULE GUIDE</Text>
        <Text style={styles.title}>{guide.title}</Text>
        <Text style={styles.subtitle}>Use this checklist to set up the operator environment, verify the module through the active gateway profile, and prepare an authorized run.</Text>
        <Card style={styles.connectionCard}><View style={[styles.dot, { backgroundColor: module.tint }]} /><View style={styles.connectionCopy}><Text style={styles.cardTitle}>{module.connection}</Text><Text style={styles.cardDetail}>{module.boundary}</Text></View></Card>
        {STEPS.map((step, index) => <Card key={step} style={styles.stepCard}><View style={styles.stepRow}><View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{index + 1}</Text></View><View style={styles.stepCopy}><Text style={styles.stepTitle}>{step}</Text><Text style={styles.cardDetail}>{content[step]}</Text></View></View></Card>)}
        <Card style={styles.runCard}><Text style={styles.cardTitle}>In-app readiness path</Text><Text style={styles.cardDetail}>1. Connect or switch to the correct gateway profile. 2. Run System Test to confirm this module’s health. 3. Prepare an analysis with this module selected. 4. Confirm authority and enter the profile dispatch PIN before the gateway receives the job.</Text></Card>
        <PrimaryButton label={`Prepare ${module.shortName} analysis`} onPress={() => router.push({ pathname: "/analysis/new", params: { moduleId: module.id } })} icon="plus" />
        <QuietButton label="Run system test" onPress={() => router.push("/system-test")} icon="checkmark.shield" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 12, backgroundColor: palette.base },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }, topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 }, title: { color: palette.text, fontSize: 27, lineHeight: 34, fontWeight: "800", marginTop: -7 }, subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -4 },
  connectionCard: { flexDirection: "row", gap: 10, backgroundColor: "#142833", borderColor: "#214A53" }, dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 }, connectionCopy: { flex: 1 }, cardTitle: { color: palette.text, fontSize: 14, fontWeight: "800" }, cardDetail: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  stepCard: { backgroundColor: "#101C27" }, stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, stepBadge: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted }, stepBadgeText: { color: palette.teal, fontSize: 12, fontWeight: "800" }, stepCopy: { flex: 1 }, stepTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  runCard: { backgroundColor: "#10251F", borderColor: "#1E5C3A" }, pressed: { opacity: 0.7 },
});
