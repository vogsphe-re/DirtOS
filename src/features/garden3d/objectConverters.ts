import type { CanvasObject } from '../garden/types';

export type PrimitiveKind =
  | 'plane'
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'model';

export interface GardenPrimitive {
  id: string;
  kind: PrimitiveKind;
  color: string;
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  size?: [number, number, number];
  radius?: number;
  height?: number;
  modelPath?: string;
  modelScale?: number;
  castShadow: boolean;
  receiveShadow: boolean;
  occludesSun: boolean;
  sourceType: CanvasObject['type'];
  sourceObjectId: string;
}

export interface SpaceSamplePoint {
  id: string;
  objectId: string;
  position: [number, number, number];
  width: number;
  depth: number;
  assignedPlantId?: number | null;
}

const DEG_TO_RAD = Math.PI / 180;

function toWorld(x: number, y: number): [number, number] {
  // Canvas Y maps to Three Z for top-down ground plane coordinates.
  return [x, y];
}

function midpoint(ax: number, ay: number, bx: number, by: number): [number, number] {
  return [(ax + bx) / 2, (ay + by) / 2];
}

function segmentLength(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function convertCanvasToPrimitives(objects: CanvasObject[]): {
  primitives: GardenPrimitive[];
  spacePoints: SpaceSamplePoint[];
} {
  const primitives: GardenPrimitive[] = [];
  const spacePoints: SpaceSamplePoint[] = [];

  for (const obj of objects) {
    const width = obj.width ?? 80;
    const depth = obj.height ?? 80;
    const [wx, wz] = toWorld(obj.x, obj.y);
    const opacity = obj.opacity ?? 1;

    switch (obj.type) {
      case 'plot': {
        primitives.push({
          id: `plot-${obj.id}`,
          kind: 'plane',
          color: obj.fill,
          opacity: 0.6,
          position: [wx, 0.02, wz],
          rotation: [-Math.PI / 2, 0, 0],
          size: [width, depth, 1],
          castShadow: false,
          receiveShadow: true,
          occludesSun: false,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      case 'space': {
        primitives.push({
          id: `space-${obj.id}`,
          kind: 'plane',
          color: obj.fill,
          opacity: 0.35,
          position: [wx, 0.03, wz],
          rotation: [-Math.PI / 2, 0, 0],
          size: [width, depth, 1],
          castShadow: false,
          receiveShadow: true,
          occludesSun: false,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        spacePoints.push({
          id: `space-point-${obj.id}`,
          objectId: obj.id,
          position: [wx, 0.6, wz],
          width,
          depth,
          assignedPlantId: obj.assignedPlantId,
        });
        break;
      }

      case 'raised-bed': {
        const bedHeight = 24; // roughly 12-18 inches in existing px scale
        primitives.push({
          id: `raised-bed-${obj.id}`,
          kind: 'box',
          color: obj.fill,
          opacity,
          position: [wx, bedHeight / 2, wz],
          rotation: [0, (obj.rotation ?? 0) * DEG_TO_RAD, 0],
          size: [width, bedHeight, depth],
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      case 'structure': {
        const h = 120;
        primitives.push({
          id: `structure-${obj.id}`,
          kind: 'box',
          color: obj.fill,
          opacity: Math.max(0.25, opacity),
          position: [wx, h / 2, wz],
          rotation: [0, (obj.rotation ?? 0) * DEG_TO_RAD, 0],
          size: [width, h, depth],
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      case 'potted-plant': {
        const radius = obj.radius ?? Math.max(12, Math.min(width, depth) * 0.4);
        const h = Math.max(18, radius * 1.2);
        primitives.push({
          id: `pot-${obj.id}`,
          kind: 'cylinder',
          color: obj.fill,
          opacity,
          position: [wx, h / 2, wz],
          rotation: [0, 0, 0],
          radius,
          height: h,
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      case 'tree': {
        const trunkH = Math.max(50, (obj.height ?? 60));
        const canopyR = obj.canopyRadius ?? Math.max(40, obj.radius ?? 35);
        primitives.push({
          id: `tree-trunk-${obj.id}`,
          kind: 'cylinder',
          color: '#6f4e37',
          opacity: 1,
          position: [wx, trunkH / 2, wz],
          rotation: [0, 0, 0],
          radius: Math.max(5, canopyR * 0.2),
          height: trunkH,
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        primitives.push({
          id: `tree-canopy-${obj.id}`,
          kind: 'sphere',
          color: obj.fill,
          opacity: Math.min(0.9, opacity),
          position: [wx, trunkH + canopyR * 0.8, wz],
          rotation: [0, 0, 0],
          radius: canopyR,
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      case 'path':
      case 'fence':
      case 'irrigation': {
        const pts = obj.points ?? [obj.x, obj.y, obj.x + width, obj.y];
        const lineThickness = obj.type === 'fence' ? 6 : obj.type === 'path' ? 14 : 4;
        const lineHeight = obj.type === 'fence' ? 60 : obj.type === 'path' ? 1.8 : 1.2;

        for (let i = 0; i + 3 < pts.length; i += 2) {
          const ax = pts[i];
          const ay = pts[i + 1];
          const bx = pts[i + 2];
          const by = pts[i + 3];
          const segLen = segmentLength(ax, ay, bx, by);
          if (segLen < 1) continue;
          const [mx, my] = midpoint(ax, ay, bx, by);
          const theta = Math.atan2(by - ay, bx - ax);

          primitives.push({
            id: `${obj.type}-${obj.id}-${i}`,
            kind: 'box',
            color: obj.stroke,
            opacity: obj.type === 'fence' ? 0.8 : 1,
            position: [mx, lineHeight / 2, my],
            rotation: [0, -theta, 0],
            size: [segLen, lineHeight, lineThickness],
            castShadow: obj.type !== 'irrigation',
            receiveShadow: true,
            occludesSun: obj.type === 'fence',
            sourceType: obj.type,
            sourceObjectId: obj.id,
          });
        }

        break;
      }

      case 'imported-model': {
        if (!obj.modelPath) break;
        primitives.push({
          id: `model-${obj.id}`,
          kind: 'model',
          color: '#dddddd',
          opacity: 1,
          position: [wx, (obj.height ?? 1) / 2, wz],
          rotation: [
            (obj.modelRotationX ?? 0) * DEG_TO_RAD,
            (obj.modelRotationY ?? obj.rotation ?? 0) * DEG_TO_RAD,
            (obj.modelRotationZ ?? 0) * DEG_TO_RAD,
          ],
          modelPath: obj.modelPath,
          modelScale: obj.modelScale ?? 1,
          castShadow: true,
          receiveShadow: true,
          occludesSun: true,
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
        break;
      }

      default: {
        primitives.push({
          id: `default-${obj.id}`,
          kind: 'box',
          color: obj.fill,
          opacity,
          position: [wx, 6, wz],
          rotation: [0, (obj.rotation ?? 0) * DEG_TO_RAD, 0],
          size: [width, 12, depth],
          castShadow: true,
          receiveShadow: true,
          occludesSun: obj.type !== 'text',
          sourceType: obj.type,
          sourceObjectId: obj.id,
        });
      }
    }
  }

  return { primitives, spacePoints };
}

export function splitSunOccluders(primitives: GardenPrimitive[]): {
  occluders: GardenPrimitive[];
  visible: GardenPrimitive[];
} {
  return {
    occluders: primitives.filter((p) => p.occludesSun),
    visible: primitives,
  };
}
