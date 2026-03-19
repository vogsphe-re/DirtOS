import { SegmentedControl } from '@mantine/core';

export type GardenViewMode = '2d' | '3d';

interface ViewToggleProps {
  value: GardenViewMode;
  onChange: (mode: GardenViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <SegmentedControl
      size='xs'
      value={value}
      onChange={(next) => onChange(next as GardenViewMode)}
      data={[
        { label: '2D Editor', value: '2d' },
        { label: '3D Preview', value: '3d' },
      ]}
    />
  );
}
