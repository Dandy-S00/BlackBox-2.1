import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { palette } from "@/components/workspace-ui";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  show: (kind: ToastKind, title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const TOAST_COLORS: Record<ToastKind, { bg: string; border: string; icon: string; iconName: Parameters<typeof IconSymbol>[0]["name"] }> = {
  success: { bg: "#0F2A1F", border: "#1E5C3A", icon: "#74D6A1", iconName: "checkmark.circle.fill" },
  error:   { bg: "#2A0F14", border: "#5C1E27", icon: palette.rose, iconName: "exclamationmark.triangle.fill" },
  warning: { bg: "#2A1E08", border: "#5C4010", icon: palette.amber, iconName: "exclamationmark.triangle.fill" },
  info:    { bg: "#0F1E2E", border: "#1D3A4A", icon: palette.teal, iconName: "info.circle.fill" },
};

const AUTO_DISMISS_MS = 4500;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  // Animate in, then auto-dismiss
  const startDismiss = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      onDismiss(toast.id);
    });
  }, [opacity, onDismiss, toast.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(startDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [opacity, startDismiss, translateY]);

  const colors = TOAST_COLORS[toast.kind];

  return (
    <Animated.View style={[styles.toast, { backgroundColor: colors.bg, borderColor: colors.border, opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastRow}>
        <IconSymbol name={colors.iconName} size={17} color={colors.icon} />
        <View style={styles.toastBody}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.detail ? <Text style={styles.toastDetail}>{toast.detail}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => startDismiss()}
          style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}>
          <IconSymbol name="xmark.circle" size={16} color={palette.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const show = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = `toast-${Date.now()}-${counterRef.current++}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, title, detail }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={styles.container}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 56, left: 16, right: 16, gap: 8, zIndex: 9999, pointerEvents: "box-none" },
  toast: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.30)", elevation: 8 },
  toastRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  toastBody: { flex: 1 },
  toastTitle: { color: palette.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  toastDetail: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  dismissBtn: { padding: 2 },
});
