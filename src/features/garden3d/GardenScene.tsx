import { Box, Paper, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, Html, OrbitControls, Sky, useGLTF } from '@react-three/drei';
import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { commands } from '../../lib/bindings';
import type { Plant, Species } from '../../lib/bindings';
import { useCanvasStore } from '../garden/canvasStore';
import type { CanvasObject } from '../garden/types';
import { ModelImporter } from './ModelImporter';
import { SunController, type SunState } from './SunController';
import { SunlightAnalysis, type SpaceExposure } from './SunlightAnalysis';
import { convertCanvasToPrimitives, splitSunOccluders, type GardenPrimitive } from './objectConverters';

interface GardenSceneProps {
  environmentId: number | null;
}

function CameraIntro() {
  const { camera } = useThree();
  const start = useMemo(() => new THREE.Vector3(0, 560, 0.01), []);
  const end = useMemo(() => new THREE.Vector3(220, 220, 280), []);
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const progressRef = useState({ value: 0 })[0];

  useFrame((_, delta) => {
    if (progressRef.value >= 1) return;
    progressRef.value = Math.min(1, progressRef.value + delta * 0.9);
    const t = 1 - Math.pow(1 - progressRef.value, 3);
    camera.position.lerpVectors(start, end, t);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  });

  return null;
}

function toShadowColor(label: SpaceExposure['label'] | undefined): string {
  if (label === 'full') return '#34c759';
  if (label === 'partial') return '#f4b740';
  if (label === 'shade') return '#e5484d';
  return '#7a8a99';
}

function ImportedModelPrimitive({ primitive }: { primitive: GardenPrimitive }) {
  const path = primitive.modelPath;
  if (!path) return null;

  const safeUrl = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : convertFileSrc(path);

  const { scene } = useGLTF(safeUrl);
  const clone = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={clone}
      position={primitive.position}
      rotation={primitive.rotation}
      scale={primitive.modelScale ?? 1}
      castShadow={primitive.castShadow}
      receiveShadow={primitive.receiveShadow}
    />
  );
}

function PrimitiveMesh({
  primitive,
  exposure,
}: {
  primitive: GardenPrimitive;
  exposure?: SpaceExposure;
}) {
  const color = exposure ? toShadowColor(exposure.label) : primitive.color;
  const opacity = exposure ? 0.45 : primitive.opacity;

  if (primitive.kind === 'model') {
    return <ImportedModelPrimitive primitive={primitive} />;
  }

  if (primitive.kind === 'plane' && primitive.size) {
    const [w, h] = primitive.size;
    const showTooltip = primitive.sourceType === 'space' && exposure;

    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        receiveShadow={primitive.receiveShadow}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={new THREE.Color(color)}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
        />
        {showTooltip && (
          <Html center distanceFactor={12}>
            <Paper px={6} py={3} withBorder shadow='sm'>
              <Text size='xs'>{exposure.hours.toFixed(1)} h sunlight</Text>
            </Paper>
          </Html>
        )}
      </mesh>
    );
  }

  if (primitive.kind === 'box' && primitive.size) {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow={primitive.castShadow}
        receiveShadow={primitive.receiveShadow}
      >
        <boxGeometry args={primitive.size} />
        <meshStandardMaterial color={new THREE.Color(color)} transparent opacity={opacity} />
      </mesh>
    );
  }

  if (primitive.kind === 'cylinder' && primitive.radius != null && primitive.height != null) {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow={primitive.castShadow}
        receiveShadow={primitive.receiveShadow}
      >
        <cylinderGeometry args={[primitive.radius, primitive.radius, primitive.height, 16]} />
        <meshStandardMaterial color={new THREE.Color(color)} transparent opacity={opacity} />
      </mesh>
    );
  }

  if (primitive.kind === 'sphere' && primitive.radius != null) {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow={primitive.castShadow}
        receiveShadow={primitive.receiveShadow}
      >
        <sphereGeometry args={[primitive.radius, 20, 18]} />
        <meshStandardMaterial color={new THREE.Color(color)} transparent opacity={opacity} />
      </mesh>
    );
  }

  return null;
}

