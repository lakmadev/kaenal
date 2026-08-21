import type { RefObject } from "react";
import type { View } from "react-native";

import { arrowHead, measureLabel, midpoint, radiusOf, STROKE, type Mark } from "./marks";

// Web flatten: react-native-view-shot doesn't capture on web, so composite the
// photo + marks onto a 2D canvas (same coordinate space the SVG used) and export
// a JPEG data URL. Driven by the structured marks, so it matches the live view.
export async function flatten(
  _ref: RefObject<View | null>,
  imageUri: string,
  marks: Mark[],
  w: number,
  h: number,
  mmPerPx: number | null = null,
): Promise<string> {
  const img = await loadImage(imageUri);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = STROKE;
  for (const m of marks) drawMark(ctx, m, mmPerPx);

  return canvas.toDataURL("image/jpeg", 0.9);
}

function drawMark(ctx: CanvasRenderingContext2D, m: Mark, mmPerPx: number | null): void {
  ctx.strokeStyle = m.color;
  ctx.fillStyle = m.color;
  const a = m.pts[0];
  if (a === undefined) return;
  const b = m.pts[m.pts.length - 1] ?? a;

  if (m.tool === "draw") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (const p of m.pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (m.tool === "circle") {
    ctx.beginPath();
    ctx.arc(a.x, a.y, radiusOf(a, b), 0, Math.PI * 2);
    ctx.stroke();
  } else if (m.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const [h1, h2] = arrowHead(a, b);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(h1.x, h1.y);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(h2.x, h2.y);
    ctx.stroke();
  } else if (m.tool === "measure") {
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const cap = 7;
    const dx = Math.cos(ang) * cap;
    const dy = Math.sin(ang) * cap;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(a.x - dx, a.y - dy);
    ctx.lineTo(a.x + dx, a.y + dy);
    ctx.moveTo(b.x - dx, b.y - dy);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
    const mid = midpoint(a, b);
    const label = measureLabel(a, b, mmPerPx);
    ctx.font = "700 12px system-ui, sans-serif";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(mid.x - tw / 2 - 6, mid.y - 20, tw + 12, 16);
    ctx.fillStyle = m.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mid.x, mid.y - 12);
    ctx.textAlign = "start";
  } else if (m.tool === "text" && m.text) {
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(m.text, a.x, a.y);
  }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = uri;
  });
}
