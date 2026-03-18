import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type {
  CustomField,
  CustomFieldEntityType,
  CustomFieldType,
} from "./types";

interface CustomFieldsEditorProps {
  entityType: CustomFieldEntityType;
  entityId: number;
}

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Boolean",
};

export function CustomFieldsEditor({ entityType, entityId }: CustomFieldsEditorProps) {
  const queryClient = useQueryClient();
  const cacheKey = ["custom-fields", entityType, entityId];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const res = await (commands as any).listCustomFields(entityType, entityId);
      if (res.status === "error") throw new Error(res.error);
      return res.data as CustomField[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await (commands as any).deleteCustomField(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cacheKey }),
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={500}>Custom fields</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setAddingNew(true)}
          disabled={addingNew}
        >
          Add field
        </Button>
      </Group>

      {isLoading && <Text c="dimmed" size="sm">Loading…</Text>}

      <Table withTableBorder verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((field) =>
            editingId === field.id ? (
              <FieldEditRow
                key={field.id}
                field={field}
                onSaved={() => {
                  setEditingId(null);
                  queryClient.invalidateQueries({ queryKey: cacheKey });
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Table.Tr key={field.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{field.field_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="outline">{TYPE_LABELS[field.field_type]}</Badge>
                </Table.Td>
                <Table.Td>
                  <FieldValueDisplay field={field} />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => setEditingId(field.id)}
                    >
                      <IconPencil size={12} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      loading={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(field.id)}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ),
          )}

          {addingNew && (
            <FieldAddRow
              entityType={entityType}
              entityId={entityId}
              onSaved={() => {
                setAddingNew(false);
                queryClient.invalidateQueries({ queryKey: cacheKey });
              }}
              onCancel={() => setAddingNew(false)}
            />
          )}

          {fields.length === 0 && !addingNew && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text ta="center" c="dimmed" size="sm" py="sm">
                  No custom fields. Click "Add field" to create one.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ————————————————————————————————————————————
// Inline value display
// ————————————————————————————————————————————
function FieldValueDisplay({ field }: { field: CustomField }) {
  const val = field.field_value;
  if (val == null) return <Text size="sm" c="dimmed">—</Text>;
  if (field.field_type === "boolean") {
    return (
      <Badge color={val === "true" ? "green" : "red"} size="sm" variant="light">
        {val === "true" ? "Yes" : "No"}
      </Badge>
    );
  }
  return <Text size="sm">{val}</Text>;
}

// ————————————————————————————————————————————
// Add row
// ————————————————————————————————————————————
function FieldAddRow({
  entityType,
  entityId,
  onSaved,
  onCancel,
}: {
  entityType: CustomFieldEntityType;
  entityId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [value, setValue] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Field name required");
      const res = await (commands as any).createCustomField({
        entity_type: entityType,
        entity_id: entityId,
        field_name: name.trim(),
        field_value: value.trim() || null,
        field_type: type,
      });
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: onSaved,
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          size="xs"
          placeholder="Field name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Table.Td>
      <Table.Td>
        <Select
          size="xs"
          value={type}
          data={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          onChange={(v) => setType((v as CustomFieldType) ?? "text")}
          w={100}
        />
      </Table.Td>
      <Table.Td>
        {type === "boolean" ? (
          <Select
            size="xs"
            value={value}
            data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
            onChange={(v) => setValue(v ?? "")}
            w={80}
          />
        ) : (
          <TextInput
            size="xs"
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <ActionIcon size="xs" color="green" onClick={() => createMutation.mutate()}>
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon size="xs" color="red" variant="subtle" onClick={onCancel}>
            <IconX size={12} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

// ————————————————————————————————————————————
// Edit row
// ————————————————————————————————————————————
function FieldEditRow({
  field,
  onSaved,
  onCancel,
}: {
  field: CustomField;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(field.field_value ?? "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await (commands as any).updateCustomField(field.id, {
        field_name: null,
        field_value: value.trim() || null,
        field_type: null,
      });
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: onSaved,
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500}>{field.field_name}</Text>
      </Table.Td>
      <Table.Td>
        <Badge size="xs" variant="outline">{TYPE_LABELS[field.field_type]}</Badge>
      </Table.Td>
      <Table.Td>
        {field.field_type === "boolean" ? (
          <Select
            size="xs"
            value={value}
            data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
            onChange={(v) => setValue(v ?? "")}
            w={80}
          />
        ) : (
          <TextInput
            size="xs"
            type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <ActionIcon size="xs" color="green" onClick={() => updateMutation.mutate()}>
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon size="xs" variant="subtle" onClick={onCancel}>
            <IconX size={12} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
