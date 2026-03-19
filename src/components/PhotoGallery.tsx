import {
  ActionIcon,
  Box,
  Group,
  Image,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Media } from "../lib/bindings";
import { commands } from "../lib/bindings";
import { MediaUploader } from "./MediaUploader";

interface PhotoGalleryProps {
  entityType: string;
  entityId: number;
  readonly?: boolean;
}

function useMediaBase64(id: number, thumbnail: boolean, enabled = true) {
  return useQuery({
    queryKey: ["media-b64", id, thumbnail],
    queryFn: async () => {
      const res = await commands.readMediaBase64(id, thumbnail);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled,
    staleTime: Infinity, // file content won't change
  });
}

function Thumbnail({
  media,
  onClick,
}: {
  media: Media;
  onClick: () => void;
}) {
  const isImage = media.mime_type?.startsWith("image/") ?? false;
  const { data: b64, isLoading } = useMediaBase64(media.id, true, isImage);

  return (
    <Box
      style={{
        width: 90,
        height: 90,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--mantine-color-default-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
      onClick={onClick}
    >
      {isLoading ? (
        <Loader size="xs" />
      ) : b64 ? (
        <Image
          src={`data:${b64.mime_type};base64,${b64.data}`}
          alt={media.file_name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Text size="xs" c="dimmed" ta="center" px={4}>
          {media.file_name}
        </Text>
      )}
    </Box>
  );
}

function LightboxModal({
  mediaList,
  initialIndex,
  onClose,
  onDelete,
}: {
  mediaList: Media[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const media = mediaList[index];
  const isImage = media?.mime_type?.startsWith("image/") ?? false;
  const { data: b64, isLoading } = useMediaBase64(media?.id ?? 0, false, !!media && isImage);

  return (
    <Modal
      opened
      onClose={onClose}
      size="xl"
      padding="xs"
      withCloseButton={false}
      styles={{ body: { padding: 0 } }}
    >
      <Stack gap={0}>
        {/* toolbar */}
        <Group justify="space-between" px="sm" py={6}>
          <Text size="sm" c="dimmed" lineClamp={1}>
            {media?.file_name}
          </Text>
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => {
                onDelete(media.id);
                if (index === mediaList.length - 1 && index > 0) setIndex(index - 1);
                else if (mediaList.length === 1) onClose();
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" size="sm" onClick={onClose}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Group>

        {/* image */}
        <Box
          style={{
            minHeight: 400,
            maxHeight: "70vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            position: "relative",
          }}
        >
          {isLoading ? (
            <Loader color="white" />
          ) : b64 ? (
            <img
              src={`data:${b64.mime_type};base64,${b64.data}`}
              alt={media?.file_name}
              style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
            />
          ) : (
            <Text c="dimmed">Preview not available</Text>
          )}

          {/* prev / next */}
          {index > 0 && (
            <ActionIcon
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}
              variant="filled"
              color="dark"
              onClick={() => setIndex(index - 1)}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
          )}
          {index < mediaList.length - 1 && (
            <ActionIcon
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
              variant="filled"
              color="dark"
              onClick={() => setIndex(index + 1)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          )}
        </Box>

        <Text size="xs" c="dimmed" ta="center" py={4}>
          {index + 1} / {mediaList.length}
        </Text>
      </Stack>
    </Modal>
  );
}

export function PhotoGallery({ entityType, entityId, readonly = false }: PhotoGalleryProps) {
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: mediaList = [], isLoading } = useQuery<Media[]>({
    queryKey: ["media", entityType, entityId],
    queryFn: async () => {
      const res = await commands.listMedia(entityType, entityId);
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
    enabled: !!entityId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await commands.deleteMedia(id);
      if (res.status === "error") throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media", entityType, entityId] });
      notifications.show({ message: "Photo deleted.", color: "orange" });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Error", message: err.message, color: "red" }),
  });

  if (isLoading) return <Loader size="sm" />;

  const images = mediaList.filter((m) => m.mime_type?.startsWith("image/") ?? false);

  return (
    <Stack gap="sm">
      {!readonly && (
        <Group>
          <MediaUploader entityType={entityType} entityId={entityId} />
        </Group>
      )}

      {images.length === 0 && (
        <Text size="sm" c="dimmed">
          {readonly ? "No photos." : "No photos yet. Upload one above."}
        </Text>
      )}

      <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }} spacing="xs">
        {images.map((m, i) => (
          <Thumbnail key={m.id} media={m} onClick={() => setLightboxIndex(i)} />
        ))}
      </SimpleGrid>

      {lightboxIndex !== null && images.length > 0 && (
        <LightboxModal
          mediaList={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={(id) => {
            deleteMutation.mutate(id);
            // Close lightbox if this was the last photo
            if (images.length <= 1) setLightboxIndex(null);
          }}
        />
      )}
    </Stack>
  );
}
