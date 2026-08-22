/**
 * GitHub App Loader — search public GitHub repos, browse releases and branches,
 * and queue a repo as an analysis target in a BlackBox workspace.
 */
import { router } from "expo-router";
import {
  ActivityIndicator, FlatList, Pressable, ScrollView,
  Linking, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecentRepositories } from "@/components/github-recent-repositories";
import {
  Card, LoadingView, PrimaryButton, palette,
} from "@/components/workspace-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/lib/toast";
import {
  GHRepo, GHRelease, GHBranch,
  searchRepos, listReleases, listBranches,
  fmtBytes, fmtRelative,
} from "@/lib/github-api";
import { recordRecentGitHubRepo } from "@/lib/github-history";

// ── Types ────────────────────────────────────────────────────────────────────
type ScreenView = "search" | "detail";
type Tab  = "releases" | "branches";

// ── Helpers ──────────────────────────────────────────────────────────────────
function LanguageDot({ lang }: { lang: string | null }) {
  const LANG_COLOR: Record<string, string> = {
    TypeScript: "#3178C6", JavaScript: "#F7DF1E", Python: "#3572A5",
    Kotlin: "#A97BFF", Swift: "#F05138", Java: "#B07219",
    "C++": "#F34B7D", C: "#555555", Go: "#00ADD8", Rust: "#DEA584",
    Ruby: "#701516", Shell: "#89E051",
  };
  if (!lang) return null;
  const color = LANG_COLOR[lang] ?? palette.muted;
  return (
    <View style={styles.langRow}>
      <View style={[styles.langDot, { backgroundColor: color }]} />
      <Text style={styles.langText}>{lang}</Text>
    </View>
  );
}

