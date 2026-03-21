import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unexpected application error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DirtOS render failure", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Stack justify="center" align="center" mih="100vh" p="xl">
        <Stack className="dirtos-glass" maw={520} w="100%" p="xl" gap="md">
          <Title order={2}>Application Error</Title>
          <Text c="dimmed">
            DirtOS hit a rendering error and stopped this screen to avoid corrupting your current session.
          </Text>
          <Text className="dirtos-mono" size="sm">
            {this.state.message}
          </Text>
          <Group>
            <Button leftSection={<IconReload size={16} />} onClick={() => window.location.reload()}>
              Reload application
            </Button>
          </Group>
        </Stack>
      </Stack>
    );
  }
}
