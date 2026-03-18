import { createFileRoute } from "@tanstack/react-router";
import { Button, Text, Title, Stack, Alert } from "@mantine/core";
import { useState } from "react";
import { commands } from "@/lib/bindings";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [result, setResult] = useState<string | null>(null);

  async function testIPC() {
    const res = await commands.greet("DirtOS Developer");
    setResult(res.message);
  }

  return (
    <Stack p="md">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">Welcome to DirtOS. Your garden at a glance.</Text>
      {/* Phase 0 IPC smoke-test — remove after verification */}
      <Button w={200} onClick={testIPC} variant="light" color="green">
        Test IPC (Phase 0)
      </Button>
      {result && (
        <Alert color="green" title="IPC Response">
          {result}
        </Alert>
      )}
    </Stack>
  );
}
