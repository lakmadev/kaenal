import { CameraView } from "expo-camera";

// Native-only live scanner surface. Isolated behind a Metro platform extension
// (`.native`/`.web`) so `expo-camera` never enters the web bundle — a top-level
// import leaks an unresolvable native module into web (same reason the sync store
// is split by platform). scan.tsx renders this only on device.
export function ScanCamera({ onScan }: { onScan: (value: string) => void }) {
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "datamatrix", "pdf417"] }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}
