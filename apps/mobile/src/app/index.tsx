import { useState } from "react";
import { Pressable, View } from "react-native";

import { useTheme, useThemeContext, type ThemeMode } from "@/theme";
import {
  ActionBar,
  Avatar,
  BellButton,
  Body,
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  Mono,
  Row,
  Screen,
  SectionLabel,
  Sev,
  Skeleton,
  StatusPill,
  TabBar,
  Text,
  type TabItem,
} from "@/ui";

// M1 kitchen sink — exercises every component in the common library so the theme
// (light/dark/system) can be verified end-to-end. Replaced by the real navigation
// shell + role-aware home in M2/M5.

const KPIS = [
  { label: "Assigned", value: "6", delta: "2 due" },
  { label: "Overdue", value: "2", danger: true },
  { label: "Pass rate", value: "94%", delta: "wk" },
];

const TABS: TabItem[] = [
  { id: "home", icon: "home", label: "Home" },
  { id: "tasks", icon: "clipboard", label: "Tasks", badge: 4 },
  { id: "add", fab: true },
  { id: "ncr", icon: "alert", label: "NCRs" },
  { id: "me", icon: "user", label: "Me" },
];

function ModeToggle() {
  const { palette, radius } = useTheme();
  const { mode, setMode } = useThemeContext();
  const options: { id: ThemeMode; icon: "sun" | "moon" | "smartphone" }[] = [
    { id: "light", icon: "sun" },
    { id: "dark", icon: "moon" },
    { id: "system", icon: "smartphone" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: palette.bgSubtle,
        borderRadius: radius.full,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const on = mode === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => setMode(o.id)}
            hitSlop={4}
            style={{
              width: 32,
              height: 26,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? palette.surface : "transparent",
            }}
          >
            <Icon name={o.icon} size={15} color={on ? palette.text : palette.subtle} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function KitchenSink() {
  const { palette } = useTheme();
  const [active, setActive] = useState("home");

  return (
    <Screen>
      <Header
        overline="Plant A · Detroit"
        title="Good morning, Sara"
        sync="pending"
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ModeToggle />
            <BellButton count={3} />
          </View>
        }
      />
      <Body>
        {/* KPI row */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
          {KPIS.map((k) => (
            <Card key={k.label} style={{ flex: 1, padding: 14 }}>
              <Text size={11} weight="semibold" tone="muted" numberOfLines={1}>
                {k.label}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <Text size={26} weight="bold" color={k.danger ? palette.dangerFg : palette.text}>
                  {k.value}
                </Text>
                {k.delta && (
                  <Text size={11} weight="semibold" tone="muted">
                    {k.delta}
                  </Text>
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* Work queue with severities + codes */}
        <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>
          Today's work queue
        </SectionLabel>
        <Card style={{ marginHorizontal: 16 }}>
          {[
            { id: "INS-0421", sev: "high" as const, title: "Line 3 — Weld station daily checks", due: "Due 2h" },
            { id: "INS-0423", sev: "critical" as const, title: "PPE compliance — Floor walk", due: "Overdue 1d" },
          ].map((it, i, a) => (
            <View
              key={it.id}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderBottomWidth: i === a.length - 1 ? 0 : 1,
                borderBottomColor: palette.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <Mono size={10.5} weight="bold" tone="muted">
                  {it.id}
                </Mono>
                <Sev level={it.sev} />
                <View style={{ flex: 1 }} />
                <Text size={11.5} weight="semibold" tone="muted">
                  {it.due}
                </Text>
              </View>
              <Text size={14.5} weight="semibold">
                {it.title}
              </Text>
            </View>
          ))}
        </Card>

        {/* Rows + status pills + avatar */}
        <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>
          Assigned to me
        </SectionLabel>
        <Card style={{ marginHorizontal: 16 }}>
          <Row
            icon="alert"
            iconTone="#ea580c"
            title="NCR-2026-0184 needs your action"
            sub="Bracket weld · High"
            right={<StatusPill tone="open">Open</StatusPill>}
            chevron
            onPress={() => {}}
          />
          <Row
            icon="tool"
            iconTone={palette.info}
            title="CAPA-0091 · Verify containment"
            sub="Due Friday"
            right={<Avatar initials="SC" size={26} />}
            chevron
            last
            onPress={() => {}}
          />
        </Card>

        {/* Status pill vocabulary */}
        <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>
          Status vocabulary
        </SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 }}>
          <StatusPill tone="open">Open</StatusPill>
          <StatusPill tone="progress">In progress</StatusPill>
          <StatusPill tone="verify">Verify</StatusPill>
          <StatusPill tone="done">Done</StatusPill>
          <StatusPill tone="closed">Closed</StatusPill>
          <StatusPill tone="danger">Failed</StatusPill>
          <StatusPill tone="warn">Review</StatusPill>
          <StatusPill tone="accent">Draft</StatusPill>
        </View>

        {/* Loading skeleton */}
        <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>
          Loading state
        </SectionLabel>
        <Card style={{ marginHorizontal: 16, padding: 14, gap: 10 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="90%" />
          <Skeleton width="80%" />
        </Card>

        {/* Empty state */}
        <View style={{ height: 180, marginHorizontal: 16, marginTop: 16 }}>
          <Card style={{ flex: 1 }}>
            <EmptyState icon="check" title="All caught up" body="No inspections due right now. New work will appear here." />
          </Card>
        </View>
      </Body>

      <ActionBar>
        <Button variant="ghost" icon="qr">
          Scan
        </Button>
        <Button icon="plus">Raise NCR</Button>
      </ActionBar>

      <TabBar tabs={TABS} active={active} onPress={setActive} />
    </Screen>
  );
}
