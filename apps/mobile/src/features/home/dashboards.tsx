import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { DashAuditItem, DashboardDto, DashTeamMember } from "@kaenal/types";

import { useTheme } from "@/theme";
import { Avatar, Card, Icon, Mono, SectionLabel, Text } from "@/ui";

import { DashRowView, KpiRow, QueueItemView } from "./parts";

/** Section eyebrow with an optional trailing "See all" affordance. */
function SectionHeader({ children, action }: { children: ReactNode; action?: { label: string; onPress?: () => void } }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 8,
      }}
    >
      <SectionLabel>{children}</SectionLabel>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={6}>
          <Text size={12.5} weight="semibold" color={palette.accent}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Discriminated dispatch — renders the body for the caller's dashboard variant. */
export function DashboardBody({ data }: { data: DashboardDto }) {
  switch (data.variant) {
    case "inspector":
      return <InspectorBody data={data} />;
    case "viewer":
      return <ViewerBody data={data} />;
    case "manager":
      return <ManagerBody data={data} />;
    case "admin":
      return <AdminBody data={data} />;
  }
}

// ── Inspector ─────────────────────────────────────────────────────────────────
function InspectorBody({ data }: { data: Extract<DashboardDto, { variant: "inspector" }> }) {
  return (
    <>
      <KpiRow kpis={data.kpis} />
      <SectionHeader action={{ label: "See all" }}>Today's work queue</SectionHeader>
      <Card style={{ marginHorizontal: 16 }}>
        {data.queue.length === 0 ? (
          <QueueEmpty label="No inspections in your queue" />
        ) : (
          data.queue.map((it, i, a) => <QueueItemView key={it.ref.id} item={it} last={i === a.length - 1} />)
        )}
      </Card>
      {data.assigned.length > 0 && (
        <>
          <SectionHeader>Assigned to me</SectionHeader>
          <Card style={{ marginHorizontal: 16 }}>
            {data.assigned.map((r, i, a) => (
              <DashRowView key={r.ref.id} row={r} last={i === a.length - 1} />
            ))}
          </Card>
        </>
      )}
      <View style={{ height: 16 }} />
    </>
  );
}

// ── Viewer (+ auditor) ──────────────────────────────────────────────────────────
function ViewerBody({ data }: { data: Extract<DashboardDto, { variant: "viewer" }> }) {
  const { palette, radius } = useTheme();
  return (
    <>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: radius.full,
            backgroundColor: palette.bgSubtle,
          }}
        >
          <Icon name="eye" size={13} color={palette.muted} />
          <Text size={11.5} weight="semibold" tone="muted">
            Read-only access
          </Text>
        </View>
      </View>
      <KpiRow kpis={data.kpis} />
      <SectionHeader>Recent records</SectionHeader>
      <Card style={{ marginHorizontal: 16 }}>
        {data.recent.length === 0 ? (
          <QueueEmpty label="No records yet" />
        ) : (
          data.recent.map((r, i, a) => <DashRowView key={r.ref.id} row={r} last={i === a.length - 1} />)
        )}
      </Card>
      <Card style={{ margin: 16, backgroundColor: palette.bgSubtle, borderWidth: 0 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14 }}>
          <Icon name="info" size={18} color={palette.muted} />
          <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
            Your role can view records but not perform, create or approve. Actions are hidden accordingly.
          </Text>
        </View>
      </Card>
    </>
  );
}

