import {
  User,
  Bell,
  Shield,
  SlidersHorizontal,
  Building2,
  Users,
  KeyRound,
  MapPin,
  ShieldCheck,
  Clock,
  Bot,
  Lock,
  Sparkles,
  Palette,
  BarChart3,
  RefreshCw,
  FileText,
  List,
  Mail,
  ClipboardCheck,
  Brain,
  Code,
  Plug,
  Package,
  Upload,
  Play,
  Star,
  History,
  type LucideIcon,
} from "lucide-react";

/**
 * Settings navigation — a faithful port of `settings.jsx`'s `SETTINGS_NAV`
 * (design rule #9): grouped sections in the same order. `built: true` marks the
 * sections whose content is implemented; everything else renders an in-shell
 * "coming soon" placeholder so the full settings map is present and navigable
 * (consistent with the sidebar's full-nav-with-placeholders decision).
 */
export interface SettingsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  built?: boolean;
}

export interface SettingsNavGroup {
  group: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    group: "Personal",
    items: [
      { id: "profile", label: "Profile", icon: User, built: true },
      { id: "notifications", label: "Notifications", icon: Bell, built: true },
      { id: "security", label: "Security & devices", icon: Shield, built: true },
      { id: "preferences", label: "Preferences", icon: SlidersHorizontal, built: true },
    ],
  },
  {
    group: "Workspace",
    items: [
      { id: "organization", label: "Organization", icon: Building2 },
      { id: "members", label: "Members & teams", icon: Users, built: true },
      { id: "roles", label: "Roles & permissions", icon: KeyRound },
      { id: "sites", label: "Sites & areas", icon: MapPin },
    ],
  },
  {
    group: "Security & Identity",
    items: [
      { id: "trust", label: "Trust Center", icon: ShieldCheck },
      { id: "sso", label: "Single Sign-On", icon: KeyRound },
      { id: "scim", label: "SCIM provisioning", icon: Users },
      { id: "network", label: "Network policy", icon: Shield },
      { id: "sessions", label: "Session policies", icon: Clock, built: true },
      { id: "service-accounts", label: "Service accounts", icon: Bot },
      { id: "delegated", label: "Delegated admin", icon: KeyRound },
    ],
  },
  {
    group: "Compliance & Privacy",
    items: [
      { id: "dsar", label: "Data subject requests", icon: User },
      { id: "legal-hold", label: "Legal hold", icon: Lock, built: true },
      { id: "dlp", label: "DLP policies", icon: Shield, built: true },
      { id: "byok", label: "Customer-managed keys", icon: KeyRound },
    ],
  },
  {
    group: "AI",
    items: [{ id: "ai-governance", label: "AI Governance", icon: Sparkles }],
  },
  {
    group: "Multi-tenancy",
    items: [
      { id: "org-hierarchy", label: "Org hierarchy", icon: Building2 },
      { id: "white-label", label: "White-label branding", icon: Palette, built: true },
      { id: "cross-tenant", label: "Cross-tenant analytics", icon: BarChart3 },
      { id: "lifecycle", label: "Clone / migrate / export", icon: RefreshCw },
      { id: "cost-centers", label: "Cost centers & chargeback", icon: FileText, built: true },
    ],
  },
  {
    group: "Process",
    items: [
      { id: "sla", label: "SLA configuration", icon: Clock },
      { id: "categories", label: "Categories", icon: List },
      { id: "validation", label: "Validation rules", icon: Shield, built: true },
      { id: "email-templates", label: "Email templates", icon: Mail },
      { id: "pdf-templates", label: "PDF templates", icon: FileText },
      { id: "insp-templates", label: "Inspection templates", icon: ClipboardCheck },
      { id: "8d-templates", label: "8D templates", icon: Brain },
    ],
  },
  {
    group: "Developer",
    items: [
      { id: "dev-platform", label: "Developer Platform", icon: Code },
      { id: "integrations", label: "Integrations", icon: Plug, built: true },
      { id: "api", label: "API & webhooks", icon: Code },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "status-page", label: "System status", icon: Sparkles },
      { id: "backup-restore", label: "Backup & restore", icon: RefreshCw },
      { id: "warehouse", label: "Data warehouse sync", icon: Package },
      { id: "bulk-import", label: "Bulk import", icon: Upload, built: true },
    ],
  },
  {
    group: "Adoption",
    items: [
      { id: "onboarding", label: "Onboarding wizard", icon: Sparkles },
      { id: "tours", label: "Product tours", icon: Play },
      { id: "knowledge", label: "Knowledge base", icon: FileText },
      { id: "nps", label: "NPS & satisfaction", icon: Star },
      { id: "adoption", label: "Adoption analytics", icon: BarChart3 },
      { id: "release-notes", label: "Release notes", icon: History },
    ],
  },
  {
    group: "System",
    items: [
      { id: "audit", label: "Audit log", icon: History },
      { id: "billing", label: "Billing & plan", icon: FileText },
    ],
  },
];

const BY_ID = new Map<string, SettingsNavItem>(
  SETTINGS_NAV.flatMap((g) => g.items).map((i) => [i.id, i]),
);

export function settingsItem(id: string): SettingsNavItem | undefined {
  return BY_ID.get(id);
}

/** The section a bare/unknown slug resolves to. */
export const DEFAULT_SETTINGS_SECTION = "profile";
