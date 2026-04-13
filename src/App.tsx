import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { routeTree } from "./routeTree.gen";
import { useAppStore } from "./stores/appStore";
import { dirtTheme, gruvboxResolver } from "./theme/config";

import bg03 from "../assets/background/active/bg03.jpg";
import bg13 from "../assets/background/active/bg13.jpg";
import bg14 from "../assets/background/active/bg14.jpg";
import bg15 from "../assets/background/active/bg15.jpg";
import bg16 from "../assets/background/active/bg16.jpg";
import bg17 from "../assets/background/active/bg17.jpg";
import bg18 from "../assets/background/active/bg18.jpg";

const BG_IMAGES = [bg03, bg13, bg14, bg15, bg16, bg17, bg18];
const sessionBg = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];

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
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundImage: `url(${sessionBg})`, // Random background image for the session
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.9,  // Subtle opacity for the background image
          filter: "blur(0)", // Slight blur for a softer look
          transform: "scale(1.0)",
          pointerEvents: "none",
        }}
      />
      <ErrorBoundary>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ErrorBoundary>
    </MantineProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function markAppReady(isReady: boolean) {
  document.body.dataset.ready = isReady ? "true" : "false";
}

export default function App() {
  return <ThemedApp />;
}

