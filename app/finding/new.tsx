import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingView, PrimaryButton, QuietButton, SectionLabel, palette } from "@/components/workspace-ui";
import { ValidationError } from "@/components/pixel-warning";
import { ScreenContainer } from "@/components/screen-container";
import { FINDING_SEVERITIES, FindingSeverity, ModuleId, STACK_MODULES } from "@/lib/workspace-model";
import { useWorkspace } from "@/lib/workspace-context";
import { draftFindingWithAi } from "@/lib/ai-provider";

// Severity accent colours (matching Insights screen)
const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  Critical: "#F18A93",
  High:     "#F3B34C",
  Medium:   "#F7D87B",
  Low:      "#83D2C7",
  Info:     "#AAB7C5",
};

export default function NewFindingScreen() {
  const params = useLocalSearchParams<{ jobId?: string }>();
  const { ready, jobs, createFinding } = useWorkspace();

  const [jobId,    setJobId]    = useState(params.jobId ?? "");
  const [source,   setSource]   = useState<ModuleId>("mobsf");
  const [severity, setSeverity] = useState<FindingSeverity>("Medium");
  const [title,    setTitle]    = useState("");
  const [detail,   setDetail]   = useState("");

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorField,      setErrorField]      = useState<string | undefined>(undefined);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiWorking, setAiWorking] = useState(false);

  if (!ready) return <LoadingView />;

  // Validation logic — returns { message, field } or null
  const validate = (): { message: string; field: string } | null => {
    if (!jobId)         return { message: "Choose an analysis record to attach this insight to.", field: "Analysis record" };
    if (!title.trim())  return { message: "Add a concise, verified title for this finding.", field: "Finding title" };
    return null;
  };

  const clearError = (field: string) => {
    if (errorField === field) { setValidationError(null); setErrorField(undefined); }
  };

  const save = () => {
    const err = validate();
    if (err) {
      setValidationError(err.message);
      setErrorField(err.field);
      return;
    }
    setValidationError(null);
    const finding = createFinding({ jobId, source, severity, title, detail });
    if (!finding) return;
    router.replace({ pathname: "/analysis/[id]", params: { id: jobId } });
  };

  const requestDraft = async () => {
    if (!title.trim() && !detail.trim()) {
      setAiStatus("Add a non-sensitive title or note before asking for a draft.");
      return;
    }
    setAiWorking(true); setAiStatus(null);
    try {
      const draft = await draftFindingWithAi({ source, severity, title, detail });
      if (draft.title) setTitle(draft.title);
      if (draft.detail) setDetail(draft.detail);
      setAiStatus("Draft inserted. Review and verify it before saving the finding.");
    } catch (error) { setAiStatus(error instanceof Error ? error.message : "The optional AI provider could not draft this finding."); }
    finally { setAiWorking(false); }
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
          <Text style={styles.topTitle}>Record insight</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.eyebrow}>VERIFIED OBSERVATION</Text>
        <Text style={styles.title}>Capture a finding</Text>
        <Text style={styles.subtitle}>
          Record only a confirmed observation from a target you are authorized to assess.
        </Text>

        {/* ── Analysis record picker ─────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Analysis record</SectionLabel>
          {jobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Text style={styles.emptyJobsText}>No analysis records yet. Prepare one first.</Text>
              <QuietButton label="Prepare analysis" onPress={() => router.push("/analysis/new")} icon="plus" />
            </View>
          ) : (
            <View style={[
              styles.optionList,
              errorField === "Analysis record" && styles.fieldError,
            ]}>
              {jobs.map((job) => (
                <Pressable
                  key={job.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: job.id === jobId }}
                  onPress={() => { setJobId(job.id); clearError("Analysis record"); }}
                  style={({ pressed }) => [
                    styles.option,
                    job.id === jobId && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle} numberOfLines={1}>{job.reference}</Text>
                    <Text style={styles.optionMeta}>{job.targetType}</Text>
                  </View>
                  <IconSymbol
                    name={job.id === jobId ? "checkmark.circle.fill" : "circle"}
                    size={20}
                    color={job.id === jobId ? palette.teal : palette.muted}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Source module ──────────────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Source module</SectionLabel>
          <View style={styles.choiceWrap}>
            {STACK_MODULES.map((module) => (
              <Pressable
                key={module.id}
                accessibilityRole="button"
                accessibilityState={{ selected: source === module.id }}
                onPress={() => setSource(module.id)}
                style={({ pressed }) => [
                  styles.choice,
                  source === module.id && styles.choiceSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.choiceText, source === module.id && styles.choiceTextSelected]}>
                  {module.shortName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Severity ───────────────────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Severity</SectionLabel>
          <View style={styles.choiceWrap}>
            {FINDING_SEVERITIES.map((item) => {
              const accent = SEVERITY_COLOR[item];
              const selected = severity === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSeverity(item)}
                  style={({ pressed }) => [
                    styles.severityChip,
                    selected && { borderColor: accent, backgroundColor: accent + "22" },
                    pressed && styles.pressed,
                  ]}>
                  {selected && <View style={[styles.severityDot, { backgroundColor: accent }]} />}
                  <Text style={[styles.choiceText, selected && { color: accent }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Finding title ──────────────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Finding title</SectionLabel>
          <TextInput
            value={title}
            onChangeText={(t) => { setTitle(t); clearError("Finding title"); }}
            placeholder="Concise verified observation"
            placeholderTextColor="#718399"
            returnKeyType="done"
            style={[
              styles.input,
              errorField === "Finding title" && styles.inputError,
            ]}
          />
        </View>

        {/* ── Supporting note ────────────────────────────────────── */}
        <View style={styles.block}>
          <SectionLabel>Supporting note</SectionLabel>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="Optional local context; do not include credentials or sensitive raw data."
            placeholderTextColor="#718399"
            multiline
            textAlignVertical="top"
            style={styles.noteInput}
          />
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiCopy}><Text style={styles.aiTitle}>Optional AI draft</Text><Text style={styles.aiDetail}>Uses only this title, source, severity, and non-sensitive supporting note. Review every suggestion; it is not verified evidence.</Text></View>
          <QuietButton label={aiWorking ? "Drafting…" : "Draft with AI"} onPress={() => void requestDraft()} icon="checkmark.shield" />
          {aiWorking ? <ActivityIndicator color={palette.teal} /> : null}
          {aiStatus ? <Text style={styles.aiStatus}>{aiStatus}</Text> : null}
        </View>

        {/* ── Inline validation error with 8-bit warning ─────────── */}
        {validationError ? (
          <ValidationError message={validationError} field={errorField} />
        ) : null}

        <PrimaryButton label="Save insight" onPress={save} icon="checkmark.circle.fill" />
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
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, marginTop: -10 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -8 },
  block: { gap: 10 },
  // Job picker
  optionList: { gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", padding: 2 },
  fieldError: { borderColor: "#5C1E27", backgroundColor: "#1A0A0D", padding: 6 },
  option: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 15, padding: 13 },
  optionSelected: { backgroundColor: palette.tealMuted, borderColor: palette.teal },
  optionTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  optionMeta: { color: palette.muted, fontSize: 12, marginTop: 3 },
  emptyJobs: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 10 },
  emptyJobsText: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  // Chips
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  choiceSelected: { backgroundColor: palette.tealMuted, borderColor: palette.teal },
  choiceText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  choiceTextSelected: { color: palette.teal },
  // Severity chips
  severityChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  // Inputs
  input: { minHeight: 52, color: palette.text, fontSize: 15, paddingHorizontal: 15, borderRadius: 15, borderColor: palette.border, borderWidth: 1.5, backgroundColor: palette.surface },
  inputError: { borderColor: palette.rose, backgroundColor: "#1A0A0D" },
  noteInput: { minHeight: 112, color: palette.text, fontSize: 14, lineHeight: 20, padding: 14, borderRadius: 15, borderColor: palette.border, borderWidth: 1, backgroundColor: palette.surface },
  aiCard: { padding: 14, gap: 9, borderRadius: 15, borderWidth: 1, borderColor: "#1D3A4A", backgroundColor: "#0F1E2E" },
  aiCopy: { gap: 3 }, aiTitle: { color: palette.text, fontSize: 14, fontWeight: "800" }, aiDetail: { color: palette.muted, fontSize: 12, lineHeight: 17 }, aiStatus: { color: "#AEBCC9", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
