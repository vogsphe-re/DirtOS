import type Konva from "konva";
import type { CanvasObject } from "./types";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBounds(objects: CanvasObject[]) {
  if (objects.length === 0) {
    return { minX: 0, minY: 0, width: 1200, height: 800 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const object of objects) {
    const x = object.x;
    const y = object.y;
    const width = object.width ?? (object.radius ?? 20) * 2;
    const height = object.height ?? (object.radius ?? 20) * 2;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);

    if (object.points?.length) {
      for (let index = 0; index < object.points.length; index += 2) {
        minX = Math.min(minX, object.points[index]);
        minY = Math.min(minY, object.points[index + 1]);
        maxX = Math.max(maxX, object.points[index]);
        maxY = Math.max(maxY, object.points[index + 1]);
      }
    }
  }

  return {
    minX: minX - 48,
    minY: minY - 48,
    width: maxX - minX + 96,
    height: maxY - minY + 96,
  };
}

function objectToSvg(object: CanvasObject) {
  const fill = object.fill ?? "transparent";
  const stroke = object.stroke ?? "#665c54";
  const strokeWidth = object.strokeWidth ?? 1;

  if (object.type === "text") {
    return `<text x="${object.x}" y="${object.y}" font-size="14" fill="${fill}">${escapeXml(object.label || "Text")}</text>`;
  }

  if (object.radius != null) {
    return `<circle cx="${object.x}" cy="${object.y}" r="${object.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${object.opacity ?? 1}" />`;
  }

  if (object.points?.length) {
    return `<polyline points="${object.points.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${object.opacity ?? 1}" />`;
  }

  return `<rect x="${object.x}" y="${object.y}" width="${object.width ?? 100}" height="${object.height ?? 60}" rx="${object.type === "raised-bed" ? 4 : 0}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${object.opacity ?? 1}" />`;
}

export function exportCanvasSvg(objects: CanvasObject[]) {
  const bounds = getBounds(objects);
  const content = objects.map(objectToSvg).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">\n  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="#faf9f6" />\n  ${content}\n</svg>`;
}

export function exportCanvasPng(stage: Konva.Stage) {
  return stage.toDataURL({ pixelRatio: 2 });
}
