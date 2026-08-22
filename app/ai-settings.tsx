import { router } from "expo-router";
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, PrimaryButton, QuietButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { AI_PROVIDER_OPTIONS, type AiProviderId, type AiProviderSettings } from "@/lib/ai-provider-core";
import { clearAiProviderConfiguration, getAiProviderSettings, hasAiProviderConfiguration, saveAiProviderConfiguration, validateAiProviderCandidate, validateSavedAiProvider } from "@/lib/ai-provider";

type Result = { kind: "success" | "error"; text: string } | null;

export default function AiSettingsScreen() {
  const [provider, setProvider] = useState<AiProviderId>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState<AiProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingLabel, setWorkingLabel] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  const load = async () => {
    const settings = await getAiProviderSettings();
    setSaved(await hasAiProviderConfiguration() ? settings : null);
    if (settings) { setProvider(settings.provider); setModel(settings.model); setEndpoint(settings.endpoint ?? ""); }
  };

  useEffect(() => { void load().finally(() => setLoading(false)); }, []);

  const chooseProvider = (next: AiProviderId) => {
    setProvider(next);
    const option = AI_PROVIDER_OPTIONS.find((candidate) => candidate.id === next);
    if (option) setModel(option.defaultModel);
    setResult(null);
    setSaveConfirmation(null);
  };

  const save = async () => {
    setWorking(true); setWorkingLabel("Validating secure provider connection…"); setResult(null); setSaveConfirmation(null);
    try {
      const input = { provider, model, endpoint, apiKey };
      const checked = await validateAiProviderCandidate(input);
      setWorkingLabel("Encrypting provider key on this device…");
      await saveAiProviderConfiguration(input, checked);
      setSaved(checked); setApiKey(""); setVisible(false);
      const providerLabel = AI_PROVIDER_OPTIONS.find((item) => item.id === checked.provider)?.label ?? "AI provider";
      setSaveConfirmation(`${providerLabel} · ${checked.model} saved securely on this device. AI assistance remains off until you request a draft.`);
    } catch (error) { setResult({ kind: "error", text: error instanceof Error ? error.message : "The provider could not be configured." }); }
    finally { setWorking(false); setWorkingLabel(null); }
  };

  const testSaved = async () => {
    setWorking(true); setWorkingLabel("Testing saved provider connection…"); setResult(null); setSaveConfirmation(null);
    try { const checked = await validateSavedAiProvider(); setSaved(checked); setResult({ kind: "success", text: "The saved provider connection responded successfully." }); }
    catch (error) { setResult({ kind: "error", text: error instanceof Error ? error.message : "The saved provider could not be tested." }); }
    finally { setWorking(false); setWorkingLabel(null); }
  };

  const remove = () => Alert.alert("Remove AI provider?", "This removes the encrypted API key and non-secret provider settings from this device. Existing findings are unchanged.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: () => void clearAiProviderConfiguration().then(() => { setSaved(null); setApiKey(""); setResult({ kind: "success", text: "Optional AI provider removed from this device." }); }).catch(() => setResult({ kind: "error", text: "The AI provider could not be removed." })) },
  ]);

  return <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.topRow}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={21} color={palette.text} /></Pressable><Text style={styles.topTitle}>AI provider</Text><View style={styles.backButton} /></View>
    <Text style={styles.eyebrow}>OPTIONAL ASSISTANCE</Text><Text style={styles.title}>AI draft settings</Text><Text style={styles.subtitle}>Connect a provider only if you want on-demand draft help. AI remains off unless you explicitly request a draft.</Text>
    <Card style={styles.securityCard}><View style={styles.securityIcon}><IconSymbol name="lock.shield" size={18} color={palette.teal} /></View><View style={styles.securityCopy}><Text style={styles.cardTitle}>Your key stays on this device</Text><Text style={styles.cardDetail}>The API key is encrypted in device secure storage. It is never added to workspace records, finding exports, gateway jobs, or application logs.</Text></View></Card>
    {loading ? <View style={styles.loading}><ActivityIndicator color={palette.teal} /><Text style={styles.cardDetail}>Checking local provider settings…</Text></View> : saved ? <Card style={styles.connectedCard}><Text style={styles.cardTitle}>Provider configured</Text><Text style={styles.cardDetail}>{AI_PROVIDER_OPTIONS.find((item) => item.id === saved.provider)?.label} · {saved.model}</Text><View style={styles.actionRow}><QuietButton label={working ? "Testing…" : "Test saved connection"} onPress={() => void testSaved()} icon="arrow.clockwise" /><QuietButton label="Remove provider" onPress={remove} icon="trash" /></View></Card> : <Card style={styles.noticeCard}><Text style={styles.cardTitle}>No provider connected</Text><Text style={styles.cardDetail}>You can still use every BlackBox workflow without AI assistance.</Text></Card>}
    <Text style={styles.sectionLabel}>{saved ? "Replace provider" : "Choose provider"}</Text><View style={styles.providerList}>{AI_PROVIDER_OPTIONS.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: provider === item.id }} onPress={() => chooseProvider(item.id)} style={({ pressed }) => [styles.providerCard, provider === item.id && styles.providerSelected, pressed && styles.pressed]}><View style={styles.providerCopy}><Text style={styles.cardTitle}>{item.label}</Text><Text style={styles.cardDetail}>{item.description}</Text></View><IconSymbol name={provider === item.id ? "checkmark.circle.fill" : "circle"} size={20} color={provider === item.id ? palette.teal : palette.muted} /></Pressable>)}</View>
    <View style={styles.formBlock}><Text style={styles.sectionLabel}>Model</Text><TextInput value={model} onChangeText={(value) => { setModel(value); setSaveConfirmation(null); }} placeholder="Provider model ID" placeholderTextColor="#718399" autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>
    {provider === "openai-compatible" ? <View style={styles.formBlock}><Text style={styles.sectionLabel}>HTTPS API base URL</Text><TextInput value={endpoint} onChangeText={(value) => { setEndpoint(value); setSaveConfirmation(null); }} placeholder="https://provider.example/v1" placeholderTextColor="#718399" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} /></View> : null}
    <View style={styles.formBlock}><Text style={styles.sectionLabel}>Provider API key</Text><View style={styles.keyRow}><TextInput value={apiKey} onChangeText={(value) => { setApiKey(value); setSaveConfirmation(null); setResult(null); }} placeholder="Paste key to test and save" placeholderTextColor="#718399" autoCapitalize="none" autoCorrect={false} secureTextEntry={!visible} textContentType="password" style={styles.keyInput} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide API key" : "Show API key"} onPress={() => setVisible((value) => !value)}><IconSymbol name={visible ? "eye.slash" : "eye"} size={19} color={palette.muted} /></Pressable></View><Text style={styles.helper}>Use a restricted provider key. Do not send credentials, raw sensitive evidence, or unapproved target data in an AI draft request.</Text></View>
    {workingLabel ? <View style={styles.savingState}><ActivityIndicator color={palette.teal} /><Text style={styles.savingStateText}>{workingLabel}</Text></View> : null}
    {saveConfirmation ? <View style={styles.saveConfirmation}><IconSymbol name="checkmark.circle.fill" size={17} color="#74D6A1" /><View style={styles.saveConfirmationCopy}><Text style={styles.saveConfirmationTitle}>Provider saved securely</Text><Text style={styles.saveConfirmationText}>{saveConfirmation}</Text></View></View> : null}
    {result ? <View style={[styles.result, result.kind === "success" ? styles.resultSuccess : styles.resultError]}><IconSymbol name={result.kind === "success" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"} size={16} color={result.kind === "success" ? "#74D6A1" : palette.rose} /><Text style={[styles.resultText, { color: result.kind === "success" ? "#74D6A1" : "#F4B8BE" }]}>{result.text}</Text></View> : null}
    <PrimaryButton label={working ? "Saving provider…" : "Test and save provider"} onPress={() => void save()} icon="checkmark.shield" disabled={working} />
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 38, gap: 15, backgroundColor: palette.base }, topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }, topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" }, eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, title: { color: palette.text, fontSize: 29, lineHeight: 36, fontWeight: "800", marginTop: -8 }, subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -7 }, securityCard: { flexDirection: "row", gap: 11, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" }, securityIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: palette.tealMuted, alignItems: "center", justifyContent: "center" }, securityCopy: { flex: 1 }, cardTitle: { color: palette.text, fontSize: 14, fontWeight: "800" }, cardDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 14 }, connectedCard: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A", gap: 10 }, noticeCard: { backgroundColor: "#211D10", borderColor: "#51401C" }, actionRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, sectionLabel: { color: "#AEBCC9", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, providerList: { gap: 8 }, providerCard: { padding: 13, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }, providerSelected: { borderColor: palette.teal, backgroundColor: palette.tealMuted }, providerCopy: { flex: 1 }, formBlock: { gap: 8 }, input: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, color: palette.text, fontSize: 14 }, keyRow: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 10 }, keyInput: { flex: 1, color: palette.text, fontSize: 14 }, helper: { color: "#74869A", fontSize: 12, lineHeight: 18 }, savingState: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#24505A", backgroundColor: "#0F2030" }, savingStateText: { color: palette.teal, fontSize: 13, fontWeight: "700" }, saveConfirmation: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1E5C3A", backgroundColor: "#0F2A1F" }, saveConfirmationCopy: { flex: 1 }, saveConfirmationTitle: { color: "#D4F5E0", fontSize: 13, fontWeight: "800" }, saveConfirmationText: { color: "#A5CDB5", fontSize: 12, lineHeight: 17, marginTop: 3 }, result: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 }, resultSuccess: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A" }, resultError: { backgroundColor: "#2A0F14", borderColor: "#5C1E27" }, resultText: { flex: 1, fontSize: 13, lineHeight: 18 }, pressed: { opacity: 0.72 },
});
