import { View } from "react-native";

import type { DashKpi, DashQueueItem, DashRow } from "@kaenal/types";

import { useTheme } from "@/theme";
import { Card, Icon, Mono, Row, Sev, StatusPill, Text, type IconName, type SevLevel, type StatusTone } from "@/ui";

// ── Formatters (server sends data; the client formats copy) ───────────────────

/** Relative due label from an ISO timestamp, e.g. "Due 2h" / "Overdue 1d". */
export function formatDue(dueAt: string | null, overdue: boolean): string | null {
  if (dueAt === null) return null;
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  const mag = abs < 3_600_000 ? "now" : abs < 86_400_000 ? `${h}h` : `${d}d`;
  if (overdue) return mag === "now" ? "Overdue" : `Overdue ${mag}`;
  return mag === "now" ? "Due now" : `Due ${mag}`;
}

const KPI_TONE = {
  default: "text",
  danger: "danger",
  warn: "warn",
  success: "success",
} as const;

// ── KPI stat tile + row (m-home.jsx Kpi) ──────────────────────────────────────
export function Kpi({ kpi }: { kpi: DashKpi }) {
  const { palette } = useTheme();
  const toneKey = KPI_TONE[kpi.tone];
  const valueColor =
    toneKey === "danger" ? palette.dangerFg : toneKey === "warn" ? palette.warnFg : toneKey === "success" ? palette.successFg : palette.text;
  return (
    <Card style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Text size={11} weight="semibold" tone="muted" numberOfLines={1}>
        {kpi.label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <Text size={26} weight="bold" color={valueColor} style={{ letterSpacing: -0.5 }}>
          {kpi.value ?? "—"}
        </Text>
        {kpi.delta !== undefined && (
          <Text size={11} weight="semibold" tone="muted">
            {kpi.delta}
          </Text>
        )}
      </View>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: DashKpi[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
      {kpis.map((k) => (
        <Kpi key={k.label} kpi={k} />
      ))}
    </View>
  );
}

// ── Work-queue item (m-home.jsx QueueItem) ────────────────────────────────────
export function QueueItemView({ item, last }: { item: DashQueueItem; last: boolean }) {
  const { palette } = useTheme();
  const due = formatDue(item.dueAt, item.overdue);
  return (
    <View
      style={{
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <Mono size={10.5} weight="bold" color={palette.muted}>
          {item.code}
        </Mono>
        {item.sev !== undefined && <Sev level={item.sev as SevLevel} />}
        <View style={{ flex: 1 }} />
        {due !== null && (
          <Text size={11.5} weight="semibold" color={item.overdue ? palette.dangerFg : palette.muted}>
            {due}
          </Text>
        )}
      </View>
      <Text size={14.5} weight="semibold" style={{ lineHeight: 19 }}>
        {item.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Icon name="mapPin" size={12} color={palette.muted} />
          <Text size={11.5} tone="muted">
            {item.site}
          </Text>
        </View>
        <Text size={11.5} tone="muted">
          ·
        </Text>
        <Text size={11.5} tone="muted">
          {item.meta}
        </Text>
      </View>
    </View>
  );
}

// ── DashRow → shared Row + status pill ────────────────────────────────────────
export function DashRowView({ row, last, onPress }: { row: DashRow; last: boolean; onPress?: () => void }) {
  const { palette } = useTheme();
  const toneColor =
    row.iconTone === "danger"
      ? "#ea580c"
      : row.iconTone === "info"
        ? palette.info
        : row.iconTone === "success"
          ? palette.success
          : row.iconTone === "warn"
            ? palette.warn
            : row.iconTone === "muted"
              ? palette.muted
              : palette.accent;
  return (
    <Row
      icon={row.icon as IconName}
      iconTone={toneColor}
      title={row.title}
      sub={row.sub}
      last={last}
      chevron
      onPress={onPress}
      right={row.status ? <StatusPill tone={row.status.tone as StatusTone}>{row.status.label}</StatusPill> : undefined}
    />
  );
}
