import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Card, EmptyCard, LoadingView, ModulePill, PrimaryButton, QuietButton,
  SectionLabel, StatusPill, palette,
} from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useWorkspace } from "@/lib/workspace-context";
import { formatDate } from "@/lib/workspace-model";
import {
  activateGatewayProfile,
  dispatchToActiveGateway,
  listGatewayProfiles,
  removeGatewayProfile,
  refreshActiveGatewayConnection,
  saveGatewayProfile,
  testGatewayConnection,
  verifyActiveGatewayPin,
  type GatewayConnectionStatus,
  type GatewayProfile,
} from "@/lib/gateway-connection";

// ── Setup steps shown when the gateway is not yet configured ─────────────────
const SETUP_STEPS = [
  {
    n: "1",
    title: "Deploy your private gateway",
    detail:
      "Run the operator-gateway Docker stack on infrastructure you control. It must expose its health and job endpoints over HTTPS.",
  },
  {
    n: "2",
    title: "Copy your operator credentials",
    detail:
      "Copy the gateway HTTPS address and the operator access token created during gateway setup. The token is stored only in this device’s secure credential store.",
  },
  {
    n: "3",
    title: "Sign in on this device",
    detail:
      "Enter the address and access token below, then select Test & connect. The app tests /v1/health before it saves anything or enables dispatch.",
  },
];

// ── URL validation helper ────────────────────────────────────────────────────
function validateEndpoint(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null; // empty — no error yet
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return "The gateway endpoint must use HTTPS (https://).";
    if (!url.hostname || url.hostname === "localhost" || url.hostname === "127.0.0.1")
      return "Use a publicly reachable hostname, not localhost.";
    return null;
  } catch {
    return "Enter a valid URL, e.g. https://gateway.example.com";
  }
}

