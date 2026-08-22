import Constants from "expo-constants";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, PrimaryButton, QuietButton, palette } from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { APP_RELEASE } from "@/constants/release";
import { checksumCommand, formatChecksum, hasPublishedChecksum, hasVerifiedApkDownload, verifiedApkQrUrl } from "@/lib/apk-integrity";
import { trpc } from "@/lib/trpc";

function compareVersions(first: string, second: string) {
  const a = first.split(".").map((part) => Number(part) || 0);
  const b = second.split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export default function AppUpdateScreen() {
  const releaseQuery = trpc.release.manifest.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [copiedChecksum, setCopiedChecksum] = useState(false);
  const installedVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? APP_RELEASE.version;
  const installedBuild = Constants.nativeBuildVersion ?? String(Constants.expoConfig?.android?.versionCode ?? APP_RELEASE.androidVersionCode);
  const latest = releaseQuery.data ?? APP_RELEASE;
  const updateAvailable = compareVersions(latest.version, installedVersion) > 0 || (latest.version === installedVersion && latest.androidVersionCode > Number(installedBuild));
  const checkedAt = releaseQuery.dataUpdatedAt ? new Date(releaseQuery.dataUpdatedAt) : null;
  const integrityAvailable = hasPublishedChecksum(latest.apkIntegrity);
  const verifiedDownloadAvailable = hasVerifiedApkDownload(latest.apkIntegrity);

  const copyChecksum = async () => {
    if (!integrityAvailable) return;
    await Clipboard.setStringAsync(latest.apkIntegrity.sha256);
    setCopiedChecksum(true);
  };

  const openVerifiedDownload = () => {
    if (verifiedDownloadAvailable) void Linking.openURL(latest.apkIntegrity.verifiedDownloadUrl);
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}><IconSymbol name="chevron.left" size={20} color={palette.text} /></Pressable>
          <Text style={styles.topTitle}>Version & updates</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.eyebrow}>ANDROID RELEASES</Text>
        <Text style={styles.title}>Keep BlackBox current</Text>
        <Text style={styles.subtitle}>Check this build against the current published release manifest. APK installation always remains under your control.</Text>

        <Card style={updateAvailable ? styles.updateCard : styles.currentCard}>
          <View style={styles.statusTop}>
            <View style={[styles.statusGlyph, { backgroundColor: updateAvailable ? "#38241A" : palette.tealMuted }]}>
              <IconSymbol name={updateAvailable ? "arrow.down.doc.fill" : "checkmark.circle.fill"} size={20} color={updateAvailable ? palette.amber : palette.teal} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>{updateAvailable ? "A newer release is available" : "This installed build is current"}</Text>
              <Text style={styles.statusDetail}>{updateAvailable ? `Version ${latest.version} (build ${latest.androidVersionCode}) is ready for controlled APK installation.` : `Version ${installedVersion} (build ${installedBuild}) matches the latest release metadata.`}</Text>
            </View>
          </View>
          <View style={styles.statusMeta}><Text style={styles.statusMetaText}>{releaseQuery.isFetching ? "Checking release status…" : checkedAt ? `Last checked ${checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Using bundled release metadata"}</Text></View>
          <PrimaryButton label={releaseQuery.isFetching ? "Checking…" : "Check for updates"} onPress={() => void releaseQuery.refetch()} icon="arrow.clockwise" disabled={releaseQuery.isFetching} />
        </Card>

        {releaseQuery.error ? <Card style={styles.errorCard}><IconSymbol name="exclamationmark.triangle.fill" size={15} color={palette.rose} /><Text style={styles.errorText}>The release service could not be reached. The app is showing its bundled version information instead.</Text></Card> : null}

        <Card style={styles.versionCard}>
          <Text style={styles.cardHeading}>Installed APK</Text>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>VERSION</Text><Text style={styles.versionValue}>{installedVersion}</Text></View>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>ANDROID BUILD</Text><Text style={styles.versionValue}>{installedBuild}</Text></View>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>PACKAGE</Text><Text style={styles.versionValue} numberOfLines={1}>{Constants.expoConfig?.android?.package ?? "com.app.unifiedanalysisworkspace"}</Text></View>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>CHANNEL</Text><Text style={styles.versionValue}>{latest.channel}</Text></View>
        </Card>

        <Card style={integrityAvailable ? styles.integrityCard : styles.integrityPendingCard}>
          <View style={styles.integrityHeader}>
            <View style={[styles.integrityGlyph, { backgroundColor: integrityAvailable ? palette.tealMuted : "#38241A" }]}>
              <IconSymbol name={integrityAvailable ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"} size={19} color={integrityAvailable ? palette.teal : palette.amber} />
            </View>
            <View style={styles.integrityCopy}>
              <Text style={styles.cardHeading}>Signed APK integrity</Text>
              <Text style={styles.integrityDetail}>{integrityAvailable ? "Compare the downloaded APK hash before installation." : "Checksum metadata is pending until a real signed Android APK is published."}</Text>
            </View>
          </View>
          <View style={styles.integrityRow}><Text style={styles.versionLabel}>ASSET</Text><Text style={styles.integrityValue} numberOfLines={1}>{latest.apkIntegrity.assetName}</Text></View>
          <View style={styles.integrityRow}><Text style={styles.versionLabel}>ALGORITHM</Text><Text style={styles.integrityValue}>{latest.apkIntegrity.algorithm}</Text></View>
          <View style={styles.hashBox}><Text style={styles.hashLabel}>PUBLISHED SHA-256</Text><Text selectable style={[styles.hashValue, !integrityAvailable && styles.hashPending]}>{integrityAvailable ? formatChecksum(latest.apkIntegrity.sha256) : "Awaiting signed APK artifact"}</Text></View>
          {latest.apkIntegrity.signingCertificateSha256 ? <View style={styles.hashBox}><Text style={styles.hashLabel}>SIGNING CERTIFICATE SHA-256</Text><Text selectable style={styles.hashValue}>{formatChecksum(latest.apkIntegrity.signingCertificateSha256)}</Text></View> : null}
          {integrityAvailable ? <QuietButton label={copiedChecksum ? "Checksum copied" : "Copy SHA-256 checksum"} onPress={() => void copyChecksum()} icon="chevron.right" /> : <Text style={styles.pendingNote}>After publishing, calculate the checksum from the generated APK and update the release manifest before sharing the file.</Text>}
        </Card>

        <Card style={styles.verifyCard}>
          <Text style={styles.cardHeading}>Verify before installing</Text>
          <Text style={styles.verifyText}>Download the APK only from the published project build. On Android with Termux, macOS, or Linux, run the command below against the downloaded file and compare the complete output with the published SHA-256 above.</Text>
          <Text selectable style={styles.commandText}>{checksumCommand(latest.apkIntegrity.assetName)}</Text>
          <Text style={styles.verifyText}>Do not install the APK if the values differ or if no published checksum is displayed.</Text>
        </Card>

        <Card style={verifiedDownloadAvailable ? styles.qrCard : styles.qrPendingCard}>
          <View style={styles.integrityHeader}>
            <View style={[styles.integrityGlyph, { backgroundColor: verifiedDownloadAvailable ? palette.tealMuted : "#38241A" }]}>
              <IconSymbol name={verifiedDownloadAvailable ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"} size={19} color={verifiedDownloadAvailable ? palette.teal : palette.amber} />
            </View>
            <View style={styles.integrityCopy}>
              <Text style={styles.cardHeading}>Verified APK download</Text>
              <Text style={styles.integrityDetail}>{verifiedDownloadAvailable ? "Scan this code on your Android device to open the signed APK download, then compare its SHA-256 before installing." : "The QR code remains disabled until this release includes both a public HTTPS APK link and the matching published SHA-256."}</Text>
            </View>
          </View>
          {verifiedDownloadAvailable ? <>
            <View style={styles.qrWrap}><Image accessibilityLabel="QR code for verified APK download" source={{ uri: verifiedApkQrUrl(latest.apkIntegrity.verifiedDownloadUrl) }} style={styles.qrImage} /><Text style={styles.qrCaption}>Scan to open verified download</Text></View>
            <QuietButton label="Open verified download" onPress={openVerifiedDownload} icon="chevron.right" />
          </> : <Text style={styles.pendingNote}>Publish the signed APK, calculate and publish its SHA-256, then add the matching HTTPS download URL to the release manifest. The QR code will activate automatically.</Text>}
        </Card>

        <View style={styles.section}><Text style={styles.sectionLabel}>WHAT&apos;S NEW</Text>{latest.notes.map((note, index) => <View key={note} style={styles.noteRow}><View style={styles.noteIndex}><Text style={styles.noteIndexText}>{index + 1}</Text></View><Text style={styles.noteText}>{note}</Text></View>)}</View>

        <Card style={styles.installCard}>
          <Text style={styles.cardHeading}>Install an APK update</Text>
          <Text style={styles.installText}>Open the latest project checkpoint in the workspace, choose Publish, then select Android APK. Download the completed APK on your Android device and confirm the system installation prompt. The app never downloads or installs an APK automatically.</Text>
        </Card>
        <QuietButton label="Open system test" onPress={() => router.push("/system-test")} icon="checkmark.shield" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 14, backgroundColor: palette.base },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  topTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  eyebrow: { color: palette.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 4 },
  title: { color: palette.text, fontSize: 28, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: -8 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: -5 },
  currentCard: { gap: 13, backgroundColor: "#0F2A1F", borderColor: "#1E5C3A" },
  updateCard: { gap: 13, backgroundColor: "#2A2010", borderColor: "#5C461A" },
  statusTop: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  statusGlyph: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1 },
  statusTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  statusDetail: { color: "#B6C5D2", fontSize: 12, lineHeight: 17, marginTop: 3 },
  statusMeta: { borderTopWidth: 1, borderTopColor: "#244139", paddingTop: 9 },
  statusMetaText: { color: "#9CB2A7", fontSize: 11 },
  errorCard: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#2A0F14", borderColor: "#5C1E27" },
  errorText: { flex: 1, color: "#F4B8BE", fontSize: 12, lineHeight: 17 },
  versionCard: { gap: 11, backgroundColor: "#101C27" },
  cardHeading: { color: palette.text, fontSize: 14, fontWeight: "800" },
  versionRow: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center" },
  versionLabel: { color: "#74869A", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  versionValue: { flex: 1, color: "#D9E5F0", fontSize: 12, fontWeight: "700", textAlign: "right" },
  integrityCard: { gap: 11, backgroundColor: "#10251F", borderColor: "#1E5C3A" },
  integrityPendingCard: { gap: 11, backgroundColor: "#2A2010", borderColor: "#5C461A" },
  integrityHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  integrityGlyph: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  integrityCopy: { flex: 1 },
  integrityDetail: { color: "#B6C5D2", fontSize: 12, lineHeight: 17, marginTop: 3 },
  integrityRow: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center" },
  integrityValue: { flex: 1, color: "#D9E5F0", fontSize: 12, fontWeight: "700", textAlign: "right" },
  hashBox: { gap: 6, borderWidth: 1, borderColor: "#284255", borderRadius: 12, padding: 10, backgroundColor: "#0D1823" },
  hashLabel: { color: "#74869A", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  hashValue: { color: "#CDE1EF", fontSize: 11, lineHeight: 16, fontFamily: "monospace" },
  hashPending: { color: "#E9C98F", fontFamily: undefined },
  pendingNote: { color: "#E9C98F", fontSize: 12, lineHeight: 17 },
  verifyCard: { gap: 9, backgroundColor: "#142833", borderColor: "#214A53" },
  verifyText: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  commandText: { color: palette.teal, fontSize: 12, fontFamily: "monospace", backgroundColor: "#0D1823", borderRadius: 9, padding: 10 },
  qrCard: { gap: 11, backgroundColor: "#10251F", borderColor: "#1E5C3A" },
  qrPendingCard: { gap: 11, backgroundColor: "#2A2010", borderColor: "#5C461A" },
  qrWrap: { alignItems: "center", gap: 9, paddingVertical: 4 },
  qrImage: { width: 190, height: 190, backgroundColor: "#FFFFFF", borderRadius: 12 },
  qrCaption: { color: "#A5CDB5", fontSize: 12, fontWeight: "700" },
  section: { gap: 8 },
  sectionLabel: { color: "#AEBCC9", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  noteIndex: { width: 20, height: 20, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: palette.tealMuted },
  noteIndexText: { color: palette.teal, fontSize: 11, fontWeight: "800" },
  noteText: { flex: 1, color: "#B6C5D2", fontSize: 12, lineHeight: 18 },
  installCard: { gap: 6, backgroundColor: "#142833", borderColor: "#214A53" },
  installText: { color: palette.muted, fontSize: 12, lineHeight: 18 },
});
