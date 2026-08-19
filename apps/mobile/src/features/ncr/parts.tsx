import { Pressable, View } from "react-native";

import type { NcrDto, NcrPriority, NcrStatus } from "@kaenal/types";

import { useTheme } from "@/theme";
import { Card, Icon, Mono, Sev, StatusPill, Text, type SevLevel, type StatusTone } from "@/ui";

export function severityOf(priority: NcrPriority): SevLevel {
  return priority === "critical" ? "critical" : priority === "major" ? "major" : "minor";
}

export function ncrStatusTone(status: NcrStatus): StatusTone {
  switch (status) {
    case "closed":
    case "verified":
      return "done";
    case "resolved":
      return "verify";
    case "assigned":
    case "in_progress":
      return "progress";
    case "escalated":
    case "reopened":
      return "danger";
    case "draft":
      return "neutral";
    default:
      return "open";
  }
}

export function ncrStatusLabel(status: NcrStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

/** Relative due label from an ISO timestamp. */
export function ncrDue(dueAt: string | null): { text: string; overdue: boolean } | null {
  if (dueAt === null) return null;
  const diff = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(diff);
  const d = Math.round(abs / 86_400_000);
  const h = Math.round(abs / 3_600_000);
  const mag = abs < 86_400_000 ? `${h}h` : `${d}d`;
  return diff < 0 ? { text: `Overdue ${mag}`, overdue: true } : { text: `Due ${mag}`, overdue: false };
}

export function NcrCard({ ncr, onPress }: { ncr: NcrDto; onPress: () => void }) {
  const { palette } = useTheme();
  const due = ncrDue(ncr.dueAt);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Card style={{ marginHorizontal: 16, marginTop: 10, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <Mono size={10.5} weight="bold" color={palette.muted}>
            {ncr.code}
          </Mono>
          <Sev level={severityOf(ncr.priority)} />
          <View style={{ flex: 1 }} />
          <StatusPill tone={ncrStatusTone(ncr.status)} size="sm">
            {ncrStatusLabel(ncr.status)}
          </StatusPill>
        </View>
        <Text size={15} weight="semibold" style={{ lineHeight: 20 }}>
          {ncr.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {ncr.eightDId && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Icon name="brain" size={12} color={palette.info} />
                <Text size={11.5} weight="semibold" color={palette.info}>
                  8D
                </Text>
              </View>
              <Text size={11.5} tone="muted">
                ·
              </Text>
            </>
          )}
          <Text size={11.5} tone={due?.overdue ? "text" : "muted"} color={due?.overdue ? palette.dangerFg : undefined}>
            {due ? due.text : ncr.slaState === "breached" ? "SLA breached" : "No due date"}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
