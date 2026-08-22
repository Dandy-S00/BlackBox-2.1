import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, LoadingView, ModulePill, PrimaryButton, QuietButton, SectionLabel, palette } from "@/components/workspace-ui";
import { ValidationError } from "@/components/pixel-warning";
import { ScreenContainer } from "@/components/screen-container";
import { AnalysisDraft, ModuleId, STACK_MODULES, TARGET_TYPES, TargetType, validateAnalysisDraft } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";

export default function NewAnalysisScreen() {
  const { ready, workspaces, createJob } = useWorkspace();
  const params = useLocalSearchParams<{ moduleId?: ModuleId; prefillReference?: string }>();
  const initialModules = useMemo(
    () => (STACK_MODULES.some((m) => m.id === params.moduleId) && params.moduleId ? [params.moduleId] : []),
    [params.moduleId],
  );
  // Pre-fill reference when arriving from GitHub Loader
  const prefillRef = typeof params.prefillReference === "string" ? params.prefillReference : "";

  const [workspaceId, setWorkspaceId]   = useState("");
  const [targetType, setTargetType]     = useState<TargetType>("Mobile package");
  const [reference, setReference]       = useState(prefillRef);
  const [modules, setModules]           = useState<ModuleId[]>(initialModules);
  const [acknowledged, setAcknowledged] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorField, setErrorField]     = useState<string | undefined>(undefined);

  if (!ready) return <LoadingView />;

  const activeWorkspaces = workspaces.filter((w) => w.status === "Active");

  const toggleModule = (id: ModuleId) =>
    setModules((cur) => cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]);

  // Map validation messages to field labels for red highlighting
  const FIELD_MAP: Record<string, string> = {
    "Choose a workspace":    "Workspace",
    "Add a local target":    "Target reference",
    "Select at least one":   "Analysis modules",
    "Confirm that you are":  "Authorization",
  };

  const save = () => {
    const draft: AnalysisDraft = { workspaceId, reference, targetType, modules, acknowledged };
    const error = validateAnalysisDraft(draft);
    if (error) {
      setValidationError(error);
      const field = Object.entries(FIELD_MAP).find(([key]) => error.startsWith(key))?.[1];
      setErrorField(field);
      return;
    }
    setValidationError(null);
    const job = createJob({ workspaceId, reference, targetType, modules, acknowledgedAt: new Date().toISOString() });
    router.replace({ pathname: "/analysis/[id]", params: { id: job.id } });
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
          <Text style={styles.topTitle}>Prepare analysis</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.eyebrow}>AUTHORIZED USE ONLY</Text>
        <Text style={styles.title}>Create a handoff record</Text>
        <Text style={styles.subtitle}>
          This saves a local preparation record. It does not initiate remote analysis or transmit a file, database, or credential.
        </Text>

        {/* Workspace */}
        <SectionLabel>Workspace</SectionLabel>
        {activeWorkspaces.length ? (
          <View style={[styles.optionList, validationError && errorField === "Workspace" && styles.fieldError]}>
            {activeWorkspaces.map((ws) => (
              <Pressable key={ws.id} accessibilityRole="button" accessibilityState={{ selected: workspaceId === ws.id }}
                onPress={() => { setWorkspaceId(ws.id); if (errorField === "Workspace") setValidationError(null); }}
                style={({ pressed }) => [
                  styles.workspaceOption,
                  workspaceId === ws.id && styles.workspaceOptionSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.workspaceName}>{ws.name}</Text>
                  <Text style={styles.workspaceMeta}>{ws.targetType}</Text>
                </View>
                <IconSymbol name={workspaceId === ws.id ? "checkmark.circle.fill" : "circle"} size={20}
                  color={workspaceId === ws.id ? palette.teal : palette.muted} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>Create an active workspace first</Text>
            <Text style={styles.cardDetail}>An analysis record must belong to an approved local engagement.</Text>
            <View style={styles.cardAction}>
              <PrimaryButton label="Create workspace" onPress={() => router.push("/workspaces")} icon="folder.badge.plus" />
            </View>
          </Card>
        )}

        {/* Target type */}
        <View style={styles.block}>
          <SectionLabel>Target type</SectionLabel>
          <View style={styles.choiceWrap}>
            {TARGET_TYPES.map((item) => (
              <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: targetType === item }}
                onPress={() => setTargetType(item)}
                style={({ pressed }) => [styles.choice, targetType === item && styles.choiceSelected, pressed && styles.pressed]}>
                <Text style={[styles.choiceText, targetType === item && styles.choiceTextSelected]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Reference */}
        <View style={styles.block}>
          <SectionLabel>Local target reference</SectionLabel>
          <TextInput
            value={reference}
            onChangeText={(t) => { setReference(t); if (errorField === "Target reference") setValidationError(null); }}
            placeholder="Approved build label or case reference"
            placeholderTextColor="#718399"
            returnKeyType="done"
            style={[styles.input, validationError && errorField === "Target reference" && styles.inputError]}
          />
          <Text style={styles.helper}>Keep this reference non-sensitive. Do not store keys, passwords, or private URLs.</Text>
        </View>

        {/* Modules */}
        <View style={styles.block}>
          <SectionLabel>Analysis modules</SectionLabel>
          <View style={[styles.moduleChoiceList, validationError && errorField === "Analysis modules" && styles.fieldError]}>
            {STACK_MODULES.map((module) => {
              const selected = modules.includes(module.id);
              return (
                <Pressable key={module.id} accessibilityRole="button" accessibilityState={{ selected }}
                  onPress={() => { toggleModule(module.id); if (errorField === "Analysis modules") setValidationError(null); }}
                  style={({ pressed }) => [
                    styles.moduleChoice,
                    selected && styles.moduleChoiceSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.moduleChoiceBody}>
                    <ModulePill id={module.id} />
                    <Text style={styles.moduleDescription}>{module.capability}</Text>
                  </View>
                  <IconSymbol name={selected ? "checkmark.circle.fill" : "plus.circle"} size={20}
                    color={selected ? palette.teal : palette.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Authorization */}
        <Card style={{ ...styles.authorizationCard, ...(validationError && errorField === "Authorization" ? styles.authError : {}) }}>
          <View style={styles.authorizationIcon}>
            <IconSymbol name="lock.shield" size={17} color={palette.teal} />
          </View>
          <View style={styles.authorizationText}>
            <Text style={styles.cardTitle}>Authorization acknowledgement</Text>
            <Text style={styles.cardDetail}>I own this target or have documented permission to assess it in the selected scope.</Text>
          </View>
          <Switch
            value={acknowledged}
            onValueChange={(v) => { setAcknowledged(v); if (errorField === "Authorization") setValidationError(null); }}
            trackColor={{ false: "#3B4B5C", true: "#2B837B" }}
            thumbColor={acknowledged ? palette.teal : "#D5DEE7"}
          />
        </Card>

        {/* Inline validation error with 8-bit warning */}
        {validationError ? (
          <ValidationError message={validationError} field={errorField} />
        ) : null}

        <PrimaryButton label="Save analysis record" onPress={save} icon="checkmark.circle.fill" disabled={!activeWorkspaces.length} />
        <QuietButton label="Cancel" onPress={() => router.back()} icon="xmark.circle" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: palette.base, padding: 20, paddingBottom: 36, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 3 },
  title: { color: palette.text, fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, marginTop: -11 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -8 },
  block: { gap: 10 },
  optionList: { gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", padding: 2 },
  fieldError: { borderColor: "#5C1E27", backgroundColor: "#1A0A0D", borderRadius: 14, padding: 6 },
  workspaceOption: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.surface, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  workspaceOptionSelected: { borderColor: palette.teal, backgroundColor: "#163236" },
  optionTextWrap: { flex: 1 },
  workspaceName: { color: palette.text, fontSize: 15, fontWeight: "800" },
  workspaceMeta: { color: palette.muted, fontSize: 12, marginTop: 3 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  cardAction: { marginTop: 15 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  choiceSelected: { backgroundColor: palette.tealMuted, borderColor: palette.teal },
  choiceText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  choiceTextSelected: { color: palette.teal },
  input: { color: palette.text, fontSize: 15, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1.5, borderRadius: 15, paddingHorizontal: 15, minHeight: 52 },
  inputError: { borderColor: palette.rose, backgroundColor: "#1A0A0D" },
  helper: { color: "#74869A", fontSize: 12, lineHeight: 17, marginTop: -3 },
  moduleChoiceList: { gap: 8 },
  moduleChoice: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 11, padding: 13, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 16 },
  moduleChoiceSelected: { backgroundColor: "#163236", borderColor: palette.teal },
  moduleChoiceBody: { flex: 1, gap: 7 },
  moduleDescription: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  authorizationCard: { backgroundColor: "#142833", borderColor: "#214A53", flexDirection: "row", alignItems: "center", gap: 11 },
  authError: { borderColor: palette.rose, backgroundColor: "#2A0F14" },
  authorizationIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  authorizationText: { flex: 1 },
  pressed: { opacity: 0.72 },
});
