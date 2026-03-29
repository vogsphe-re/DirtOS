import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { routeTree } from "./routeTree.gen";
import { useAppStore } from "./stores/appStore";
import { dirtTheme, gruvboxResolver } from "./theme/config";

import bg01 from "../assets/background/bg01.jpg";
import bg02 from "../assets/background/bg02.jpg";
import bg03 from "../assets/background/bg03.jpg";
import bg04 from "../assets/background/bg04.jpg";
import bg05 from "../assets/background/bg05.jpg";
import bg06 from "../assets/background/bg06.jpg";
import bg07 from "../assets/background/bg07.jpg";
import bg08 from "../assets/background/bg08.jpg";
import bg09 from "../assets/background/bg09.jpg";
import bg10 from "../assets/background/bg10.jpg";
import bg11 from "../assets/background/bg11.jpg";
import bg12 from "../assets/background/bg12.jpg";

const BG_IMAGES = [bg01, bg02, bg03, bg04, bg05, bg06, bg07, bg08, bg09, bg10, bg11, bg12];
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
          opacity: 0.4,  // Subtle opacity for the background image
          filter: "blur(2px)", // Slight blur for a softer look
          transform: "scale(1.04)",
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

