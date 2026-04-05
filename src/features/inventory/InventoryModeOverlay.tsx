import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Kbd,
  Loader,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBarcode,
  IconAlertCircle,
  IconArrowRight,
  IconLeaf,
  IconCloud,
  IconSeedling,
  IconBasket,
  IconPackage,
} from '@tabler/icons-react';
import { useInventoryScanner } from '../../hooks/useInventoryScanner';
import { commands } from '../../lib/bindings';
import type { AssetTagLookup } from '../../lib/bindings';

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  plant: <IconLeaf size={20} />,
  environment: <IconCloud size={20} />,
  location: <IconSeedling size={20} />,
  seedling_tray: <IconSeedling size={20} />,
  seed_lot: <IconPackage size={20} />,
  harvest: <IconBasket size={20} />,
};

const ENTITY_COLORS: Record<string, string> = {
  plant: 'green',
  environment: 'blue',
  location: 'teal',
  seedling_tray: 'cyan',
  seed_lot: 'orange',
  harvest: 'yellow',
};

function entityRoute(result: AssetTagLookup): string | null {
  switch (result.entity_type) {
    case 'plant':
      return `/plants/individuals/${result.entity_id}`;
    case 'environment':
      return `/garden/${result.entity_id}`;
    case 'location':
      return `/garden/${result.entity_id}`;
    case 'seed_lot':
      return `/plants/seeds`;
    case 'seedling_tray':
      return `/plants/trays`;
    case 'harvest':
      return `/plants/individuals/${result.entity_id}`;
    default:
      return null;
  }
}

interface Props {
  /** Whether inventory mode is currently active */
  enabled: boolean;
}

/**
 * InventoryModeOverlay
 *
 * When inventory mode is active this component:
 *   1. Runs the global barcode scanner hook.
 *   2. On a valid scan, calls `lookup_asset_tag` and shows a Drawer with the
 *      matched entity details.
 *   3. Offers a "Go to record" button to navigate to the relevant detail page.
 */
export function InventoryModeOverlay({ enabled }: Props) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssetTagLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTag, setLastTag] = useState<string>('');

  const handleScan = useCallback(async (tag: string) => {
    setLastTag(tag);
    setLoading(true);
    setError(null);
    setResult(null);
    setDrawerOpen(true);

    try {
      const res = await commands.lookupAssetTag(tag);
      if (res.status !== 'ok') {
        setError(res.error);
        return;
      }
      if (res.data) {
        setResult(res.data);
      } else {
        setError(`No record found for tag: ${tag}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useInventoryScanner(handleScan, enabled);

  const handleNavigate = () => {
    if (!result) return;
    const route = entityRoute(result);
    if (route) {
      navigate({ to: route as any });
      setDrawerOpen(false);
    }
  };

  return (
    <Drawer
      opened={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      position="bottom"
      size="auto"
      title={
        <Group gap="xs">
          <IconBarcode size={20} />
          <Text fw={600}>Scanned: <Kbd>{lastTag}</Kbd></Text>
        </Group>
      }
      styles={{ content: { minHeight: 180 } }}
    >
      <Stack gap="md" p="sm">
        {loading && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Looking up asset tag…</Text>
          </Group>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Not found">
            {error}
          </Alert>
        )}

        {result && (
          <>
            <Group gap="md" align="flex-start">
              <ThemeIcon
                size="xl"
                radius="md"
                color={ENTITY_COLORS[result.entity_type] ?? 'gray'}
                variant="light"
              >
                {ENTITY_ICONS[result.entity_type] ?? <IconBarcode size={20} />}
              </ThemeIcon>

              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={700} size="lg">{result.display_name}</Text>
                  <Badge size="sm" color={ENTITY_COLORS[result.entity_type] ?? 'gray'} variant="light">
                    {result.entity_type.replace('_', ' ')}
                  </Badge>
                </Group>
                {result.description && (
                  <Text size="sm" c="dimmed">{result.description}</Text>
                )}
                <Text size="xs" ff="monospace" c="dimmed">{result.asset_tag}</Text>
              </Stack>
            </Group>

            {entityRoute(result) && (
              <Button
                rightSection={<IconArrowRight size={16} />}
                onClick={handleNavigate}
                variant="filled"
              >
                Go to record
              </Button>
            )}
          </>
        )}
      </Stack>
    </Drawer>
  );
}
