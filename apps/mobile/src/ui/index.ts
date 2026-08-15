// Kaenal mobile — component common library.
// Theme-driven, self-contained (imports only `../theme` + RN/lucide), so it can be
// lifted into `packages/mobile-ui` unchanged if another client ever needs it.
export { Icon, type IconName, type IconProps } from "./Icon";
export { Text, Mono, type TextProps, type TextWeight, type TextTone } from "./Text";
export { Screen, Body, Card, SectionLabel, ActionBar } from "./layout";
export {
  SyncPill,
  StatusPill,
  Sev,
  Avatar,
  type SyncState,
  type StatusTone,
  type SevLevel,
} from "./pills";
export { Button, type ButtonProps } from "./Button";
export { Row, type RowProps } from "./Row";
export { Skeleton, EmptyState } from "./feedback";
export { Header, BellButton, Badge, type HeaderProps } from "./Header";
export { TabBar, type TabItem } from "./TabBar";
