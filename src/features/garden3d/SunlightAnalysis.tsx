import { Badge, Group, Stack, Text } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import type { GardenPrimitive, SpaceSamplePoint } from './objectConverters';
import { getSunStateFor } from './SunController';

interface BoxAABB {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SpaceExposure {
  spaceId: string;
  hours: number;
  label: 'full' | 'partial' | 'shade';
  warning: string | null;
}

interface SunlightAnalysisProps {
  date: Date;
  latitude: number;
  longitude: number;
  spaces: SpaceSamplePoint[];
  occluders: GardenPrimitive[];
  getSunRequirement: (assignedPlantId?: number | null) => string | null;
  onComputed: (result: Record<string, SpaceExposure>) => void;
}

function primitiveToAabb(p: GardenPrimitive): BoxAABB | null {
  const [px, py, pz] = p.position;

  if (p.kind === 'box' && p.size) {
    const [w, h, d] = p.size;
    return {
      min: [px - w / 2, py - h / 2, pz - d / 2],
      max: [px + w / 2, py + h / 2, pz + d / 2],
    };
  }

  if (p.kind === 'cylinder' && p.radius != null && p.height != null) {
    return {
      min: [px - p.radius, py - p.height / 2, pz - p.radius],
      max: [px + p.radius, py + p.height / 2, pz + p.radius],
    };
  }

  if (p.kind === 'sphere' && p.radius != null) {
    return {
      min: [px - p.radius, py - p.radius, pz - p.radius],
      max: [px + p.radius, py + p.radius, pz + p.radius],
    };
  }

  return null;
}

function rayIntersectsAabb(
  origin: [number, number, number],
  dir: [number, number, number],
  box: BoxAABB,
  maxDistance: number,
): boolean {
  let tMin = 0;
  let tMax = maxDistance;

  for (let axis = 0; axis < 3; axis += 1) {
    const o = origin[axis];
    const d = dir[axis];
    const bMin = box.min[axis];
    const bMax = box.max[axis];

    if (Math.abs(d) < 1e-6) {
      if (o < bMin || o > bMax) return false;
      continue;
    }

    const invD = 1 / d;
    let t1 = (bMin - o) * invD;
    let t2 = (bMax - o) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMax < tMin) return false;
  }

  return tMax >= 0 && tMin <= maxDistance;
}

function classify(hours: number): 'full' | 'partial' | 'shade' {
  if (hours >= 6) return 'full';
  if (hours >= 3) return 'partial';
  return 'shade';
}

function requirementMismatch(requirement: string | null, hours: number): string | null {
  if (!requirement) return null;
  const req = requirement.toLowerCase();

  if (req.includes('full') && hours < 6) return 'Needs full sun but receives less than 6h';
  if ((req.includes('part') || req.includes('partial')) && (hours < 3 || hours > 8)) {
    return 'Partial-sun species outside ideal exposure range';
  }
  if (req.includes('shade') && hours > 4) return 'Shade species may be overexposed';
  return null;
}

export function SunlightAnalysis({
  date,
  latitude,
  longitude,
  spaces,
  occluders,
  getSunRequirement,
  onComputed,
}: SunlightAnalysisProps) {
  const computed = useMemo(() => {
    const boxes = occluders.map(primitiveToAabb).filter((b): b is BoxAABB => b != null);
    const results: Record<string, SpaceExposure> = {};

    for (const space of spaces) {
      let litSamples = 0;
      let totalSamples = 0;

      for (let hour = 0; hour < 24; hour += 1) {
        for (const minute of [0, 30]) {
          const sampleDate = new Date(date);
          sampleDate.setHours(hour, minute, 0, 0);

          const sun = getSunStateFor(sampleDate, latitude, longitude);
          if (sun.altitude <= 0) continue;

          totalSamples += 1;
          const origin: [number, number, number] = [space.position[0], space.position[1], space.position[2]];
          const dir = sun.direction;
          const length = 5_000;

          const blocked = boxes.some((box) => rayIntersectsAabb(origin, dir, box, length));
          if (!blocked) litSamples += 1;
        }
      }

      const hours = totalSamples > 0 ? litSamples * 0.5 : 0;
      const req = getSunRequirement(space.assignedPlantId);
      const warning = requirementMismatch(req, hours);

      results[space.objectId] = {
        spaceId: space.objectId,
        hours,
        label: classify(hours),
        warning,
      };
    }

    return results;
  }, [date, latitude, longitude, spaces, occluders, getSunRequirement]);

  useEffect(() => {
    onComputed(computed);
  }, [computed, onComputed]);

  const rows = Object.values(computed);

  return (
    <Stack gap={4}>
      <Text size='xs' fw={600}>Sunlight Exposure (30m samples)</Text>
      {rows.length === 0 ? (
        <Text size='xs' c='dimmed'>No spaces available for analysis.</Text>
      ) : (
        rows.slice(0, 6).map((row) => (
          <Group key={row.spaceId} gap={6} wrap='nowrap' justify='space-between'>
            <Text size='xs' c='dimmed' truncate>
              {row.spaceId}
            </Text>
            <Group gap={5} wrap='nowrap'>
              <Badge
                size='xs'
                color={row.label === 'full' ? 'green' : row.label === 'partial' ? 'yellow' : 'red'}
              >
                {row.hours.toFixed(1)} h
              </Badge>
              {row.warning && (
                <Badge size='xs' color='orange'>
                  mismatch
                </Badge>
              )}
            </Group>
          </Group>
        ))
      )}
    </Stack>
  );
}
