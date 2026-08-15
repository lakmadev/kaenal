import { useRouter } from "expo-router";

import { Placeholder } from "@/features/shared/Placeholder";

export default function Capture() {
  const router = useRouter();
  return (
    <Placeholder
      title="Capture"
      overline="Quick-Log · Photo · Voice"
      icon="camera"
      body="Capture a photo with AI defect detection, hold-to-talk voice-to-NCR, or scan an area QR."
      phase="M7"
      onBack={() => router.back()}
    />
  );
}
