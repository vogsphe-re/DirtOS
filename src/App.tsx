import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { routeTree } from "./routeTree.gen";
import { useAppStore } from "./stores/appStore";
import { dirtTheme, gruvboxResolver } from "./theme/config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function ThemedApp() {
  const colorSchemePreference = useAppStore((s) => s.colorScheme);

  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemScheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const colorScheme = useMemo(
    () => (colorSchemePreference === "system" ? systemScheme : colorSchemePreference),
    [colorSchemePreference, systemScheme]
  );

  useEffect(() => {
    document.body.dataset.ready = "false";
  }, []);

  return (
    <MantineProvider theme={dirtTheme} forceColorScheme={colorScheme} cssVariablesResolver={gruvboxResolver}>
      <ErrorBoundary>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ErrorBoundary>
    </MantineProvider>
  );
}

export function markAppReady(isReady: boolean) {
  document.body.dataset.ready = isReady ? "true" : "false";
}

export default function App() {
  return <ThemedApp />;
}

