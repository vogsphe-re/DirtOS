import { ActionIcon, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload } from "@tabler/icons-react";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../lib/bindings";

interface MediaUploaderProps {
  entityType: string;
  entityId: number;
  /** Query key(s) to invalidate on successful upload. */
  queryKeys?: unknown[][];
  label?: string;
  compact?: boolean;
}

export function MediaUploader({
  entityType,
  entityId,
  queryKeys = [],
  label = "Upload Photo",
  compact = false,
}: MediaUploaderProps) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await commands.uploadMedia(entityType, entityId, filePath);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media", entityType, entityId] });
      for (const qk of queryKeys) {
        queryClient.invalidateQueries({ queryKey: qk });
      }
      notifications.show({ message: "Photo uploaded.", color: "green" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Upload failed", message: err.message, color: "red" }),
  });

  const handleClick = async () => {
    const selected = await dialogOpen({
      multiple: false,
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "heic"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!selected) return;
    // plugin-dialog open() with multiple:false returns string | null
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;
    uploadMutation.mutate(path);
  };

  if (compact) {
    return (
      <ActionIcon
        variant="light"
        size="sm"
        onClick={handleClick}
        loading={uploadMutation.isPending}
        title={label}
      >
        <IconUpload size={14} />
      </ActionIcon>
    );
  }

  return (
    <Button
      variant="light"
      size="xs"
      leftSection={<IconPhoto size={14} />}
      onClick={handleClick}
      loading={uploadMutation.isPending}
    >
      {label}
    </Button>
  );
}
