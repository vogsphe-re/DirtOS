import type { Plant, Species } from '../../lib/bindings';
import type { CanvasObject } from '../garden/types';

export type PrimitiveKind =
  | 'plane'
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'model';

export type PrimitiveVisualProfile =
  | 'default'
  | 'orchard-tree'
  | 'ground-herb'
  | 'ground-vine'
  | 'ground-bush'
  | 'ground-clump';

export interface GardenPrimitive {
  id: string;
  kind: PrimitiveKind;
  visualProfile?: PrimitiveVisualProfile;
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

interface ConvertCanvasToPrimitivesOptions {
  plantsById?: ReadonlyMap<number, Plant>;
  speciesById?: ReadonlyMap<number, Species>;
}

function normalizeCanvasColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const color = value.trim().toLowerCase();

  if (color === 'transparent') {
    return fallback;
  }

  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
    }
  }

  if (/^#[0-9a-f]{8}$/i.test(color)) {
    return `#${color.slice(1, 7)}`;
  }

  return value;
}

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

function vec3(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

function size3(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function speciesText(species: Species | null): string {
  if (!species) return '';
  return [species.common_name, species.scientific_name, species.family, species.genus, species.description, species.growth_type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getAssignedSpecies(
  obj: CanvasObject,
  plantsById?: ReadonlyMap<number, Plant>,
  speciesById?: ReadonlyMap<number, Species>,
): Species | null {
  const assignedPlantId = obj.assignedPlantId;
  if (!assignedPlantId || !plantsById || !speciesById) return null;
  const plant = plantsById.get(assignedPlantId);
  if (!plant?.species_id) return null;
  return speciesById.get(plant.species_id) ?? null;
}

function classifyGroundPlantProfile(species: Species | null): PrimitiveVisualProfile {
  const descriptor = speciesText(species);

  if (includesAny(descriptor, ['vine', 'climber', 'climbing', 'pole bean', 'pea', 'cucumber', 'melon', 'watermelon', 'pumpkin', 'squash', 'gourd'])) {
    return 'ground-vine';
  }

  if (includesAny(descriptor, ['shrub', 'subshrub', 'bush', 'pepper', 'eggplant', 'blueberry', 'raspberry', 'blackberry', 'rosemary', 'lavender', 'sage', 'okra', 'tomatillo', 'ground cherry'])) {
    return 'ground-bush';
  }

  if (includesAny(descriptor, ['herb', 'forb', 'basil', 'parsley', 'cilantro', 'dill', 'oregano', 'thyme', 'chive', 'mint', 'tarragon', 'chamomile', 'lemon balm'])) {
    return 'ground-herb';
  }

  if (includesAny(descriptor, ['grass', 'gramin', 'corn', 'onion', 'garlic', 'leek', 'lemongrass', 'asparagus', 'fennel'])) {
    return 'ground-clump';
  }

  return 'default';
}

function createGroundPlantPrimitives(
  obj: CanvasObject,
  wx: number,
  wz: number,
  width: number,
  depth: number,
  opacity: number,
  baseColor: string,
  accentColor: string,
  species: Species | null,
): GardenPrimitive[] {
  const profile = classifyGroundPlantProfile(species);
  const radius = obj.radius ?? Math.max(10, Math.min(width, depth) * 0.28);
  const spread = Math.max(10, radius * 0.7);

  if (profile === 'ground-herb') {
    return [
      {
        id: `ground-plant-${obj.id}-core`,
        kind: 'cylinder',
        visualProfile: profile,
        color: accentColor,
        opacity,
        position: vec3(wx, Math.max(4, radius * 0.2), wz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(2.5, radius * 0.14),
        height: Math.max(8, radius * 0.4),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      ...[
        [-spread * 0.55, spread * 0.15],
        [spread * 0.5, spread * 0.2],
        [0, -spread * 0.55],
        [-spread * 0.15, spread * 0.6],
      ].map(([dx, dz], index) => ({
        id: `ground-plant-${obj.id}-leaf-${index}`,
        kind: 'sphere' as const,
        visualProfile: profile,
        color: baseColor,
        opacity,
        position: vec3(wx + dx, Math.max(8, radius * 0.45), wz + dz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(6, radius * 0.38),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      })),
    ];
  }

  if (profile === 'ground-vine') {
    const postHeight = Math.max(30, radius * 2.6);
    const postOffset = spread * 0.85;
    return [
      {
        id: `ground-plant-${obj.id}-mound`,
        kind: 'sphere',
        visualProfile: profile,
        color: baseColor,
        opacity,
        position: vec3(wx, Math.max(8, radius * 0.45), wz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(8, radius * 0.55),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      {
        id: `ground-plant-${obj.id}-post-a`,
        kind: 'cylinder',
        visualProfile: profile,
        color: '#8b6b4a',
        opacity: 0.95,
        position: vec3(wx - postOffset, postHeight / 2, wz - spread * 0.25),
        rotation: vec3(0, 0, 0),
        radius: Math.max(2, radius * 0.08),
        height: postHeight,
        castShadow: true,
        receiveShadow: true,
        occludesSun: true,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      {
        id: `ground-plant-${obj.id}-post-b`,
        kind: 'cylinder',
        visualProfile: profile,
        color: '#8b6b4a',
        opacity: 0.95,
        position: vec3(wx + postOffset, postHeight / 2, wz + spread * 0.25),
        rotation: vec3(0, 0, 0),
        radius: Math.max(2, radius * 0.08),
        height: postHeight,
        castShadow: true,
        receiveShadow: true,
        occludesSun: true,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      {
        id: `ground-plant-${obj.id}-trellis`,
        kind: 'box',
        visualProfile: profile,
        color: '#9b7a55',
        opacity: 0.9,
        position: vec3(wx, postHeight * 0.82, wz),
        rotation: vec3(0, Math.PI * 0.12, 0),
        size: size3(postOffset * 2.2, Math.max(2, radius * 0.06), Math.max(2, radius * 0.08)),
        castShadow: true,
        receiveShadow: true,
        occludesSun: true,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      ...[
        [-spread * 0.45, postHeight * 0.4, -spread * 0.1],
        [0, postHeight * 0.62, spread * 0.15],
        [spread * 0.5, postHeight * 0.74, 0],
      ].map(([dx, py, dz], index) => ({
        id: `ground-plant-${obj.id}-vine-${index}`,
        kind: 'sphere' as const,
        visualProfile: profile,
        color: baseColor,
        opacity,
        position: vec3(wx + dx, py, wz + dz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(5, radius * 0.28),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      })),
    ];
  }

  if (profile === 'ground-bush') {
    return [
      {
        id: `ground-plant-${obj.id}-stem`,
        kind: 'cylinder',
        visualProfile: profile,
        color: '#6f4e37',
        opacity: 1,
        position: vec3(wx, Math.max(8, radius * 0.35), wz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(3, radius * 0.12),
        height: Math.max(16, radius * 0.7),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
      ...[
        [0, radius * 1.0, 0, radius * 0.7],
        [-spread * 0.45, radius * 0.9, spread * 0.15, radius * 0.52],
        [spread * 0.42, radius * 0.92, -spread * 0.12, radius * 0.5],
      ].map(([dx, py, dz, nodeRadius], index) => ({
        id: `ground-plant-${obj.id}-canopy-${index}`,
        kind: 'sphere' as const,
        visualProfile: profile,
        color: baseColor,
        opacity,
        position: vec3(wx + dx, py, wz + dz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(7, nodeRadius),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      })),
    ];
  }

  if (profile === 'ground-clump') {
    return [
      ...[
        [-spread * 0.42, radius * 1.5, -spread * 0.16],
        [-spread * 0.16, radius * 1.85, spread * 0.2],
        [0, radius * 2.1, 0],
        [spread * 0.18, radius * 1.75, -spread * 0.24],
        [spread * 0.45, radius * 1.55, spread * 0.16],
      ].map(([dx, bladeHeight, dz], index) => ({
        id: `ground-plant-${obj.id}-blade-${index}`,
        kind: 'cylinder' as const,
        visualProfile: profile,
        color: index % 2 === 0 ? baseColor : accentColor,
        opacity,
        position: vec3(wx + dx, bladeHeight / 2, wz + dz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(2, radius * 0.06),
        height: Math.max(18, bladeHeight),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      })),
      {
        id: `ground-plant-${obj.id}-crown`,
        kind: 'sphere',
        visualProfile: profile,
        color: baseColor,
        opacity,
        position: vec3(wx, Math.max(6, radius * 0.32), wz),
        rotation: vec3(0, 0, 0),
        radius: Math.max(6, radius * 0.28),
        castShadow: true,
        receiveShadow: true,
        occludesSun: false,
        sourceType: obj.type,
        sourceObjectId: obj.id,
      },
    ];
  }

  return [{
    id: `ground-plant-${obj.id}`,
    kind: 'sphere',
    visualProfile: 'default',
    color: baseColor,
    opacity,
    position: vec3(wx, Math.max(10, radius * 0.9), wz),
    rotation: vec3(0, 0, 0),
    radius,
    castShadow: true,
    receiveShadow: true,
    occludesSun: false,
    sourceType: obj.type,
    sourceObjectId: obj.id,
  }];
}

function createOrchardTreePrimitives(
  obj: CanvasObject,
  wx: number,
  wz: number,
  opacity: number,
  canopyR: number,
  canopyColor: string,
  fruitColor: string,
): GardenPrimitive[] {
  const trunkH = Math.max(60, obj.height ?? 70);
  const trunkRadius = Math.max(6, canopyR * 0.16);
  const canopyY = trunkH + canopyR * 0.55;

  return [
    {
      id: `tree-trunk-${obj.id}`,
      kind: 'cylinder',
      visualProfile: 'orchard-tree',
      color: '#6f4e37',
      opacity: 1,
      position: vec3(wx, trunkH / 2, wz),
      rotation: vec3(0, 0, 0),
      radius: trunkRadius,
      height: trunkH,
      castShadow: true,
      receiveShadow: true,
      occludesSun: true,
      sourceType: obj.type,
      sourceObjectId: obj.id,
    },
    ...[
      [0, canopyY, 0, canopyR * 0.82],
      [-canopyR * 0.42, canopyY - canopyR * 0.12, canopyR * 0.12, canopyR * 0.48],
      [canopyR * 0.45, canopyY - canopyR * 0.08, -canopyR * 0.18, canopyR * 0.5],
      [0, canopyY + canopyR * 0.28, 0, canopyR * 0.44],
    ].map<GardenPrimitive>(([dx, py, dz, radius], index) => ({
      id: `tree-canopy-${obj.id}-${index}`,
      kind: 'sphere' as const,
      visualProfile: 'orchard-tree',
      color: canopyColor,
      opacity: Math.min(0.92, opacity),
      position: vec3(wx + dx, py, wz + dz),
      rotation: vec3(0, 0, 0),
      radius: Math.max(10, radius),
      castShadow: true,
      receiveShadow: true,
      occludesSun: true,
      sourceType: obj.type,
      sourceObjectId: obj.id,
    })),
    ...[
      [-canopyR * 0.22, canopyY - canopyR * 0.12, canopyR * 0.26],
      [canopyR * 0.18, canopyY - canopyR * 0.06, -canopyR * 0.18],
      [0, canopyY + canopyR * 0.08, canopyR * 0.05],
    ].map<GardenPrimitive>(([dx, py, dz], index) => ({
      id: `tree-fruit-${obj.id}-${index}`,
      kind: 'sphere' as const,
      visualProfile: 'orchard-tree',
      color: fruitColor,
      opacity: 0.95,
      position: vec3(wx + dx, py, wz + dz),
      rotation: vec3(0, 0, 0),
      radius: Math.max(4, canopyR * 0.08),
      castShadow: true,
      receiveShadow: true,
      occludesSun: false,
      sourceType: obj.type,
      sourceObjectId: obj.id,
    })),
  ];
}

export function convertCanvasToPrimitives(objects: CanvasObject[]): {
  primitives: GardenPrimitive[];
  spacePoints: SpaceSamplePoint[];
};
export function convertCanvasToPrimitives(
  objects: CanvasObject[],
  options: ConvertCanvasToPrimitivesOptions,
): {
  primitives: GardenPrimitive[];
  spacePoints: SpaceSamplePoint[];
};
export function convertCanvasToPrimitives(
  objects: CanvasObject[],
  options: ConvertCanvasToPrimitivesOptions = {},
): {
  primitives: GardenPrimitive[];
  spacePoints: SpaceSamplePoint[];
} {
  const primitives: GardenPrimitive[] = [];
  const spacePoints: SpaceSamplePoint[] = [];
  const { plantsById, speciesById } = options;

  for (const obj of objects) {
    const width = obj.width ?? 80;
    const depth = obj.height ?? 80;
    const [wx, wz] = toWorld(obj.x, obj.y);
    const opacity = obj.opacity ?? 1;
    const assignedSpecies = getAssignedSpecies(obj, plantsById, speciesById);

    switch (obj.type) {
      case 'plot': {
        primitives.push({
          id: `plot-${obj.id}`,
          kind: 'plane',
          color: normalizeCanvasColor(obj.fill, '#7abf78'),
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
          color: normalizeCanvasColor(obj.fill, '#7fc1d6'),
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

      case 'plant': {
        primitives.push(
          ...createGroundPlantPrimitives(
            obj,
            wx,
            wz,
            width,
            depth,
            opacity,
            normalizeCanvasColor(obj.fill, '#5d9c59'),
            normalizeCanvasColor(obj.stroke, '#356b36'),
            assignedSpecies,
          ),
        );
        break;
      }

      case 'raised-bed': {
        const bedHeight = 24; // roughly 12-18 inches in existing px scale
        primitives.push({
          id: `raised-bed-${obj.id}`,
          kind: 'box',
          color: normalizeCanvasColor(obj.fill, '#cd853f'),
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
          color: normalizeCanvasColor(obj.fill, '#8f8f8f'),
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
          color: normalizeCanvasColor(obj.fill, '#8b4513'),
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
        const canopyR = obj.canopyRadius ?? Math.max(40, obj.radius ?? 35);
        primitives.push(
          ...createOrchardTreePrimitives(
            obj,
            wx,
            wz,
            opacity,
            canopyR,
            normalizeCanvasColor(obj.fill, '#228b22'),
            normalizeCanvasColor(obj.stroke, assignedSpecies ? '#d97706' : '#79b45a'),
          ),
        );
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
            color: normalizeCanvasColor(obj.stroke, '#888888'),
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
