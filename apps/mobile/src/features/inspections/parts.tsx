import { Pressable, TextInput, View } from "react-native";

import { NOT_APPLICABLE, type FormItem, type InspectionDto } from "@kaenal/types";

import { useTheme } from "@/theme";
import { Card, Icon, Mono, Sev, Text, type SevLevel } from "@/ui";

import { isAnswered } from "./scoring";

// ── List card (m-inspections InspList) ────────────────────────────────────────
export function formatDue(scheduledAt: string | null): { text: string; overdue: boolean } {
  if (scheduledAt === null) return { text: "No date", overdue: false };
  const diff = new Date(scheduledAt).getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  const mag = abs < 3_600_000 ? "now" : abs < 86_400_000 ? `${h}h` : `${d}d`;
  if (overdue) return { text: mag === "now" ? "Overdue" : `Overdue ${mag}`, overdue: true };
  return { text: mag === "now" ? "Due now" : `Due ${mag}`, overdue: false };
}

const RISK_SEV: Record<string, SevLevel> = { critical: "critical", high: "high", medium: "medium", low: "low" };

export function InspectionListCard({
  insp,
  meta,
  resume,
  onPress,
}: {
  insp: InspectionDto;
  meta: string;
  resume?: { answered: number; total: number };
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const due = formatDue(insp.scheduledAt);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Card style={{ marginHorizontal: 16, marginTop: 10, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <Mono size={10.5} weight="bold" color={palette.muted}>
            {insp.code}
          </Mono>
          {insp.risk && <Sev level={RISK_SEV[insp.risk] ?? "medium"} />}
          <View style={{ flex: 1 }} />
          <Text size={11.5} weight="semibold" color={due.overdue ? palette.dangerFg : palette.muted}>
            {insp.status === "completed" ? "Done" : due.text}
          </Text>
        </View>
        <Text size={15} weight="semibold" style={{ lineHeight: 20 }}>
          {insp.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="clipboard" size={12} color={palette.muted} />
            <Text size={11.5} tone="muted">
              {insp.templateName ?? "Inspection"}
            </Text>
          </View>
          <Text size={11.5} tone="muted">
            ·
          </Text>
          <Text size={11.5} tone="muted">
            {meta}
          </Text>
          {resume && resume.answered > 0 && resume.answered < resume.total && (
            <>
              <Text size={11.5} tone="muted">
                ·
              </Text>
              <Text size={11.5} weight="semibold" color={palette.info}>
                Resume {resume.answered}/{resume.total}
              </Text>
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────
export function FilterChip({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active?: boolean;
  tone?: "danger";
  onPress: () => void;
}) {
  const { palette, radius } = useTheme();
  const bg = active ? palette.accent : tone === "danger" ? palette.dangerBg : palette.bgSubtle;
  const fg = active ? palette.accentFg : tone === "danger" ? palette.dangerFg : palette.muted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: bg }}>
        <Text size={12.5} weight="semibold" color={fg}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Progress bar (runner header) ──────────────────────────────────────────────
export function ProgressBar({ ratio }: { ratio: number }) {
  const { palette, radius } = useTheme();
  return (
    <View style={{ flex: 1, height: 6, backgroundColor: palette.bgSubtle, borderRadius: radius.full, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`, height: "100%", backgroundColor: palette.accent }} />
    </View>
  );
}

// ── One question card + its control (the runner core) ─────────────────────────
export function QuestionCard({
  item,
  index,
  value,
  onChange,
}: {
  item: FormItem;
  index: number;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { palette, radius } = useTheme();

  if (item.type === "header") {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <Text size={13} weight="bold" tone="muted" style={{ letterSpacing: 0.4, textTransform: "uppercase" }}>
          {item.label}
        </Text>
      </View>
    );
  }
  if (item.type === "info") {
    return (
      <Card style={{ marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0 }}>
        <Text size={12.5} tone="muted" style={{ lineHeight: 18 }}>
          {item.label}
        </Text>
      </Card>
    );
  }

  const answered = isAnswered(item, value === undefined ? {} : { [item.id]: value });
  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 10, padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: answered ? palette.success : "transparent",
            borderWidth: answered ? 0 : 2,
            borderColor: palette.border,
          }}
        >
          {answered ? (
            <Icon name="check" size={13} stroke={3} color="#ffffff" />
          ) : (
            <Text size={11} weight="bold" tone="muted">
              {index}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text size={14.5} weight="semibold" style={{ lineHeight: 20 }}>
            {item.label}
          </Text>
          {item.required && (
            <Text size={11.5} tone="muted" style={{ marginTop: 2 }}>
              Required
            </Text>
          )}
        </View>
      </View>
      <View style={{ paddingLeft: 32 }}>
        <Control item={item} value={value} onChange={onChange} radius={radius} />
      </View>
    </Card>
  );
}

/** The input control for a single item, dispatched by type. */
function Control({
  item,
  value,
  onChange,
  radius,
}: {
  item: FormItem;
  value: unknown;
  onChange: (v: unknown) => void;
  radius: ReturnType<typeof useTheme>["radius"];
}) {
  const { palette } = useTheme();

  switch (item.type) {
    case "pass_fail":
    case "yes_no": {
      const opts =
        item.type === "pass_fail"
          ? [{ v: "pass", l: "Pass", good: true }, { v: "fail", l: "Fail", good: false }]
          : [{ v: "yes", l: "Yes", good: true }, { v: "no", l: "No", good: false }];
      if (item.naAllowed) opts.push({ v: NOT_APPLICABLE, l: "N/A", good: undefined as unknown as boolean });
      return (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {opts.map((o) => {
            const on = value === o.v;
            const goodTone = o.good === true;
            const bg = on ? (goodTone ? palette.successBg : o.good === false ? palette.dangerBg : palette.accentSoft) : palette.surface;
            const fg = on ? (goodTone ? palette.successFg : o.good === false ? palette.dangerFg : palette.accent) : palette.muted;
            const border = on ? (goodTone ? palette.success : o.good === false ? palette.danger : palette.accent) : palette.border;
            return (
              <Pressable key={o.v} onPress={() => onChange(o.v)} style={{ flex: 1 }}>
                <View
                  style={{
                    height: 40,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: bg,
                    borderWidth: 1.5,
                    borderColor: border,
                  }}
                >
                  <Text size={13.5} weight="semibold" color={fg}>
                    {o.l}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    }
    case "score": {
      const min = item.min ?? 1;
      const max = item.max ?? 5;
      const nums = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
      return (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {nums.map((n) => {
            const on = value === n;
            return (
              <Pressable key={n} onPress={() => onChange(n)} style={{ flex: 1 }}>
                <View
                  style={{
                    height: 40,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? palette.accent : palette.surface,
                    borderWidth: 1.5,
                    borderColor: on ? palette.accent : palette.border,
                  }}
                >
                  <Text size={14} weight="bold" color={on ? palette.accentFg : palette.muted}>
                    {n}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    }
    case "select": {
      return (
        <View style={{ gap: 8 }}>
          {(item.options ?? []).map((o) => {
            const on = value === o.value;
            return <OptionRow key={o.value} label={o.label} on={on} onPress={() => onChange(o.value)} />;
          })}
        </View>
      );
    }
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ gap: 8 }}>
          {(item.options ?? []).map((o) => {
            const on = arr.includes(o.value);
            return (
              <OptionRow
                key={o.value}
                label={o.label}
                on={on}
                onPress={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
              />
            );
          })}
        </View>
      );
    }
    case "number":
      return (
        <FieldInput
          value={value === undefined || value === null ? "" : String(value)}
          keyboardType="numeric"
          onChangeText={(t) => onChange(t === "" ? undefined : Number(t))}
          placeholder="Enter a number"
        />
      );
    case "text":
    case "date":
    case "datetime":
      return (
        <FieldInput
          value={typeof value === "string" ? value : ""}
          onChangeText={(t) => onChange(t)}
          placeholder={item.type === "text" ? "Enter a value" : "YYYY-MM-DD"}
        />
      );
    case "textarea":
      return (
        <FieldInput value={typeof value === "string" ? value : ""} onChangeText={(t) => onChange(t)} placeholder="Notes" multiline />
      );
    case "photo":
      return <DeferredField icon="camera" label="Photo capture arrives in M7 (Capture)" />;
    case "signature":
      return <DeferredField icon="pen" label="Signature capture arrives in M7 (Capture)" />;
    default:
      return null;
  }
}

function OptionRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { palette, radius } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: radius.lg,
          backgroundColor: on ? palette.accentSoft : palette.surface,
          borderWidth: 1.5,
          borderColor: on ? palette.accent : palette.border,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: on ? palette.accent : "transparent",
            borderWidth: on ? 0 : 1.5,
            borderColor: palette.border,
          }}
        >
          {on && <Icon name="check" size={11} stroke={3} color={palette.accentFg} />}
        </View>
        <Text size={13.5} weight={on ? "semibold" : "regular"} color={on ? palette.accent : palette.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function FieldInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: "numeric";
  multiline?: boolean;
}) {
  const { palette, radius, fonts } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.subtle}
      keyboardType={keyboardType}
      multiline={multiline}
      style={{
        minHeight: multiline ? 54 : 44,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: palette.text,
        fontFamily: fonts.sans,
        fontSize: 14,
        textAlignVertical: multiline ? "top" : "center",
      }}
    />
  );
}

/** A field whose capture belongs to a later phase — honest, not a fake control. */
function DeferredField({ icon, label }: { icon: "camera" | "pen"; label: string }) {
  const { palette, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 54,
        paddingHorizontal: 12,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: palette.border,
        backgroundColor: palette.bgSubtle,
      }}
    >
      <Icon name={icon} size={18} color={palette.subtle} />
      <Text size={12.5} tone="muted" style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}
