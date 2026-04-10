import { createTheme, type CSSVariablesResolver } from "@mantine/core";

export const gruvbox = {
  dark: {
    bg: "#282828",
    gray: "#928374",
    red: "#cc241d",
    red_h: "#fb4934",
    green: "#98971a",
    green_h: "#b8bb26",
    yellow: "#d79921",
    yellow_h: "#fabd2f",
    orange: "#d65d0e",
    orange_h: "#fe8019",
    blue: "#458588",
    blue_h: "#83a598",
    purple: "#b16286",
    purple_h: "#d3869b",
    aqua: "#689d6a",
    aqua_h: "#8ec07c",
    gray_h: "#a89984",
    fg: "#ebdbb2",
    fg0: "#fbf1c7",
    fg1: "#ebdbb2",
    fg2: "#d5c4a1",
    fg3: "#bdae93",
    fg4: "#a89984",
    bg0_h: "#1d2021",
    bg0: "#282828",
    bg0_s: "#32302f",
    bg1: "#3c3836",
    bg2: "#504945",
    bg3: "#665c54",
    bg4: "#7c6f64",
    gray_s: "#928374",
  },
  light: {
    bg: "#fbf1c7",
    gray: "#928374",
    red: "#cc241d",
    red_h: "#fb4934",
    green: "#98971a",
    green_h: "#b8bb26",
    yellow: "#d79921",
    yellow_h: "#fabd2f",
    orange: "#d65d0e",
    orange_h: "#af3a03",
    blue: "#458588",
    blue_h: "#83a598",
    purple: "#b16286",
    purple_h: "#d3869b",
    aqua: "#689d6a",
    aqua_h: "#8ec07c",
    gray_h: "#7c6f64",
    fg: "#3c3836",
    fg0: "#282828",
    fg1: "#3c3836",
    fg2: "#504945",
    fg3: "#665c54",
    fg4: "#7c6f64",
    bg0_h: "#f9f5d7",
    bg0: "#fbf1c7",
    bg0_s: "#f2e5bc",
    bg1: "#ebdbb2",
    bg2: "#d5c4a1",
    bg3: "#bdae93",
    bg4: "#a89984",
    gray_s: "#928374",
  },
} as const;

/**
 * Mantine CSSVariablesResolver — maps Gruvbox tokens into Mantine's
 * internal CSS variable system for both light and dark schemes.
 */
export const gruvboxResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "rgba(251, 241, 199, 0.88)",
    "--mantine-color-text": gruvbox.light.fg1,
    "--mantine-color-dimmed": gruvbox.light.fg4,
    "--mantine-color-default-border": gruvbox.light.bg1,
    "--mantine-color-default": "rgba(251, 241, 199, 0.88)",
    "--mantine-color-default-hover": gruvbox.light.bg0_s,
    "--mantine-color-default-color": gruvbox.light.fg1,
  },
  dark: {
    "--mantine-color-body": "rgba(29, 32, 33, 0.85)",
    "--mantine-color-text": gruvbox.dark.fg1,
    "--mantine-color-dimmed": gruvbox.dark.fg4,
    "--mantine-color-default-border": gruvbox.dark.bg1,
    "--mantine-color-default": "rgba(40, 40, 40, 0.88)",
    "--mantine-color-default-hover": gruvbox.dark.bg0_s,
    "--mantine-color-default-color": gruvbox.dark.fg1,
  },
});

