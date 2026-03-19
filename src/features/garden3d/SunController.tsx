import { ActionIcon, Group, Select, Slider, Stack, Text } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import SunCalc from 'suncalc';
import { useEffect, useMemo, useState } from 'react';

export interface SunState {
  timestamp: Date;
  altitude: number;
  azimuth: number;
  direction: [number, number, number];
  intensity: number;
}

interface SunControllerProps {
  latitude: number;
  longitude: number;
  onSunChange: (sun: SunState) => void;
}

const PLAY_SPEEDS = [
  { value: '1', label: '1x' },
  { value: '10', label: '10x' },
  { value: '60', label: '60x' },
];

const MINUTES_IN_DAY = 24 * 60;

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sunStateFor(date: Date, lat: number, lon: number): SunState {
  const pos = SunCalc.getPosition(date, lat, lon);
  const altitude = pos.altitude;
  const azimuth = pos.azimuth;

  // Convert SunCalc coordinates into a directional-light position vector.
  const x = Math.cos(altitude) * Math.sin(azimuth);
  const y = Math.sin(altitude);
  const z = Math.cos(altitude) * Math.cos(azimuth);

  return {
    timestamp: date,
    altitude,
    azimuth,
    direction: [x, y, z],
    intensity: Math.max(0.08, Math.max(0, y) * 1.6),
  };
}

export function SunController({ latitude, longitude, onSunChange }: SunControllerProps) {
  const now = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateForInput(now));
  const [minuteOfDay, setMinuteOfDay] = useState<number>(now.getHours() * 60 + now.getMinutes());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<string>('10');

  const speedValue = Number(speed || '10');

  const currentDate = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const next = new Date();
    next.setFullYear(year, (month || 1) - 1, day || 1);
    next.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
    return next;
  }, [selectedDate, minuteOfDay]);

  useEffect(() => {
    onSunChange(sunStateFor(currentDate, latitude, longitude));
  }, [currentDate, latitude, longitude, onSunChange]);

  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;
    let prev = performance.now();

    const tick = (nowMs: number) => {
      const dt = (nowMs - prev) / 1000;
      prev = nowMs;

      setMinuteOfDay((m) => {
        const next = m + dt * speedValue * 8; // 8 simulated minutes per second @1x
        if (next >= MINUTES_IN_DAY) return 0;
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speedValue]);

  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const mm = String(Math.floor(minuteOfDay % 60)).padStart(2, '0');

  return (
    <Stack gap={6}>
      <Group justify='space-between' align='center'>
        <Text size='xs' fw={600}>Solar Controls</Text>
        <Group gap={6}>
          <Select
            size='xs'
            w={72}
            data={PLAY_SPEEDS}
            value={speed}
            onChange={(v) => setSpeed(v ?? '10')}
          />
          <ActionIcon
            size='sm'
            variant='filled'
            color={isPlaying ? 'orange' : 'green'}
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? 'Pause solar animation' : 'Play solar animation'}
          >
            {isPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      <input
        type='date'
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.currentTarget.value)}
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 6,
          padding: '4px 8px',
          background: 'var(--mantine-color-body)',
          color: 'var(--mantine-color-text)',
        }}
      />

      <Slider
        value={minuteOfDay}
        onChange={setMinuteOfDay}
        min={0}
        max={MINUTES_IN_DAY - 1}
        step={5}
        size='sm'
        label={(v) => {
          const h = String(Math.floor(v / 60)).padStart(2, '0');
          const m = String(v % 60).padStart(2, '0');
          return `${h}:${m}`;
        }}
      />

      <Text size='xs' c='dimmed'>
        Time: {hh}:{mm}
      </Text>
    </Stack>
  );
}

export function getSunStateFor(date: Date, latitude: number, longitude: number): SunState {
  return sunStateFor(date, latitude, longitude);
}