export function GardenScene({ environmentId }: GardenSceneProps) {
  const objects = useCanvasStore((s) => s.objects);
  const [sunState, setSunState] = useState<SunState | null>(null);
  const [analysisDate, setAnalysisDate] = useState<Date>(new Date());
  const [exposures, setExposures] = useState<Record<string, SpaceExposure>>({});

  const { data: environment } = useQuery({
    queryKey: ['environment-for-3d', environmentId],
    queryFn: async () => {
      if (!environmentId) return null;
      const res = await commands.getEnvironment(environmentId);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    enabled: environmentId != null,
  });

  const { data: allPlants = [] } = useQuery<Plant[]>({
    queryKey: ['plants-all-3d'],
    queryFn: async () => {
      const res = await commands.listAllPlants(1000, 0);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    enabled: environmentId != null,
  });

  const { data: allSpecies = [] } = useQuery<Species[]>({
    queryKey: ['species-all-3d'],
    queryFn: async () => {
      const res = await commands.listSpecies(null, null, null, null, 1000, 0);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    enabled: environmentId != null,
  });

  const plantsById = useMemo(() => {
    const map = new Map<number, Plant>();
    for (const plant of allPlants) map.set(plant.id, plant);
    return map;
  }, [allPlants]);

  const speciesById = useMemo(() => {
    const map = new Map<number, Species>();
    for (const species of allSpecies) map.set(species.id, species);
    return map;
  }, [allSpecies]);

  const { primitives, spacePoints } = useMemo(() => convertCanvasToPrimitives(objects as CanvasObject[]), [objects]);
  const { occluders, visible } = useMemo(() => splitSunOccluders(primitives), [primitives]);

  const bounds = useMemo(() => {
    if (objects.length === 0) return { width: 600, depth: 600 };
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const obj of objects) {
      const x1 = obj.x - (obj.width ?? 40) / 2;
      const x2 = obj.x + (obj.width ?? 40) / 2;
      const y1 = obj.y - (obj.height ?? 40) / 2;
      const y2 = obj.y + (obj.height ?? 40) / 2;
      minX = Math.min(minX, x1);
      maxX = Math.max(maxX, x2);
      minY = Math.min(minY, y1);
      maxY = Math.max(maxY, y2);
    }

    return {
      width: Math.max(600, maxX - minX + 240),
      depth: Math.max(600, maxY - minY + 240),
    };
  }, [objects]);

  const lat = environment?.latitude ?? 0;
  const lon = environment?.longitude ?? 0;

  const getSunRequirement = useCallback((assignedPlantId?: number | null): string | null => {
    if (!assignedPlantId) return null;
    const plant = plantsById.get(assignedPlantId);
    if (!plant?.species_id) return null;
    return speciesById.get(plant.species_id)?.sun_requirement ?? null;
  }, [plantsById, speciesById]);

  const sunlightWarnings = useMemo(() => {
    return Object.values(exposures).filter((e) => e.warning != null);
  }, [exposures]);

  return (
    <Box style={{ position: 'relative', height: '100%', width: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [220, 220, 280], fov: 45 }}
        gl={{ antialias: true }}
      >
        <CameraIntro />
        <ambientLight intensity={0.35} />

        <directionalLight
          position={sunState ? [sunState.direction[0] * 700, Math.max(20, sunState.direction[1] * 700), sunState.direction[2] * 700] : [200, 280, 160]}
          intensity={sunState?.intensity ?? 1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={2000}
          shadow-camera-left={-600}
          shadow-camera-right={600}
          shadow-camera-top={600}
          shadow-camera-bottom={-600}
        />

        <Sky
          distance={2500}
          sunPosition={sunState ? [sunState.direction[0], Math.max(0.05, sunState.direction[1]), sunState.direction[2]] : [0.35, 0.8, 0.2]}
          inclination={0}
          azimuth={0.25}
        />

        <Environment preset='city' />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[bounds.width, bounds.depth]} />
          <meshStandardMaterial color='#d8e3cd' />
        </mesh>

        <Grid
          args={[bounds.width, bounds.depth]}
          cellColor='#9db0a4'
          sectionColor='#5f7f66'
          cellSize={20}
          sectionSize={100}
          fadeDistance={2200}
          fadeStrength={1}
          infiniteGrid
        />

        {visible.map((primitive) => (
          <PrimitiveMesh
            key={primitive.id}
            primitive={primitive}
            exposure={
              primitive.sourceType === 'space'
                ? exposures[primitive.sourceObjectId]
                : undefined
            }
          />
        ))}

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.05}
          maxDistance={2200}
          minDistance={60}
        />
      </Canvas>

      <Paper
        withBorder
        shadow='md'
        p='xs'
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: 290,
          backdropFilter: 'blur(6px)',
          background: 'var(--app-shell-panel)',
        }}
      >
        <Stack gap={8}>
          <SunController
            latitude={lat}
            longitude={lon}
            onSunChange={(next) => {
              setSunState(next);
              setAnalysisDate(next.timestamp);
            }}
          />

          <SunlightAnalysis
            date={analysisDate}
            latitude={lat}
            longitude={lon}
            spaces={spacePoints}
            occluders={occluders}
            getSunRequirement={getSunRequirement}
            onComputed={setExposures}
          />

          <ModelImporter />

          {sunlightWarnings.length > 0 && (
            <Stack gap={2}>
              <Text size='xs' fw={600} c='orange'>Exposure Warnings</Text>
              {sunlightWarnings.slice(0, 5).map((warn) => (
                <Text key={warn.spaceId} size='xs' c='dimmed'>
                  {warn.spaceId}: {warn.warning}
                </Text>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
