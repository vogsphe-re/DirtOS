import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import Barcode from 'react-barcode';
import { IconPrinter, IconFilter } from '@tabler/icons-react';
import { commands } from '../../lib/bindings';
import type { AssetTagLookup } from '../../lib/bindings';

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'plant', label: 'Plants' },
  { value: 'environment', label: 'Environments / Gardens' },
  { value: 'location', label: 'Locations (beds, plots, tents…)' },
  { value: 'seedling_tray', label: 'Seedling trays' },
  { value: 'seed_lot', label: 'Seed lots' },
  { value: 'harvest', label: 'Harvests' },
];

/**
 * BarcodeLabelPrintPage
 *
 * Loads all tagged entities (optionally filtered by type), renders them as
 * 2″ × 1.5″ barcode labels, and lets the user print them via the browser's
 * native print dialog (where "Save as PDF" is available on most platforms).
 */
export function BarcodeLabelPrintPage() {
  const [entityType, setEntityType] = useState('');
  const [items, setItems] = useState<AssetTagLookup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const result = await commands.listAssetTags(entityType || null);
      if (result.status !== 'ok') return;
      setItems(result.data);
      setSelected(new Set(result.data.map((r) => r.asset_tag)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setSelected(next);
  };

  const printLabels = () => {
    window.print();
  };

  const printItems = items.filter((i) => selected.has(i.asset_tag));

  return (
    <>
      {/* ── Print stylesheet ─────────────────────────────────────────── */}
      <style>{`
        @media print {
          body > *:not(#barcode-print-root) { display: none !important; }
          #barcode-print-root .no-print      { display: none !important; }
          #barcode-print-root .label-card {
            page-break-after: always;
            break-after: page;
          }
          @page { size: 2in 1.5in; margin: 0; }
        }
      `}</style>

      <div id="barcode-print-root">
        {/* ── Controls (hidden on print) ──────────────────────────────── */}
        <Stack gap="md" p="md" className="no-print">
          <Title order={3}>Print Barcode Labels</Title>
          <Text size="sm" c="dimmed">
            Select entity types, load the list, choose which labels to print,
            then click Print. From the print dialog you can "Save as PDF" to
            produce a file formatted for 2 × 1.5 inch labels (1 per page).
          </Text>

          <Group align="flex-end" gap="sm">
            <Select
              label="Filter by type"
              leftSection={<IconFilter size={14} />}
              data={ENTITY_TYPE_OPTIONS}
              value={entityType}
              onChange={(v) => setEntityType(v ?? '')}
              w={260}
              clearable
            />
            <Button onClick={loadItems} loading={loading}>
              Load labels
            </Button>
          </Group>

          {items.length > 0 && (
            <>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setSelected(new Set(items.map((i) => i.asset_tag)))}
                >
                  Select all
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setSelected(new Set())}
                >
                  Deselect all
                </Button>
                <Text size="xs" c="dimmed">
                  {selected.size} of {items.length} selected
                </Text>
              </Group>

              <Stack gap={4} mah={320} style={{ overflowY: 'auto' }}>
                {items.map((item) => (
                  <Checkbox
                    key={item.asset_tag}
                    checked={selected.has(item.asset_tag)}
                    onChange={() => toggleSelect(item.asset_tag)}
                    label={
                      <Group gap="xs">
                        <Text size="sm" ff="monospace" fw={600}>
                          {item.asset_tag}
                        </Text>
                        <Text size="sm">{item.display_name}</Text>
                        {item.description && (
                          <Text size="xs" c="dimmed">
                            ({item.description})
                          </Text>
                        )}
                      </Group>
                    }
                  />
                ))}
              </Stack>

              <Button
                leftSection={<IconPrinter size={18} />}
                onClick={printLabels}
                disabled={selected.size === 0}
                variant="filled"
              >
                Print {selected.size > 0 ? `${selected.size} label${selected.size !== 1 ? 's' : ''}` : 'labels'}
              </Button>
            </>
          )}
        </Stack>

        {/* ── Print labels ────────────────────────────────────────────── */}
        {printItems.map((item) => (
          <Box
            key={item.asset_tag}
            className="label-card"
            style={{
              width: '2in',
              height: '1.5in',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <Barcode
              value={item.asset_tag}
              format="CODE128"
              width={1.3}
              height={52}
              displayValue={false}
              margin={2}
              background="white"
            />
            <Text
              size="xs"
              ff="monospace"
              fw={700}
              lts={1}
              style={{ fontSize: '9pt', marginTop: 2 }}
            >
              {item.asset_tag}
            </Text>
            <Text
              size="xs"
              style={{ fontSize: '7pt', color: '#555', textAlign: 'center', lineHeight: 1.2 }}
            >
              {item.display_name}
              {item.description ? ` · ${item.description}` : ''}
            </Text>
          </Box>
        ))}
      </div>
    </>
  );
}
