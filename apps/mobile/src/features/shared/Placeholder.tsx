import { View } from "react-native";

import { useLayout } from "@/hooks/use-layout";
import { useSync } from "@/stores/sync";
import { Body, EmptyState, Header, Screen, Text, type IconName } from "@/ui";

// Shared placeholder for screens whose full build lands in a later phase. Renders
// the real shell (themed header + live sync pill + adaptive content width) so the
// navigation/theme/offline wiring is verifiable now, with an honest "coming in Mx"
// note instead of faked content.
export function Placeholder({
  title,
  overline,
  icon,
  body,
  phase,
  onBack,
}: {
  title: string;
  overline?: string;
  icon: IconName;
  body: string;
  phase: string;
  onBack?: () => void;
}) {
  const { contentMaxWidth } = useLayout();
  const sync = useSync((s) => s.state);
  return (
    <Screen>
      <Header title={title} overline={overline} sync={sync} onBack={onBack} />
      <Body contentStyle={{ flexGrow: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <EmptyState icon={icon} title={title} body={body} />
          <Text size={11} weight="semibold" tone="subtle" style={{ textAlign: "center", marginTop: -8 }}>
            Coming in {phase}
          </Text>
        </View>
      </Body>
    </Screen>
  );
}
