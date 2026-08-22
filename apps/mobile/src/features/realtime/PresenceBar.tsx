import { View } from "react-native";
import type { PresenceEntity } from "@kaenal/types";

import { useMemberNames } from "@/hooks/use-member-names";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Avatar, Text } from "@/ui";

/** Two-letter initials from a display name (mirrors the web Avatar). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const s = parts.map((p) => p[0] ?? "").join("");
  return s === "" ? "·" : s.toUpperCase();
}

/**
 * Live presence (Phase R6, mobile) — who else is on this record now, and who is
 * editing. Mirrors the web PresenceBar: an overlapping avatar stack plus a soft
 * "editing" hint. Renders nothing when you're alone.
 */
export function PresenceBar({
  type,
  id,
  editing = false,
}: {
  type: PresenceEntity;
  id: string;
  editing?: boolean;
}): React.ReactElement | null {
  const viewers = usePresence(type, id, editing);
  const me = useSession((s) => s.me);
  const nameOf = useMemberNames();
  const { palette } = useTheme();

  const others = viewers.filter((v) => v.userId !== me?.userId);
  if (others.length === 0) return null;

  const editors = others.filter((v) => v.editing);
  const shown = others.slice(0, 3);
  const displayName = (userId: string): string => nameOf(userId) ?? "Someone";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row" }}>
        {shown.map((v, i) => (
          <View key={v.userId} style={{ marginLeft: i === 0 ? 0 : -6 }}>
            <Avatar initials={initialsOf(displayName(v.userId))} size={24} />
          </View>
        ))}
      </View>
      {editors.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: palette.warnBg,
          }}
        >
          <Text size={11} weight="bold" color={palette.warnFg}>
            {displayName(editors[0]!.userId)}
            {editors.length > 1 ? ` +${editors.length - 1}` : ""} editing
          </Text>
        </View>
      ) : (
        <Text size={11.5} tone="muted">
          {others.length === 1 ? "1 here" : `${others.length} here`}
        </Text>
      )}
    </View>
  );
}