// ── Search view ──────────────────────────────────────────────────────────────
function SearchView({
  onSelect,
}: {
  onSelect: (repo: GHRepo) => void;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const items = await searchRepos(q, 25);
      setResults(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <View style={sv.container}>
      {/* Search bar */}
      <View style={sv.bar}>
        <View style={sv.inputWrap}>
          <IconSymbol name="magnifyingglass" size={18} color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void doSearch()}
            placeholder="Search GitHub repositories…"
            placeholderTextColor="#4A6070"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={sv.input}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setResults([]); setSearched(false); }}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <IconSymbol name="xmark.circle" size={17} color={palette.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => void doSearch()}
          disabled={loading || !query.trim()}
          style={({ pressed }) => [sv.searchBtn, (loading || !query.trim()) && sv.searchBtnDisabled, pressed && { opacity: 0.8 }]}>
          {loading
            ? <ActivityIndicator size="small" color={palette.base} />
            : <Text style={sv.searchBtnText}>Search</Text>}
        </Pressable>
      </View>

      {/* Error */}
      {error ? (
        <Card style={sv.errorCard}>
          <IconSymbol name="exclamationmark.triangle.fill" size={15} color={palette.rose} />
          <Text style={sv.errorText}>{error}</Text>
        </Card>
      ) : null}

      <RecentRepositories onSelect={onSelect} />

      {/* Results */}
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={sv.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.full_name}`}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [sv.repoCard, pressed && { opacity: 0.75 }]}>
              <View style={sv.repoTop}>
                <Text style={sv.repoName} numberOfLines={1}>{item.full_name}</Text>
                <IconSymbol name="chevron.right" size={16} color={palette.muted} />
              </View>
              {item.description ? (
                <Text style={sv.repoDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <View style={sv.repoMeta}>
                <LanguageDot lang={item.language} />
                <View style={sv.metaItem}>
                  <IconSymbol name="star.fill" size={12} color="#F3B34C" />
                  <Text style={sv.metaText}>{item.stargazers_count.toLocaleString()}</Text>
                </View>
                <View style={sv.metaItem}>
                  <IconSymbol name="tuningfork" size={12} color={palette.muted} />
                  <Text style={sv.metaText}>{item.forks_count.toLocaleString()}</Text>
                </View>
                <Text style={sv.metaText}>{fmtRelative(item.pushed_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      ) : searched && !loading ? (
        <View style={sv.empty}>
          <Text style={sv.emptyText}>No repositories found for {query}.</Text>
        </View>
      ) : !searched ? (
        <View style={sv.hint}>
          <IconSymbol name="magnifyingglass" size={32} color={palette.border} />
          <Text style={sv.hintText}>Search public GitHub repositories by name, topic, or owner.</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Detail view ──────────────────────────────────────────────────────────────
function DetailView({
  repo,
  onBack,
  onQueue,
}: {
  repo: GHRepo;
  onBack: () => void;
  onQueue: (repo: GHRepo, ref: string, kind: "release" | "branch") => void;
}) {
  const toast = useToast();
  const [tab, setTab]               = useState<Tab>("releases");
  const [releases, setReleases]     = useState<GHRelease[] | null>(null);
  const [branches, setBranches]     = useState<GHBranch[] | null>(null);
  const [loadingRel, setLoadingRel] = useState(false);
  const [loadingBr,  setLoadingBr]  = useState(false);
  const [relError,   setRelError]   = useState<string | null>(null);
  const [brError,    setBrError]    = useState<string | null>(null);
  const [selected,   setSelected]   = useState<{ ref: string; kind: "release" | "branch" } | null>(null);

  const loadReleases = useCallback(async () => {
    if (releases !== null) return;
    setLoadingRel(true); setRelError(null);
    try { setReleases(await listReleases(repo.full_name)); }
    catch (e) { setRelError(e instanceof Error ? e.message : "Failed to load releases."); }
    finally { setLoadingRel(false); }
  }, [releases, repo.full_name]);

  const loadBranches = useCallback(async () => {
    if (branches !== null) return;
    setLoadingBr(true); setBrError(null);
    try { setBranches(await listBranches(repo.full_name)); }
    catch (e) { setBrError(e instanceof Error ? e.message : "Failed to load branches."); }
    finally { setLoadingBr(false); }
  }, [branches, repo.full_name]);

  // Load the active tab on first switch
  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "releases") void loadReleases();
    else void loadBranches();
  };

  // Load releases immediately on mount
  useState(() => { void loadReleases(); });

  const copyAssetUrl = async (name: string, url: string) => {
    await Clipboard.setStringAsync(url);
    toast.show("success", "Download URL copied", `${name} is ready to paste.`);
  };

  const openAssetUrl = async (name: string, url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("Unsupported URL");
      await Linking.openURL(url);
    } catch {
      toast.show("error", "Could not open link", `Copy ${name}'s URL and open it manually.`);
    }
  };

  return (
    <ScrollView contentContainerStyle={dv.content} keyboardShouldPersistTaps="handled">
      {/* Back */}
      <Pressable accessibilityRole="button" accessibilityLabel="Back to search"
        onPress={onBack} style={({ pressed }) => [dv.backBtn, pressed && { opacity: 0.7 }]}>
        <IconSymbol name="chevron.left" size={18} color={palette.teal} />
        <Text style={dv.backText}>Search results</Text>
      </Pressable>

      {/* Repo header */}
      <View style={dv.header}>
        <Text style={dv.repoFullName}>{repo.full_name}</Text>
        {repo.description ? <Text style={dv.repoDesc}>{repo.description}</Text> : null}
        <View style={dv.metaRow}>
          <LanguageDot lang={repo.language} />
          <View style={dv.metaItem}>
            <IconSymbol name="star.fill" size={13} color="#F3B34C" />
            <Text style={dv.metaText}>{repo.stargazers_count.toLocaleString()}</Text>
          </View>
          <View style={dv.metaItem}>
            <IconSymbol name="tuningfork" size={13} color={palette.muted} />
            <Text style={dv.metaText}>{repo.forks_count.toLocaleString()}</Text>
          </View>
          {repo.license ? (
            <View style={dv.metaItem}>
              <IconSymbol name="doc.text" size={13} color={palette.muted} />
              <Text style={dv.metaText}>{repo.license.spdx_id}</Text>
            </View>
          ) : null}
          <Text style={dv.metaText}>{fmtBytes(repo.size)}</Text>
        </View>
        {repo.topics.length > 0 ? (
          <View style={dv.topics}>
            {repo.topics.slice(0, 6).map((t) => (
              <View key={t} style={dv.topic}><Text style={dv.topicText}>{t}</Text></View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Tab bar */}
      <View style={dv.tabBar}>
        {(["releases", "branches"] as Tab[]).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
            onPress={() => switchTab(t)}
            style={[dv.tabBtn, tab === t && dv.tabBtnActive]}>
            <IconSymbol
              name={t === "releases" ? "tag.fill" : "arrow.branch"}
              size={14}
              color={tab === t ? palette.teal : palette.muted}
            />
            <Text style={[dv.tabText, tab === t && dv.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Releases tab */}
      {tab === "releases" && (
        loadingRel ? <ActivityIndicator color={palette.teal} style={{ marginTop: 24 }} /> :
        relError   ? <Text style={dv.errText}>{relError}</Text> :
        releases && releases.length === 0 ? (
          <Text style={dv.emptyText}>No releases published yet. Try the Branches tab.</Text>
        ) : (
          releases?.map((rel) => {
            const sel = selected?.ref === rel.tag_name && selected.kind === "release";
            return (
              <Pressable key={rel.id} accessibilityRole="button"
                onPress={() => setSelected(sel ? null : { ref: rel.tag_name, kind: "release" })}
                style={[dv.item, sel && dv.itemSelected]}>
                <View style={dv.itemTop}>
                  <View style={dv.itemLeft}>
                    <IconSymbol name="tag.fill" size={14} color={rel.prerelease ? palette.amber : palette.teal} />
                    <Text style={dv.itemTitle}>{rel.tag_name}</Text>
                    {rel.prerelease && <View style={dv.preBadge}><Text style={dv.preBadgeText}>pre</Text></View>}
                  </View>
                  {sel && <IconSymbol name="checkmark.circle.fill" size={18} color={palette.teal} />}
                </View>
                {rel.name && rel.name !== rel.tag_name ? (
                  <Text style={dv.itemSub} numberOfLines={1}>{rel.name}</Text>
                ) : null}
                <Text style={dv.itemMeta}>{fmtRelative(rel.published_at)}</Text>
                {rel.assets.length > 0 ? (
                  <View style={dv.assetList}>
                    {rel.assets.map((a) => (
                      <View key={a.name} style={dv.assetCard}>
                        <View style={dv.assetInfo}>
                          <IconSymbol name="doc.zipper" size={14} color={palette.muted} />
                          <View style={dv.assetNameWrap}>
                            <Text style={dv.assetText} numberOfLines={1}>{a.name}</Text>
                            <Text style={dv.assetSize}>{fmtBytes(Math.max(1, Math.round(a.size / 1024)))}</Text>
                          </View>
                        </View>
                        <View style={dv.assetActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Copy download URL for ${a.name}`}
                            onPress={() => void copyAssetUrl(a.name, a.browser_download_url)}
                            style={({ pressed }) => [dv.assetAction, pressed && { opacity: 0.65 }]}>
                            <IconSymbol name="doc.text" size={14} color={palette.teal} />
                            <Text style={dv.assetActionText}>Copy</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${a.name} in browser`}
                            onPress={() => void openAssetUrl(a.name, a.browser_download_url)}
                            style={({ pressed }) => [dv.assetAction, pressed && { opacity: 0.65 }]}>
                            <IconSymbol name="arrow.up.right.square" size={14} color={palette.teal} />
                            <Text style={dv.assetActionText}>Open</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )
      )}

      {/* Branches tab */}
      {tab === "branches" && (
        loadingBr ? <ActivityIndicator color={palette.teal} style={{ marginTop: 24 }} /> :
        brError   ? <Text style={dv.errText}>{brError}</Text> :
        branches?.map((br) => {
          const sel = selected?.ref === br.name && selected.kind === "branch";
          return (
            <Pressable key={br.name} accessibilityRole="button"
              onPress={() => setSelected(sel ? null : { ref: br.name, kind: "branch" })}
              style={[dv.item, sel && dv.itemSelected]}>
              <View style={dv.itemTop}>
                <View style={dv.itemLeft}>
                  <IconSymbol name="arrow.branch" size={14} color={br.name === repo.default_branch ? palette.teal : palette.muted} />
                  <Text style={dv.itemTitle}>{br.name}</Text>
                  {br.name === repo.default_branch && (
                    <View style={dv.defaultBadge}><Text style={dv.defaultBadgeText}>default</Text></View>
                  )}
                  {br.protected && (
                    <View style={dv.protectedBadge}><Text style={dv.protectedBadgeText}>protected</Text></View>
                  )}
                </View>
                {sel && <IconSymbol name="checkmark.circle.fill" size={18} color={palette.teal} />}
              </View>
              <Text style={dv.itemMeta}>{br.commit.sha.slice(0, 7)}</Text>
            </Pressable>
          );
        })
      )}

      {/* Queue action */}
      {selected ? (
        <View style={dv.queueSection}>
          <Card style={dv.queueCard}>
            <Text style={dv.queueTitle}>Queue as analysis target</Text>
            <Text style={dv.queueDetail}>
              This will pre-fill a new analysis record with{" "}
              <Text style={{ color: palette.teal }}>{repo.full_name}@{selected.ref}</Text>
              {" "}as the local target reference. You will choose the workspace and modules on the next screen.
            </Text>
          </Card>
          <PrimaryButton
            label={`Queue ${selected.kind === "release" ? "release" : "branch"} as target`}
            onPress={() => onQueue(repo, selected.ref, selected.kind)}
            icon="play.fill"
          />
        </View>
      ) : (
        <View style={dv.selectHint}>
          <Text style={dv.selectHintText}>
            Select a release or branch above to queue it as an analysis target.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function GitHubLoaderScreen() {
  const { ready } = useWorkspace();
  const toast = useToast();
  const [view, setView]     = useState<ScreenView>("search");
  const [repo, setRepo]     = useState<GHRepo | null>(null);

  if (!ready) return <LoadingView />;

  const handleQueue = (r: GHRepo, ref: string, kind: "release" | "branch") => {
    // Build a reference string: "owner/repo@ref (release|branch)"
    const reference = `${r.full_name}@${ref} (${kind})`;
    toast.show("success", "Target queued", `${r.full_name}@${ref} ready to add as analysis target.`);
    // Navigate to new analysis with the reference pre-filled via query param
    router.push({
      pathname: "/analysis/new",
      params: { prefillReference: reference },
    });
  };

  const selectRepo = (nextRepo: GHRepo) => {
    void recordRecentGitHubRepo(nextRepo).catch(() => undefined);
    setRepo(nextRepo);
    setView("detail");
  };

  return (
    <ScreenContainer containerClassName="bg-[#101620]" safeAreaClassName="bg-[#101620]">
      {/* Header */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back"
          onPress={() => { if (view === "detail") { setView("search"); setRepo(null); } else router.back(); }}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}>
          <IconSymbol name="chevron.left" size={21} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.eyebrow}>GITHUB APP LOADER</Text>
          <Text style={styles.title}>{view === "detail" && repo ? repo.name : "Load from GitHub"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="GitHub access settings"
          onPress={() => router.push("/github-settings")}
          style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.7 }]}>
          <IconSymbol name="gearshape" size={19} color={palette.teal} />
        </Pressable>
      </View>

      {view === "search" ? (
        <SearchView onSelect={selectRepo} />
      ) : repo ? (
        <DetailView
          repo={repo}
          onBack={() => { setView("search"); setRepo(null); }}
          onQueue={handleQueue}
        />
      ) : null}
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  settingsButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1D3A4A", backgroundColor: "#0F1E2E" },
  headerTitle: { flex: 1 },
  eyebrow: { color: palette.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginTop: 1 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  langDot: { width: 10, height: 10, borderRadius: 5 },
  langText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
});

const sv = StyleSheet.create({
  container: { flex: 1 },
  bar: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, color: palette.text, fontSize: 14 },
  searchBtn: { height: 46, paddingHorizontal: 16, borderRadius: 14, backgroundColor: palette.teal, alignItems: "center", justifyContent: "center" },
  searchBtnDisabled: { backgroundColor: "#3A5060" },
  searchBtnText: { color: palette.base, fontSize: 14, fontWeight: "800" },
  errorCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginHorizontal: 20, backgroundColor: "#2A0F14", borderColor: "#5C1E27" },
  errorText: { color: palette.rose, fontSize: 13, lineHeight: 18, flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 0 },
  repoCard: { padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 16, gap: 6 },
  repoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  repoName: { color: palette.text, fontSize: 14, fontWeight: "800", flex: 1 },
  repoDesc: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  repoMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { color: palette.muted, fontSize: 14 },
  hint: { alignItems: "center", paddingTop: 60, gap: 14, paddingHorizontal: 40 },
  hintText: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});

const dv = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  backText: { color: palette.teal, fontSize: 14, fontWeight: "700" },
  header: { gap: 6 },
  repoFullName: { color: palette.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  repoDesc: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  topic: { backgroundColor: "#0F2030", borderWidth: 1, borderColor: "#1D3A4A", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  topicText: { color: palette.teal, fontSize: 11, fontWeight: "700" },
  tabBar: { flexDirection: "row", gap: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  tabBtnActive: { borderColor: palette.teal, backgroundColor: palette.tealMuted },
  tabText: { color: palette.muted, fontSize: 13, fontWeight: "800" },
  tabTextActive: { color: palette.teal },
  item: { padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14, gap: 5 },
  itemSelected: { borderColor: palette.teal, backgroundColor: "#0F2A25" },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  itemTitle: { color: palette.text, fontSize: 14, fontWeight: "800", flex: 1 },
  itemSub: { color: palette.muted, fontSize: 12 },
  itemMeta: { color: "#4A6070", fontSize: 11 },
  preBadge: { backgroundColor: "#3A2408", borderWidth: 1, borderColor: "#5C3A10", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  preBadgeText: { color: palette.amber, fontSize: 10, fontWeight: "800" },
  defaultBadge: { backgroundColor: palette.tealMuted, borderWidth: 1, borderColor: "#2B5C52", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { color: palette.teal, fontSize: 10, fontWeight: "800" },
  protectedBadge: { backgroundColor: "#2A1E08", borderWidth: 1, borderColor: "#4A3A10", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  protectedBadgeText: { color: palette.amber, fontSize: 10, fontWeight: "800" },
  assetList: { gap: 7, marginTop: 4 },
  assetCard: { backgroundColor: "#101C27", borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 9, gap: 8 },
  assetInfo: { flexDirection: "row", alignItems: "center", gap: 7 },
  assetNameWrap: { flex: 1, minWidth: 0 },
  assetText: { color: "#C9D7E5", fontSize: 11, fontWeight: "700" },
  assetSize: { color: "#74869A", fontSize: 10, marginTop: 1 },
  assetActions: { flexDirection: "row", gap: 7 },
  assetAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 31, borderRadius: 8, borderWidth: 1, borderColor: "#24505A", backgroundColor: "#0F2030" },
  assetActionText: { color: palette.teal, fontSize: 11, fontWeight: "800" },
  queueSection: { gap: 12, marginTop: 8 },
  queueCard: { backgroundColor: "#0F2030", borderColor: "#1D3A4A", gap: 8 },
  queueTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  queueDetail: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  selectHint: { alignItems: "center", paddingTop: 12 },
  selectHintText: { color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: "center" },
  errText: { color: palette.rose, fontSize: 13, lineHeight: 18, marginTop: 12 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 12, textAlign: "center" },
});
