import { router } from "expo-router";
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, QuietButton, PrimaryButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { clearGitHubPat, getActiveGitHubTokenDiagnostics, hasGitHubPat, saveGitHubPat, validateGitHubPat, type GitHubTokenDiagnostics } from "@/lib/github-auth";

type Result = { kind: "success" | "error"; text: string } | null;

export default function GitHubSettingsScreen() {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [validation, setValidation] = useState<GitHubTokenDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  const refreshDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const diagnostics = await getActiveGitHubTokenDiagnostics();
      setValidation(diagnostics);
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : "GitHub diagnostics could not be refreshed.");
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hasGitHubPat().then((exists) => {
      setConfigured(exists);
      if (exists) void refreshDiagnostics();
    }).finally(() => setLoadingState(false));
  }, [refreshDiagnostics]);

  const save = async () => {
    if (!token.trim()) {
      setResult({ kind: "error", text: "Paste a GitHub personal access token before saving." });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const checked = await validateGitHubPat(token);
      await saveGitHubPat(token);
      setConfigured(true);
      setValidation(checked);
      setDiagnosticsError(null);
      setToken("");
      setVisible(false);
      setResult({
        kind: "success",
        text: `Connected as ${checked.login}. Authenticated API access is ready for private repositories.`,
      });
    } catch (error) {
      setResult({ kind: "error", text: error instanceof Error ? error.message : "Token validation failed." });
    } finally {
      setSaving(false);
    }
  };

  const disconnect = () => {
    Alert.alert(
      "Remove GitHub token?",
      "This removes the encrypted token from this device. GitHub Loader will use public, unauthenticated access until you add a new token.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove token",
          style: "destructive",
          onPress: () => {
            void clearGitHubPat().then(() => {
              setConfigured(false);
              setValidation(null);
              setDiagnosticsError(null);
              setToken("");
              setResult({ kind: "success", text: "GitHub token removed from this device." });
            }).catch(() => setResult({ kind: "error", text: "Could not remove the saved token." }));
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.72 }]}>
            <IconSymbol name="chevron.left" size={21} color={palette.text} />
          </Pressable>
          <Text style={styles.topTitle}>GitHub access</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.eyebrow}>GITHUB APP LOADER</Text>
        <Text style={styles.title}>Private repository access</Text>
        <Text style={styles.subtitle}>
          Add an optional GitHub personal access token to search repositories your account can access and use authenticated API requests.
        </Text>

        <Card style={styles.securityCard}>
          <View style={styles.securityIcon}><IconSymbol name="lock.shield" size={18} color={palette.teal} /></View>
          <View style={styles.securityBody}>
            <Text style={styles.cardTitle}>Stored only on this device</Text>
            <Text style={styles.cardDetail}>
              Your token is saved in protected local storage, masked in this screen, and sent only to GitHub&apos;s API. It is never included in reports or workspace records.
            </Text>
          </View>
        </Card>

        {loadingState ? (
          <View style={styles.loadingRow}><ActivityIndicator color={palette.teal} /><Text style={styles.loadingText}>Checking local token status…</Text></View>
        ) : configured ? (
          <Card style={styles.connectedCard}>
            <View style={styles.connectedTop}>
              <View style={styles.connectedIcon}><IconSymbol name="checkmark.circle.fill" size={18} color="#74D6A1" /></View>
              <View style={styles.connectedCopy}>
                <Text style={styles.cardTitle}>GitHub token connected</Text>
                <Text style={styles.cardDetail}>A protected token is available for GitHub Loader requests.</Text>
              </View>
            </View>
            {validation ? (
              <View style={styles.validationRow}>
                <Text style={styles.validationText}>Account: <Text style={styles.validationStrong}>{validation.login}</Text></Text>
                {validation.rateLimit ? <Text style={styles.validationText}>API limit: <Text style={styles.validationStrong}>{validation.rateLimit.toLocaleString()}/hr</Text></Text> : null}
              </View>
            ) : null}
            <QuietButton label="Remove saved token" onPress={disconnect} icon="trash" />
          </Card>
        ) : (
          <Card style={styles.offlineCard}>
            <View style={styles.connectedTop}>
              <View style={styles.offlineIcon}><IconSymbol name="info.circle.fill" size={18} color={palette.amber} /></View>
              <View style={styles.connectedCopy}>
                <Text style={styles.cardTitle}>Public GitHub access</Text>
                <Text style={styles.cardDetail}>You can search public repositories without a token. Add one below for private repositories and authenticated request limits.</Text>
              </View>
            </View>
          </Card>
        )}

        {configured ? (
          <Card style={styles.diagnosticsCard}>
            <View style={styles.diagnosticsHeader}>
              <View style={styles.diagnosticsHeading}>
                <View style={styles.diagnosticsIcon}><IconSymbol name="checkmark.shield" size={17} color={palette.teal} /></View>
                <View style={styles.diagnosticsTitleWrap}>
                  <Text style={styles.cardTitle}>Active token diagnostics</Text>
                  <Text style={styles.cardDetail}>GitHub-provided permission metadata and live request limits.</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh token diagnostics"
                onPress={() => void refreshDiagnostics()} disabled={diagnosticsLoading}
                style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.65 }]}>
                {diagnosticsLoading ? <ActivityIndicator size="small" color={palette.teal} /> : <IconSymbol name="arrow.clockwise" size={16} color={palette.teal} />}
              </Pressable>
            </View>

            {diagnosticsError ? (
              <View style={styles.diagnosticsError}>
                <IconSymbol name="exclamationmark.triangle.fill" size={15} color={palette.rose} />
                <Text style={styles.diagnosticsErrorText}>{diagnosticsError}</Text>
              </View>
            ) : validation ? (
              <View style={styles.diagnosticsBody}>
                <View style={styles.diagnosticRows}>
                  <View style={styles.diagnosticRow}><Text style={styles.diagnosticLabel}>ACCOUNT</Text><Text style={styles.diagnosticValue}>{validation.login}</Text></View>
                  <View style={styles.diagnosticRow}><Text style={styles.diagnosticLabel}>TOKEN EXPIRY</Text><Text style={styles.diagnosticValue}>{validation.expiresAt ? new Date(validation.expiresAt).toLocaleDateString() : "Unavailable"}</Text></View>
                  <View style={styles.diagnosticRow}><Text style={styles.diagnosticLabel}>LAST CHECKED</Text><Text style={styles.diagnosticValue}>{new Date(validation.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View>
                </View>

                <View style={styles.diagnosticsSection}>
                  <Text style={styles.diagnosticsLabel}>GRANTED PERMISSIONS</Text>
                  {validation.scopesAvailable ? (
                    validation.scopes.length ? <View style={styles.scopeRow}>{validation.scopes.map((scope) => <View key={scope} style={styles.scopeChip}><Text style={styles.scopeText}>{scope}</Text></View>)}</View>
                    : <Text style={styles.unavailableText}>GitHub did not report classic OAuth scopes for this token.</Text>
                  ) : <Text style={styles.unavailableText}>Unavailable for this token type.</Text>}
                </View>

                <View style={styles.diagnosticsSection}>
                  <Text style={styles.diagnosticsLabel}>REMAINING API LIMITS</Text>
                  {validation.rateResources.length ? validation.rateResources.map((resource) => {
                    const fraction = resource.limit > 0 ? Math.max(0, Math.min(1, resource.remaining / resource.limit)) : 0;
                    const barColor = fraction > 0.25 ? palette.teal : fraction > 0.1 ? palette.amber : palette.rose;
                    return <View key={resource.key} style={styles.rateItem}>
                      <View style={styles.rateTop}><Text style={styles.rateLabel}>{resource.label}</Text><Text style={styles.rateValue}>{resource.remaining.toLocaleString()} / {resource.limit.toLocaleString()}</Text></View>
                      <View style={styles.rateTrack}><View style={[styles.rateFill, { width: `${fraction * 100}%`, backgroundColor: barColor }]} /></View>
                      <Text style={styles.rateReset}>Resets {resource.resetAt ? new Date(resource.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Unavailable"}</Text>
                    </View>;
                  }) : <Text style={styles.unavailableText}>GitHub did not return rate-limit resources. Use Refresh to try again.</Text>}
                </View>
              </View>
            ) : (
              <Text style={styles.unavailableText}>Refresh to load token diagnostics.</Text>
            )}
          </Card>
        ) : null}

        <View style={styles.formBlock}>
          <Text style={styles.sectionLabel}>{configured ? "Replace saved token" : "GitHub personal access token"}</Text>
          <View style={[styles.tokenInputWrap, result?.kind === "error" && !token.trim() && styles.tokenInputError]}>
            <TextInput
              value={token}
              onChangeText={(value) => { setToken(value); setResult(null); }}
              placeholder="github_pat_…"
              placeholderTextColor="#718399"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!visible}
              textContentType="password"
              style={styles.tokenInput}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide token" : "Show token"}
              onPress={() => setVisible((value) => !value)} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
              <IconSymbol name={visible ? "eye.slash" : "eye"} size={19} color={palette.muted} />
            </Pressable>
          </View>
          <Text style={styles.helper}>
            Create a fine-grained token in GitHub with access only to the private repositories you need. Read-only repository metadata is sufficient for searching, releases, and branches.
          </Text>
        </View>

        {result ? (
          <View style={[styles.result, result.kind === "success" ? styles.resultSuccess : styles.resultError]}>
            <IconSymbol name={result.kind === "success" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
              size={16} color={result.kind === "success" ? "#74D6A1" : palette.rose} />
            <Text style={[styles.resultText, { color: result.kind === "success" ? "#74D6A1" : "#F4B8BE" }]}>{result.text}</Text>
          </View>
        ) : null}

        <PrimaryButton label={saving ? "Validating token…" : configured ? "Validate and replace token" : "Validate and save token"}
          onPress={() => void save()} icon="checkmark.shield" disabled={saving} />
        <QuietButton label="Back to GitHub Loader" onPress={() => router.back()} icon="chevron.left" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: palette.base, padding: 20, paddingBottom: 38, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, marginTop: -9 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -7 },
  securityCard: { flexDirection: "row", gap: 11, backgroundColor: "#0F1E2E", borderColor: "#1D3A4A" },
  securityIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  securityBody: { flex: 1 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  loadingText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  connectedCard: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A", gap: 14 },
  offlineCard: { backgroundColor: "#211D10", borderColor: "#51401C" },
  connectedTop: { flexDirection: "row", gap: 11 },
  connectedIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#153A28" },
  offlineIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#3A2E12" },
  connectedCopy: { flex: 1 },
  validationRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 2 },
  validationText: { color: "#A5CDB5", fontSize: 12 },
  validationStrong: { color: "#D4F5E0", fontWeight: "800" },
  diagnosticsCard: { backgroundColor: "#101C27", borderColor: "#1D3A4A", gap: 14 },
  diagnosticsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  diagnosticsHeading: { flex: 1, flexDirection: "row", gap: 10 },
  diagnosticsIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  diagnosticsTitleWrap: { flex: 1 },
  refreshButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#24505A", borderRadius: 10, backgroundColor: "#0F2030" },
  diagnosticsBody: { gap: 15 },
  diagnosticsError: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderWidth: 1, borderColor: "#5C1E27", borderRadius: 11, backgroundColor: "#2A0F14" },
  diagnosticsErrorText: { flex: 1, color: "#F4B8BE", fontSize: 12, lineHeight: 17 },
  diagnosticRows: { gap: 7 },
  diagnosticRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  diagnosticLabel: { color: "#74869A", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  diagnosticValue: { color: "#D9E5F0", fontSize: 12, fontWeight: "700", textAlign: "right" },
  diagnosticsSection: { gap: 8 },
  diagnosticsLabel: { color: "#AEBCC9", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  scopeChip: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#24505A", borderRadius: 7, backgroundColor: "#0F2030" },
  scopeText: { color: palette.teal, fontSize: 11, fontWeight: "700" },
  unavailableText: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  rateItem: { gap: 5 },
  rateTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  rateLabel: { color: "#C9D7E5", fontSize: 12, fontWeight: "700" },
  rateValue: { color: palette.teal, fontSize: 12, fontWeight: "800" },
  rateTrack: { height: 6, borderRadius: 3, backgroundColor: "#27394A", overflow: "hidden" },
  rateFill: { height: 6, borderRadius: 3 },
  rateReset: { color: "#74869A", fontSize: 10 },
  formBlock: { gap: 9 },
  sectionLabel: { color: "#AEBCC9", fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  tokenInputWrap: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 15, borderColor: palette.border, backgroundColor: palette.surface },
  tokenInputError: { borderColor: palette.rose, backgroundColor: "#1A0A0D" },
  tokenInput: { flex: 1, color: palette.text, fontSize: 15 },
  helper: { color: "#74869A", fontSize: 12, lineHeight: 18 },
  result: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 12, borderWidth: 1 },
  resultSuccess: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A" },
  resultError: { backgroundColor: "#2A0F14", borderColor: "#5C1E27" },
  resultText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
});