// ── Manager ───────────────────────────────────────────────────────────────────
function ManagerBody({ data }: { data: Extract<DashboardDto, { variant: "manager" }> }) {
  const { palette, radius } = useTheme();
  return (
    <>
      <KpiRow kpis={data.kpis} />
      <Card style={{ marginHorizontal: 16, marginTop: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: palette.warnBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={20} color={palette.warnFg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={14.5} weight="bold">
              Approvals inbox
            </Text>
            <Text size={12} tone="muted">
              {data.approvals.documents} document{data.approvals.documents === 1 ? "" : "s"} ·{" "}
              {data.approvals.ncrDispositions} NCR disposition{data.approvals.ncrDispositions === 1 ? "" : "s"}
            </Text>
          </View>
          {data.approvals.total > 0 && (
            <View
              style={{
                minWidth: 24,
                height: 24,
                paddingHorizontal: 7,
                borderRadius: radius.full,
                backgroundColor: palette.danger,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text size={12} weight="bold" color="#ffffff">
                {data.approvals.total}
              </Text>
            </View>
          )}
        </View>
      </Card>
      <SectionHeader>Team today</SectionHeader>
      <Card style={{ marginHorizontal: 16 }}>
        {data.team.length === 0 ? (
          <QueueEmpty label="No teammates in your scope" />
        ) : (
          data.team.map((m, i, a) => <TeamMemberRow key={m.userId} member={m} last={i === a.length - 1} />)
        )}
      </Card>
      <View style={{ height: 16 }} />
    </>
  );
}

function TeamMemberRow({ member, last }: { member: DashTeamMember; last: boolean }) {
  const { palette } = useTheme();
  const tone = member.online ? palette.success : palette.warn;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <Avatar initials={member.initials} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13.5} weight="semibold">
          {member.name}
        </Text>
        <Text size={11.5} tone="muted">
          {member.summary}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
        <Text size={11} weight="semibold" color={tone}>
          {member.online ? "Active" : "Offline"}
        </Text>
      </View>
    </View>
  );
}

// ── Admin ─────────────────────────────────────────────────────────────────────
function AdminBody({ data }: { data: Extract<DashboardDto, { variant: "admin" }> }) {
  const { palette } = useTheme();
  const router = useRouter();
  return (
    <>
      <KpiRow kpis={data.kpis} />
      {data.needsAttention.length > 0 && (
        <>
          <SectionHeader>Needs attention</SectionHeader>
          <Card style={{ marginHorizontal: 16 }}>
            {data.needsAttention.map((r, i, a) => (
              <DashRowView key={`${r.icon}-${i}`} row={r} last={i === a.length - 1} />
            ))}
          </Card>
        </>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 8,
        }}
      >
        <SectionLabel>Audit highlights</SectionLabel>
        <Text size={11} tone="subtle">
          read-only · sensitive events
        </Text>
      </View>
      <Card style={{ marginHorizontal: 16 }}>
        {data.auditHighlights.length === 0 ? (
          <QueueEmpty label="No recent sensitive events" />
        ) : (
          data.auditHighlights.map((e, i, a) => <AuditRow key={e.id} item={e} last={i === a.length - 1} />)
        )}
      </Card>
      <Card style={{ margin: 16, backgroundColor: palette.bgSubtle, borderWidth: 0 }}>
        <Pressable onPress={() => router.push("/manage-web")} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 13, paddingHorizontal: 14 }}>
            <Icon name="globe" size={18} color={palette.muted} />
            <Text size={12.5} weight="semibold" style={{ flex: 1 }}>
              Config, reports & members
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text size={12} weight="semibold" color={palette.accent}>
                Open web
              </Text>
              <Icon name="arrowRight" size={13} color={palette.accent} />
            </View>
          </View>
        </Pressable>
      </Card>
      <View style={{ height: 16 }} />
    </>
  );
}

function AuditRow({ item, last }: { item: DashAuditItem; last: boolean }) {
  const { palette, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.md,
          backgroundColor: palette.bgSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={item.icon as Parameters<typeof Icon>[0]["name"]} size={15} color={palette.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13} weight="semibold">
          {item.title}
        </Text>
        <Text size={11.5} tone="muted">
          {item.detail}
        </Text>
      </View>
      <Mono size={11} color={palette.subtle}>
        {formatAuditTime(item.at)}
      </Mono>
    </View>
  );
}

/** "09:41" for today, else "Yesterday" / "Mar 3". */
function formatAuditTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) {
    return then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  if (then.toDateString() === yst.toDateString()) return "Yesterday";
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Inline empty state inside a card (keeps the card frame, avoids a bare gap). */
function QueueEmpty({ label }: { label: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 14 }}>
      <Icon name="check" size={15} color={palette.subtle} />
      <Text size={13} tone="muted">
        {label}
      </Text>
    </View>
  );
}