export default function GatewayScreen() {
  const { runJobId } = useLocalSearchParams<{ runJobId?: string }>();
  const { ready, jobs, updateJob } = useWorkspace();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [endpointPreview, setEndpointPreview] = useState("");
  const [operatorToken, setOperatorToken] = useState("");
  const [profileName, setProfileName] = useState("");
  const [confirmationPin, setConfirmationPin] = useState("");
  const [profiles, setProfiles] = useState<GatewayProfile[]>([]);
  const [endpointTouched, setEndpointTouched] = useState(false);
  const [connection, setConnection] = useState<GatewayConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [dispatchPin, setDispatchPin] = useState("");
  const endpointError = endpointTouched ? validateEndpoint(endpointPreview) : null;

  const connected = Boolean(connection);

  const refreshConnection = async (quiet = false) => {
    setConnectionLoading(true);
    try {
      const status = await refreshActiveGatewayConnection();
      setConnection(status);
      setEndpointPreview(status.endpoint);
      setProfileName(status.profileName);
      setProfiles(await listGatewayProfiles());
      if (!quiet) setMessage({ kind: "ok", text: `Connected to ${status.endpointHost}. Gateway health: ${status.health}.` });
    } catch (error) {
      setConnection(null);
      setProfiles(await listGatewayProfiles());
      if (!quiet) setMessage({ kind: "err", text: error instanceof Error ? error.message : "Gateway connection could not be verified." });
    } finally { setConnectionLoading(false); }
  };

  const connectGateway = async () => {
    setEndpointTouched(true);
    if (endpointError) return;
    setConnecting(true);
    try {
      const status = await testGatewayConnection({ endpoint: endpointPreview, token: operatorToken });
      const saved = await saveGatewayProfile({ name: profileName, endpoint: endpointPreview, token: operatorToken, confirmationPin }, status);
      setConnection(saved);
      setEndpointPreview(status.endpoint);
      setOperatorToken("");
      setConfirmationPin("");
      setShowProfileForm(false);
      setProfiles(await listGatewayProfiles());
      setMessage({ kind: "ok", text: `Saved and activated ${saved.profileName}. ${status.modules.length} module statuses received.` });
    } catch (error) {
      setMessage({ kind: "err", text: error instanceof Error ? error.message : "The gateway connection could not be completed." });
    } finally { setConnecting(false); }
  };

  const disconnectGateway = async () => {
    if (!connection) return;
    const removedName = connection.profileName;
    await removeGatewayProfile(connection.profileId);
    setConnection(null);
    setOperatorToken("");
    const remaining = await listGatewayProfiles();
    setProfiles(remaining);
    if (remaining[0]) {
      await activateGatewayProfile(remaining[0].id);
      await refreshConnection(true);
    }
    setMessage({ kind: "ok", text: `${removedName} was removed from this device.` });
  };

  const confirmRemoveActiveProfile = () => {
    if (!connection) return;
    Alert.alert(
      `Remove ${connection.profileName}?`,
      "Its encrypted access token and confirmation PIN will be removed from this device. If another saved profile exists, it becomes active.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove profile", style: "destructive", onPress: () => void disconnectGateway() },
      ],
    );
  };

  const beginProfileForm = () => {
    setProfileName("");
    setEndpointPreview("");
    setOperatorToken("");
    setConfirmationPin("");
    setEndpointTouched(false);
    setShowProfileForm(true);
  };

  const switchProfile = async (profile: GatewayProfile) => {
    setConnectionLoading(true);
    try {
      await activateGatewayProfile(profile.id);
      await refreshConnection(true);
      setMessage({ kind: "ok", text: `${profile.name} is now the active gateway profile.` });
    } catch (error) {
      setMessage({ kind: "err", text: error instanceof Error ? error.message : "The gateway profile could not be activated." });
    } finally { setConnectionLoading(false); }
  };

  useEffect(() => { void refreshConnection(true); }, []);

  useEffect(() => {
    if (!ready || !runJobId) return;
    const requestedJob = jobs.find((job) => job.id === runJobId);
    if (!requestedJob || requestedJob.state !== "Ready") {
      setMessage({ kind: "err", text: "This record is no longer Ready. Return to the analysis record to select a valid run target." });
      return;
    }
    if (!connected) {
      setMessage({ kind: "err", text: "Sign in to your private gateway on this device before this test can start." });
      return;
    }
    setApproved(false);
    setSelectedJobId(requestedJob.id);
  }, [connected, jobs, ready, runJobId]);

  if (!ready) return <LoadingView />;

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const dispatchable = jobs.filter((j) => j.state === "Ready");

  const dispatch = async () => {
    if (!selectedJob || !approved || !dispatchPin.trim()) return;
    setDispatching(true);
    try {
      await verifyActiveGatewayPin(dispatchPin);
      const result = await dispatchToActiveGateway({
        jobId: selectedJob.id,
        reference: selectedJob.reference,
        targetType: selectedJob.targetType,
        modules: selectedJob.modules,
        approval: true,
        approvedAt: new Date().toISOString(),
      });
      updateJob(selectedJob.id, {
        state: "Review",
        dispatchedAt: new Date().toISOString(),
        gatewayReceiptId: result.receiptId,
        gatewayStatus: result.status,
      });
      setMessage({ kind: "ok", text: `Gateway accepted the record — status: ${result.status}.` });
      setSelectedJobId(null);
      setApproved(false);
      setDispatchPin("");
    } catch (error) {
      setMessage({
        kind: "err",
        text: error instanceof Error ? error.message : "The gateway did not accept this record. Verify your active profile and gateway policy.",
      });
    } finally { setDispatching(false); }
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <Text style={styles.eyebrow}>OPERATOR CONTROL PLANE</Text>
        <Text style={styles.title}>Private Gateway</Text>
        <Text style={styles.subtitle}>
          Connect this device to the operator gateway you control. Credentials are encrypted locally and never included in analysis records or reports.
        </Text>

        {/* ── Connection status card ─────────────────────────────────── */}
        <Card style={{ ...styles.statusCard, ...(connected ? styles.statusCardOk : {}) }}>
          <View style={styles.statusTop}>
            <View style={{ ...styles.statusGlyph, ...(connected ? styles.statusGlyphOk : {}) }}>
              <IconSymbol name="lock.shield" size={19} color={connected ? palette.teal : palette.amber} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {connectionLoading ? "Checking saved gateway" : connected ? "Signed in to private gateway" : "No gateway connection on this device"}
              </Text>
              <Text style={styles.statusDetail}>
                {connected && connection ? `${connection.endpointHost} · ${connection.health} · ${connection.modules.length} module statuses received` : "Enter your HTTPS endpoint and operator access token below to sign in."}
              </Text>
            </View>
            <View style={[styles.liveDot, { backgroundColor: connected ? "#74D6A1" : palette.amber }]} />
          </View>

          {connected && (
            <View style={styles.statusAction}>
              <PrimaryButton
                label={connectionLoading ? "Checking gateway…" : "Refresh authenticated health"}
                onPress={() => void refreshConnection()}
                icon="server.rack"
                disabled={connectionLoading}
              />
              <QuietButton label="Remove active profile" onPress={confirmRemoveActiveProfile} icon="xmark.circle" />
            </View>
          )}
        </Card>

        {/* ── Feedback banner ────────────────────────────────────────── */}
        {message && (
          <Card style={{ ...styles.messageCard, ...(message.kind === "ok" ? styles.messageCardOk : styles.messageCardErr) }}>
            <View style={styles.messageRow}>
              <IconSymbol
                name={message.kind === "ok" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
                size={16}
                color={message.kind === "ok" ? "#74D6A1" : palette.rose}
              />
              <Text style={[styles.messageText, { color: message.kind === "ok" ? "#74D6A1" : palette.rose }]}>
                {message.text}
              </Text>
            </View>
            <QuietButton label="Dismiss" onPress={() => setMessage(null)} icon="xmark.circle" />
          </Card>
        )}

        {/* ── Named profile controls ─────────────────────────────────── */}
        {connected && connection && (
          <View style={styles.profileSection}>
            <SectionLabel>Saved gateway profiles</SectionLabel>
            <Card style={styles.profileCard}>
              <Text style={styles.profileHint}>Tap a saved profile to make it active. Each profile keeps its endpoint, access token, and dispatch PIN encrypted on this device.</Text>
              <View style={styles.profileList}>
                {profiles.map((profile) => {
                  const active = profile.id === connection.profileId;
                  return (
                    <Pressable
                      key={profile.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${profile.name} gateway profile`}
                      onPress={() => void switchProfile(profile)}
                      disabled={active || connectionLoading}
                      style={({ pressed }) => [styles.profileRow, active && styles.profileRowActive, pressed && !active && styles.pressed]}
                    >
                      <View style={[styles.profileDot, { backgroundColor: active ? "#74D6A1" : "#718399" }]} />
                      <View style={styles.profileCopy}>
                        <Text style={styles.profileName}>{profile.name}</Text>
                        <Text style={styles.profileMeta} numberOfLines={1}>{new URL(profile.endpoint).host} · {profile.hasConfirmationPin ? "PIN set" : "PIN required"}</Text>
                      </View>
                      <Text style={[styles.profileState, { color: active ? "#74D6A1" : palette.muted }]}>{active ? "Active" : "Switch"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <QuietButton label="Add another gateway profile" onPress={beginProfileForm} icon="plus" />
            </Card>
          </View>
        )}

        {/* ── Setup guide and profile sign-in form ───────────────────── */}
        {(!connected || showProfileForm) && (
          <View style={styles.setupSection}>
            <SectionLabel>{connected ? "Add gateway profile" : "How to connect your gateway"}</SectionLabel>
            {!connected && SETUP_STEPS.map((step) => (
              <Card key={step.n} style={styles.stepCard}>
                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.n}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDetail}>{step.detail}</Text>
                  </View>
                </View>
              </Card>
            ))}

            <Card style={styles.validatorCard}>
              <Text style={styles.validatorLabel}>{connected ? "Connect an additional profile" : "Sign in on this device"}</Text>
              <Text style={styles.validatorHint}>
                Name this gateway for easy switching, then create a 4–8 digit PIN that is required before this profile can dispatch an approved test. The app tests the endpoint before saving credentials.
              </Text>
              <TextInput
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Profile name, e.g. Client A"
                placeholderTextColor="#4A6070"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.urlInput}
              />
              <TextInput
                value={endpointPreview}
                onChangeText={(t) => { setEndpointPreview(t); setEndpointTouched(true); }}
                onBlur={() => setEndpointTouched(true)}
                placeholder="https://gateway.example.com"
                placeholderTextColor="#4A6070"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                style={[styles.urlInput, endpointError ? styles.urlInputError : endpointPreview && !endpointError ? styles.urlInputOk : null]}
              />
              {endpointError ? (
                <View style={styles.validationRow}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={13} color={palette.rose} />
                  <Text style={styles.validationErr}>{endpointError}</Text>
                </View>
              ) : endpointPreview && !endpointError ? (
                <View style={styles.validationRow}>
                  <IconSymbol name="checkmark.circle.fill" size={13} color="#74D6A1" />
                  <Text style={styles.validationOk}>URL format looks valid.</Text>
                </View>
              ) : null}
              <TextInput
                value={operatorToken}
                onChangeText={setOperatorToken}
                placeholder="Operator access token"
                placeholderTextColor="#4A6070"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType="password"
                style={styles.urlInput}
              />
              <TextInput
                value={confirmationPin}
                onChangeText={setConfirmationPin}
                placeholder="4–8 digit confirmation PIN"
                placeholderTextColor="#4A6070"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                textContentType="password"
                style={styles.urlInput}
              />
              <PrimaryButton
                label={connecting ? "Testing connection…" : "Test & connect"}
                onPress={() => void connectGateway()}
                icon="lock.shield"
                disabled={connecting || Boolean(endpointError) || !profileName.trim() || !endpointPreview.trim() || !operatorToken.trim() || !confirmationPin.trim()}
              />
              {connected && <QuietButton label="Cancel" onPress={() => setShowProfileForm(false)} icon="xmark.circle" />}
            </Card>
          </View>
        )}

        {/* ── Dispatch queue ─────────────────────────────────────────── */}
        <SectionLabel>Approved dispatch queue</SectionLabel>
        {dispatchable.length ? (
          dispatchable.map((job) => (
            <Card key={job.id} style={styles.jobCard}>
              <View style={styles.jobHeading}>
                <Text style={styles.jobRef} numberOfLines={1}>{job.reference}</Text>
                <StatusPill state={job.state} />
              </View>
              <View style={styles.modules}>
                {job.modules.map((mid) => <ModulePill key={mid} id={mid} />)}
              </View>
              <Text style={styles.jobMeta}>
                Prepared {formatDate(job.createdAt)} · Explicit operator approval required
              </Text>
              <View style={styles.jobAction}>
                <PrimaryButton
                  label="Review dispatch"
                  onPress={() => { setApproved(false); setSelectedJobId(job.id); }}
                  icon="lock.shield"
                  disabled={!connected || connectionLoading}
                />
              </View>
              {!connected && (
                <Text style={styles.jobDisabledHint}>
                  Sign in to your private gateway on this device to enable dispatch.
                </Text>
              )}
            </Card>
          ))
        ) : (
          <EmptyCard
            title="No records ready for dispatch"
            detail="Prepare an authorized analysis record. It will appear here only when its workflow state is Ready."
          />
        )}

        {/* ── Dispatch history ───────────────────────────────────────── */}
        {jobs.filter((j) => j.gatewayReceiptId).length > 0 && (
          <View style={styles.history}>
            <SectionLabel>Dispatch history</SectionLabel>
            {jobs
              .filter((j) => j.gatewayReceiptId)
              .map((job) => (
                <Card key={job.id} style={styles.historyCard}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyBody}>
                      <Text style={styles.historyTitle}>{job.reference}</Text>
                      <Text style={styles.historyMeta}>
                        {job.gatewayStatus ?? "Accepted"} · {job.dispatchedAt ? formatDate(job.dispatchedAt) : "Recorded"}
                      </Text>
                    </View>
                    <StatusPill state={job.state} />
                  </View>
                  {job.gatewayReceiptId && (
                    <Text style={styles.receiptId} numberOfLines={1}>
                      Receipt: {job.gatewayReceiptId}
                    </Text>
                  )}
                </Card>
              ))}
          </View>
        )}

      </ScrollView>

      {/* ── Approval modal ─────────────────────────────────────────────── */}
      <Modal transparent visible={Boolean(selectedJob)} animationType="slide" onRequestClose={() => setSelectedJobId(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Approve selected-module test</Text>
            <Text style={styles.sheetDetail}>
              This sends only the selected record&apos;s reference, target type, approved modules, and
              approval timestamp to the configured gateway. It cannot send credentials, file contents,
              or arbitrary commands.
            </Text>

            {selectedJob && (
              <Card style={styles.jobPreviewCard}>
                <Text style={styles.jobPreviewRef} numberOfLines={2}>{selectedJob.reference}</Text>
                <View style={styles.jobPreviewMeta}>
                  <Text style={styles.jobPreviewMetaText}>{selectedJob.targetType}</Text>
                  <View style={styles.modules}>
                    {selectedJob.modules.map((mid) => <ModulePill key={mid} id={mid} />)}
                  </View>
                </View>
              </Card>
            )}

            <Card style={styles.approvalCard}>
              <View style={styles.approvalRow}>
                <View style={styles.approvalText}>
                  <Text style={styles.approvalTitle}>I have authority to run this selected-module test</Text>
                  <Text style={styles.approvalDetail}>
                    The gateway enforces its own module and target policy independently.
                  </Text>
                </View>
                <Switch
                  value={approved}
                  onValueChange={setApproved}
                  trackColor={{ false: "#3B4B5C", true: "#2B837B" }}
                  thumbColor={approved ? palette.teal : "#D5DEE7"}
                />
              </View>
            </Card>

            <View style={styles.dispatchPinSection}>
              <Text style={styles.dispatchPinLabel}>Confirm with the active profile PIN</Text>
              <TextInput
                value={dispatchPin}
                onChangeText={setDispatchPin}
                placeholder="4–8 digit PIN"
                placeholderTextColor="#4A6070"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                textContentType="password"
                style={styles.urlInput}
              />
              <Text style={styles.dispatchPinHint}>Enter the PIN for {connection?.profileName ?? "the active profile"}. It is verified locally before the approved job is sent.</Text>
            </View>

            <PrimaryButton
              label={dispatching ? "Starting test…" : "Start selected module test"}
              onPress={() => void dispatch()}
              icon="checkmark.circle.fill"
              disabled={!approved || !dispatchPin.trim() || dispatching}
            />
            <QuietButton
              label="Cancel"
              onPress={() => { setSelectedJobId(null); setApproved(false); setDispatchPin(""); }}
              icon="xmark.circle"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34, backgroundColor: palette.base, gap: 16 },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6, marginTop: -11 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -7 },
  // Status card
  statusCard: { backgroundColor: "#142833", borderColor: "#214A53" },
  statusCardOk: { borderColor: "#2B5C52" },
  statusTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  statusGlyph: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#1E3A3A" },
  statusGlyphOk: { backgroundColor: palette.tealMuted },
  statusCopy: { flex: 1 },
  statusTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  statusDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  liveDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  authWarn: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12, padding: 10, backgroundColor: "#2A2010", borderRadius: 10, borderWidth: 1, borderColor: "#4A3A10" },
  authWarnText: { color: palette.amber, fontSize: 12, lineHeight: 17, flex: 1 },
  statusAction: { marginTop: 15 },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 13 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { color: palette.text, fontSize: 13, fontWeight: "800" },
  // Feedback banner
  messageCard: { gap: 10 },
  messageCardOk: { backgroundColor: "#0F2A1F", borderColor: "#1E5C3A" },
  messageCardErr: { backgroundColor: "#2A0F14", borderColor: "#5C1E27" },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  messageText: { fontSize: 14, lineHeight: 20, flex: 1 },
  // Setup guide
  setupSection: { gap: 10 },
  stepCard: { backgroundColor: "#0F1C28", borderColor: "#1D3040" },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepBadge: { width: 26, height: 26, borderRadius: 8, backgroundColor: palette.tealMuted, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { color: palette.teal, fontSize: 13, fontWeight: "800" },
  stepBody: { flex: 1 },
  stepTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  stepDetail: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  // Endpoint validator
  validatorCard: { backgroundColor: "#0F1C28", borderColor: "#1D3040", gap: 10 },
  validatorLabel: { color: palette.text, fontSize: 14, fontWeight: "800" },
  validatorHint: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  urlInput: { height: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: palette.border, backgroundColor: palette.surface, color: palette.text, fontSize: 14 },
  urlInputOk: { borderColor: "#2B7A5C" },
  urlInputError: { borderColor: palette.rose },
  validationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  validationErr: { color: palette.rose, fontSize: 12, flex: 1 },
  validationOk: { color: "#74D6A1", fontSize: 12 },
  // Profile management
  profileSection: { gap: 8 },
  profileCard: { gap: 11, backgroundColor: "#0F1C28", borderColor: "#1D3040" },
  profileHint: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  profileList: { gap: 7 },
  profileRow: { minHeight: 54, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  profileRowActive: { backgroundColor: "#10251F", borderColor: "#1E5C3A" },
  profileDot: { width: 8, height: 8, borderRadius: 4 },
  profileCopy: { flex: 1 },
  profileName: { color: palette.text, fontSize: 13, fontWeight: "800" },
  profileMeta: { color: palette.muted, fontSize: 11, marginTop: 3 },
  profileState: { fontSize: 11, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  // Dispatch queue
  jobCard: { gap: 11 },
  jobHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  jobRef: { color: palette.text, fontSize: 16, fontWeight: "800", flex: 1 },
  modules: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  jobMeta: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  jobAction: { marginTop: 2 },
  jobDisabledHint: { color: palette.amber, fontSize: 12, lineHeight: 16, marginTop: 2 },
  // History
  history: { gap: 8 },
  historyCard: { paddingVertical: 14, gap: 6 },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  historyBody: { flex: 1 },
  historyTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  historyMeta: { color: palette.muted, fontSize: 12, marginTop: 3 },
  receiptId: { color: "#4A6070", fontSize: 11, marginTop: 2 },
  // Approval modal
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2, 7, 12, 0.78)" },
  sheet: { backgroundColor: palette.surfaceStrong, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 38, gap: 16 },
  sheetHandle: { height: 4, width: 42, borderRadius: 2, backgroundColor: "#607083", alignSelf: "center", marginTop: -8 },
  sheetTitle: { color: palette.text, fontSize: 21, fontWeight: "800" },
  sheetDetail: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  jobPreviewCard: { backgroundColor: palette.base, gap: 8 },
  jobPreviewRef: { color: palette.text, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  jobPreviewMeta: { gap: 8 },
  jobPreviewMetaText: { color: palette.muted, fontSize: 13 },
  approvalCard: { backgroundColor: palette.base },
  approvalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  approvalText: { flex: 1 },
  approvalTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  approvalDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  dispatchPinSection: { gap: 7 },
  dispatchPinLabel: { color: palette.text, fontSize: 13, fontWeight: "800" },
  dispatchPinHint: { color: palette.muted, fontSize: 11, lineHeight: 16 },
});