export const dirtTheme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: 'Inter, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"Roboto Mono", "SFMono-Regular", monospace',
  headings: {
    fontFamily: '"IM Fell English", Georgia, serif',
    fontWeight: "400",
  },
  colors: {
    /* Mantine's "dark" shade array — indices 7-9 drive dark-mode body bg.
       We map these so dark[7] = bg0_h (#1d2021), the deepest background. */
    dark: [
      "#fbf1c7",
      "#ebdbb2",
      "#d5c4a1",
      "#bdae93",
      "#928374",
      "#7c6f64",
      "#504945",
      "#1d2021",
      "#1d2021",
      "#1d2021",
    ],
    gray: [
      "#fbf1c7",
      "#ebdbb2",
      "#d5c4a1",
      "#bdae93",
      "#928374",
      "#7c6f64",
      "#665c54",
      "#504945",
      "#3c3836",
      "#282828",
    ],
    red: [
      "#fff0ee",
      "#ffd9d3",
      "#ffb4aa",
      "#fb8676",
      "#fb4934",
      "#e23b2b",
      "#cc241d",
      "#a11c17",
      "#7f1612",
      "#59100d",
    ],
    green: [
      "#f2f6d5",
      "#e3e9b4",
      "#cfd986",
      "#b8bb26",
      "#aaa923",
      "#98971a",
      "#797813",
      "#5d5d0f",
      "#42430b",
      "#2d2e07",
    ],
    yellow: [
      "#fff6d8",
      "#ffebb0",
      "#fddf80",
      "#fabd2f",
      "#ebb129",
      "#d79921",
      "#ae7b1a",
      "#876014",
      "#5f430e",
      "#382808",
    ],
    orange: [
      "#fff0e1",
      "#ffd8b4",
      "#ffbb85",
      "#fe8019",
      "#ee7314",
      "#d65d0e",
      "#af3a03",
      "#8b2f02",
      "#632101",
      "#3f1400",
    ],
    blue: [
      "#ecf5f6",
      "#d0e3e6",
      "#a8c6cf",
      "#83a598",
      "#6897a0",
      "#458588",
      "#366a6d",
      "#285254",
      "#1b3a3c",
      "#102324",
    ],
    purple: [
      "#f7eef2",
      "#ead6e0",
      "#d7aec0",
      "#d3869b",
      "#c5738f",
      "#b16286",
      "#8b4b69",
      "#6b394f",
      "#4b2737",
      "#2f1822",
    ],
    aqua: [
      "#edf7ef",
      "#d0e8d1",
      "#a9d2ac",
      "#8ec07c",
      "#79b07a",
      "#689d6a",
      "#517d53",
      "#3d5f3f",
      "#2a432c",
      "#17281a",
    ],
  },
  other: {
    gruvbox,
  },
  components: {
    Title: {
      defaultProps: {
        style: {
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        },
      },
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "sm",
      },
      styles: () => ({
        root: {
          backgroundColor: "var(--dirtos-bg-alt)",
          borderColor: "var(--mantine-color-default-border)",
        },
      }),
    },
    Paper: {
      styles: () => ({
        root: {
          backgroundColor: "var(--dirtos-bg-alt)",
        },
      }),
    },
    AppShell: {
      styles: () => ({
        main: {
          backgroundColor: "var(--mantine-color-body)",
        },
        header: {
          backgroundColor: "var(--app-shell-panel)",
          borderColor: "var(--app-shell-border)",
        },
        navbar: {
          backgroundColor: "var(--app-shell-panel)",
          borderColor: "var(--app-shell-border)",
        },
      }),
    },
    NavLink: {
      styles: () => ({
        root: {
          borderRadius: 6,
          margin: "1px 4px",
          color: "var(--mantine-color-text)",
          "&[data-active]": {
            backgroundColor: "var(--dirtos-accent)",
          },
        },
      }),
    },
    Modal: {
      styles: () => ({
        content: {
          backgroundColor: "var(--dirtos-bg-alt)",
        },
        header: {
          backgroundColor: "var(--dirtos-bg-alt)",
        },
      }),
    },
    Button: {
      defaultProps: {
        radius: "xl",
        variant: "default",
      },
      styles: () => ({
        root: {
          transition: "transform 120ms ease, box-shadow 120ms ease",
          "&:hover:not([data-disabled])": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.28)",
          },
          "&:active:not([data-disabled])": {
            transform: "translateY(0)",
            boxShadow: "none",
          },
        },
      }),
    },
    Table: {
      styles: () => ({
        table: {
          borderColor: "var(--mantine-color-default-border)",
        },
      }),
    },
  },
});
