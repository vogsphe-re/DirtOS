import { useRef } from 'react';
import Barcode from 'react-barcode';
import { Box, CopyButton, Group, Stack, Text, Tooltip, ActionIcon } from '@mantine/core';
import { IconCopy, IconCheck, IconDownload } from '@tabler/icons-react';

interface Props {
  tag: string | null | undefined;
  /** Optional human-readable label shown below the barcode */
  label?: string;
  /** Width of each barcode bar in pixels (default: 1.5) */
  barWidth?: number;
  /** Height of barcode bars in pixels (default: 48) */
  barHeight?: number;
  /** When true the component renders nothing if tag is null/undefined */
  hideWhenEmpty?: boolean;
}

/**
 * AssetTagBadge
 *
 * Renders a Code-128 barcode generated from an asset tag string plus
 * copy-to-clipboard and save-as-PNG controls.
 */
export function AssetTagBadge({
  tag,
  label,
  barWidth = 1.5,
  barHeight = 48,
  hideWhenEmpty = true,
}: Props) {
  const svgRef = useRef<HTMLDivElement>(null);

  if (!tag && hideWhenEmpty) return null;
  if (!tag) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        No asset tag assigned
      </Text>
    );
  }

  const saveAsPng = () => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = `${tag}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  return (
    <Stack gap={4} align="center">
      <div ref={svgRef}>
        <Barcode
          value={tag}
          format="CODE128"
          width={barWidth}
          height={barHeight}
          displayValue={false}
          margin={4}
          background="transparent"
        />
      </div>

      <Group gap={6} align="center" wrap="nowrap">
        <Text
          size="xs"
          ff="monospace"
          fw={700}
          lts={1}
          style={{ userSelect: 'all' }}
        >
          {tag}
        </Text>

        <CopyButton value={tag} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied!' : 'Copy tag'} position="top" withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color={copied ? 'teal' : 'gray'}
                onClick={copy}
              >
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>

        <Tooltip label="Save as PNG" position="top" withArrow>
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={saveAsPng}>
            <IconDownload size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {label && (
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      )}
    </Stack>
  );
}

/**
 * Compact inline tag text (no barcode) for use in tables or lists.
 */
export function AssetTagInline({ tag }: { tag: string | null | undefined }) {
  if (!tag) return null;
  return (
    <Box
      component="span"
      style={{
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        background: 'var(--mantine-color-gray-1)',
        borderRadius: '4px',
        padding: '1px 5px',
        letterSpacing: '0.05em',
      }}
    >
      {tag}
    </Box>
  );
}
