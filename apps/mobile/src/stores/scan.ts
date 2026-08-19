import { create } from "zustand";

// Hand a scanned code back from the full-screen /scan route to whoever opened it
// (05 §3 "QR scan pre-fills fields"). The opener clears, navigates to /scan, and a
// useEffect consumes `result` on return — a clean cross-screen handoff without
// threading params through navigation.
interface ScanState {
  result: string | null;
  setResult: (value: string) => void;
  clear: () => void;
}

export const useScan = create<ScanState>((set) => ({
  result: null,
  setResult: (value) => set({ result: value }),
  clear: () => set({ result: null }),
}));
