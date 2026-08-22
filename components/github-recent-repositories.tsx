import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { palette } from "@/components/workspace-ui";
import { getRepo, fmtRelative, type GHRepo } from "@/lib/github-api";
import {
  clearRecentGitHubRepos,
  getRecentGitHubRepos,
  type RecentGitHubRepo,
} from "@/lib/github-history";
import { useToast } from "@/lib/toast";

export function RecentRepositories({ onSelect }: { onSelect: (repo: GHRepo) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<RecentGitHubRepo[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    void getRecentGitHubRepos().then(setItems);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((repo) =>
      [repo.fullName, repo.description ?? "", repo.language ?? "", repo.defaultBranch]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [items, query]);

  const open = async (recent: RecentGitHubRepo) => {
    setLoading(recent.fullName);
    try {
      const freshRepo = await getRepo(recent.fullName);
      onSelect(freshRepo);
    } catch {
      toast.show("error", "Could not reload repository", "Check your connection or GitHub access and try again.");
    } finally {
      setLoading(null);
    }
  };

  const clear = () => {
    void clearRecentGitHubRepos().then(() => {
      setItems([]);
      toast.show("success", "Recent repositories cleared", "This device no longer stores GitHub loading history.");
    }).catch(() => toast.show("error", "Could not clear history", "Please try again."));
  };

  if (!items.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Recent repositories</Text>
          <Text style={styles.subtitle}>Reload a project you opened on this device.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear recent repositories" onPress={clear}
          style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.65 }]}>
          <IconSymbol name="trash" size={13} color={palette.muted} />
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <IconSymbol name="magnifyingglass" size={15} color={palette.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter recent projects…"
          placeholderTextColor="#4A6070"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {filtered.length ? filtered.map((repo) => (
          <Pressable key={repo.fullName} accessibilityRole="button" accessibilityLabel={`Reload ${repo.fullName}`}
            disabled={loading === repo.fullName} onPress={() => void open(repo)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            <View style={styles.rowCopy}>
              <Text style={styles.name} numberOfLines={1}>{repo.fullName}</Text>
              <View style={styles.meta}>
                {repo.language ? <Text style={styles.language}>{repo.language}</Text> : null}
                <Text style={styles.metaText}>Opened {fmtRelative(repo.lastAccessedAt)}</Text>
              </View>
            </View>
            {loading === repo.fullName
              ? <ActivityIndicator size="small" color={palette.teal} />
              : <IconSymbol name="chevron.right" size={16} color={palette.muted} />}
          </Pressable>
        )) : <Text style={styles.empty}>No recent repositories match this filter.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, marginBottom: 12, padding: 13, gap: 10, borderWidth: 1, borderColor: "#1D3A4A", borderRadius: 15, backgroundColor: "#0F1E2E" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  headerCopy: { flex: 1 },
  title: { color: palette.text, fontSize: 14, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  clearButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingLeft: 4 },
  clearText: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  searchWrap: { height: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  searchInput: { flex: 1, color: palette.text, fontSize: 12 },
  list: { maxHeight: 214 },
  row: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#1D2D3C" },
  rowCopy: { flex: 1, gap: 3 },
  name: { color: "#D9E5F0", fontSize: 12, fontWeight: "800" },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  language: { color: palette.teal, fontSize: 10, fontWeight: "700" },
  metaText: { color: "#74869A", fontSize: 10 },
  empty: { color: palette.muted, fontSize: 11, textAlign: "center", paddingVertical: 13 },
});
