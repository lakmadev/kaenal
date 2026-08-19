import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Pressable, TextInput, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";

import { flatten } from "@/features/capture/annotate/flatten";
import { ANNOTATE_COLORS, STROKE, arrowHead, polylinePoints, radiusOf, type Mark, type Pt, type Tool } from "@/features/capture/annotate/marks";
import { services } from "@/services";
import { uuidv7 } from "@/sync/ids";
import { Icon, Text, type IconName } from "@/ui";

const TOOLS: { key: Tool; icon: IconName; label: string }[] = [
  { key: "draw", icon: "pen", label: "Draw" },
  { key: "circle", icon: "target", label: "Circle" },
  { key: "arrow", icon: "arrowRight", label: "Arrow" },
  { key: "text", icon: "type", label: "Text" },
];

async function byteSize(uri: string): Promise<number> {
  try {
    return (await (await fetch(uri)).blob()).size;
  } catch {
    return 0;
  }
}

// m-capture.jsx CapAnnotate — mark up a captured photo (draw / circle / arrow /
// text + colour + undo), then flatten photo+marks into a new image that REPLACES
// the staged pending_file, so the annotated version is what syncs. No backend.
export default function Annotate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const fileId = params.id ?? "";

  const [uri, setUri] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>("circle");
  const [color, setColor] = useState<string>(ANNOTATE_COLORS[0]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [draft, setDraft] = useState<Mark | null>(null);
  const [editing, setEditing] = useState<{ id: string; at: Pt } | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const shotRef = useRef<View>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  toolRef.current = tool;
  colorRef.current = color;

  useEffect(() => {
    void services.syncStore.listFiles().then((files) => {
      const f = files.find((x) => x.id === fileId);
      if (f) setUri(f.localUri);
    });
  }, [fileId]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => toolRef.current !== "text",
        onMoveShouldSetPanResponder: () => toolRef.current !== "text",
        onPanResponderGrant: (e) => {
          const p: Pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          setDraft({ id: uuidv7(), tool: toolRef.current, color: colorRef.current, pts: [p, p] });
        },
        onPanResponderMove: (e) => {
          const p: Pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          setDraft((d) => {
            if (d === null) return d;
            if (d.tool === "draw") return { ...d, pts: [...d.pts, p] };
            return { ...d, pts: [d.pts[0]!, p] };
          });
        },
        onPanResponderRelease: () => {
          setDraft((d) => {
            if (d !== null) setMarks((ms) => [...ms, d]);
            return null;
          });
        },
      }),
    [],
  );

  function onCanvasPress(e: { nativeEvent: { locationX: number; locationY: number } }): void {
    if (tool !== "text") return;
    const at: Pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    const id = uuidv7();
    setMarks((ms) => [...ms, { id, tool: "text", color, pts: [at], text: "" }]);
    setEditText("");
    setEditing({ id, at });
  }

  function commitText(): void {
    if (editing === null) return;
    const text = editText;
    setMarks((ms) =>
      text.trim() === "" ? ms.filter((m) => m.id !== editing.id) : ms.map((m) => (m.id === editing.id ? { ...m, text } : m)),
    );
    setEditing(null);
    setEditText("");
  }

  function undo(): void {
    setMarks((ms) => ms.slice(0, -1));
  }

  async function done(): Promise<void> {
    if (uri === null || size === null || saving) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      const flat = await flatten(shotRef, uri, marks, size.w, size.h);
      const files = await services.syncStore.listFiles();
      const f = files.find((x) => x.id === fileId);
      if (f) {
        await services.syncStore.putFile({
          ...f,
          localUri: flat,
          mime: "image/jpeg",
          bytes: await byteSize(flat),
          status: "pending",
          remoteId: null,
          sha256: null,
          error: null,
        });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const all = draft ? [...marks, draft] : marks;

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="chevronLeft" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text size={13.5} weight="bold" color="#fff">
            Annotate
          </Text>
          <Text size={10.5} color="rgba(255,255,255,0.55)">
            {tool === "text" ? "Tap the photo to add a note" : "Drag on the photo to mark it"}
          </Text>
        </View>
        <Pressable onPress={undo} disabled={marks.length === 0} hitSlop={8} style={{ padding: 6, opacity: marks.length === 0 ? 0.4 : 1 }}>
          <Icon name="refresh" size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={() => void done()} style={{ height: 30, paddingHorizontal: 14, borderRadius: 9, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center" }}>
          <Text size={12.5} weight="bold" color="#18181b">
            {saving ? "Saving…" : "Done"}
          </Text>
        </Pressable>
      </View>

      {/* Canvas */}
      <View style={{ flex: 1 }}>
        <View
          ref={shotRef}
          collapsable={false}
          style={{ flex: 1 }}
          onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          {...pan.panHandlers}
        >
          {uri && <Image source={{ uri }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} resizeMode="contain" />}
          {size && (
            <Svg width={size.w} height={size.h} style={{ position: "absolute", inset: 0 }}>
              {all.map((m) => (
                <MarkShape key={m.id} m={m} />
              ))}
            </Svg>
          )}
          {/* Text tool tap layer (PanResponder is off for text) */}
          {tool === "text" && <Pressable style={{ position: "absolute", inset: 0 }} onPress={onCanvasPress} />}
          {/* Inline text editor */}
          {editing && (
            <TextInput
              autoFocus
              value={editText}
              onChangeText={setEditText}
              onSubmitEditing={commitText}
              onBlur={commitText}
              placeholder="Note…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{ position: "absolute", left: editing.at.x, top: editing.at.y, minWidth: 120, color, fontSize: 18, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 6, borderRadius: 6 }}
            />
          )}
        </View>
      </View>

      {/* Colours */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 10, backgroundColor: "#111" }}>
        {ANNOTATE_COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? "#fff" : "rgba(255,255,255,0.3)" }} />
          </Pressable>
        ))}
      </View>

      {/* Toolbar */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#111", paddingTop: 6, paddingBottom: insets.bottom + 14, paddingHorizontal: 18 }}>
        {TOOLS.map((t) => {
          const on = tool === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTool(t.key)} style={{ alignItems: "center", gap: 5 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                <Icon name={t.icon} size={18} color={on ? "#fff" : "rgba(255,255,255,0.55)"} />
              </View>
              <Text size={9.5} weight="semibold" color={on ? "#fff" : "rgba(255,255,255,0.55)"}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MarkShape({ m }: { m: Mark }) {
  const a = m.pts[0];
  const b = m.pts[m.pts.length - 1];
  if (a === undefined || b === undefined) return null;
  if (m.tool === "draw") {
    return <Polyline points={polylinePoints(m.pts)} stroke={m.color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (m.tool === "circle") {
    return <Circle cx={a.x} cy={a.y} r={radiusOf(a, b)} stroke={m.color} strokeWidth={STROKE} fill="none" />;
  }
  if (m.tool === "arrow") {
    const [h1, h2] = arrowHead(a, b);
    return (
      <>
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={m.color} strokeWidth={STROKE} strokeLinecap="round" />
        <Polygon points={`${b.x},${b.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} fill={m.color} />
      </>
    );
  }
  if (m.tool === "text" && m.text) {
    return (
      <SvgText x={a.x} y={a.y + 16} fill={m.color} fontSize={18} fontWeight="600">
        {m.text}
      </SvgText>
    );
  }
  return null;
}
