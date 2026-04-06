import { defineConfig } from "@docmd/core";

export default defineConfig({
  title: "DirtOS Documentation",
  url: "",

  logo: {
    light: "assets/logo-dark.png",
    dark: "assets/logo-light.png",
    alt: "DirtOS",
    href: "/",
  },
  favicon: "assets/icon-light.png",

  src: "docs",
  out: "site",

  layout: {
    spa: true,
    header: { enabled: true },
    sidebar: {
      collapsible: true,
      defaultCollapsed: false,
    },
    optionsMenu: {
      position: "sidebar-top",
      components: {
        search: true,
        themeSwitch: true,
        sponsor: null,
      },
    },
    footer: {
      style: "minimal",
      content: "© " + new Date().getFullYear() + " DirtOS",
      branding: true,
    },
  },

  theme: {
    name: "default",
    appearance: "system",
    codeHighlight: true,
    customCss: ["assets/css/dirtos-docs.css"],
  },

  minify: true,
  autoTitleFromH1: true,
  copyCode: true,
  pageNavigation: true,

  customJs: [],

  navigation: [
    { title: "Overview", path: "/", icon: "home" },
    {
      title: "Getting Started",
      icon: "rocket",
      children: [
        { title: "Installation", path: "getting-started/installation", icon: "download" },
        { title: "First Run", path: "getting-started/first-run", icon: "play" },
        { title: "Example Garden", path: "getting-started/example-garden", icon: "leaf" },
      ],
    },
    {
      title: "Guides",
      icon: "book-open",
      children: [
        { title: "Core Workflow", path: "guides/core-workflow", icon: "workflow" },
        { title: "Common Tasks", path: "guides/common-tasks", icon: "check-square" },
        { title: "Import, Export, Backup", path: "guides/import-export-backup", icon: "database-backup" },
        { title: "Integrations", path: "guides/integrations", icon: "plug" },
      ],
    },
    {
      title: "Reference",
      icon: "file-text",
      children: [
        { title: "Feature Matrix", path: "reference/feature-matrix", icon: "layout-grid" },
        { title: "Environments & Locations", path: "reference/environments-locations", icon: "map" },
        { title: "Plants & Species", path: "reference/plants-species", icon: "sprout" },
        { title: "Seedlings & Trays", path: "reference/seedlings-trays", icon: "grid-3x3" },
        { title: "Indoor Environments", path: "reference/indoor-environments", icon: "warehouse" },
        { title: "Schedules", path: "reference/schedules", icon: "calendar-clock" },
        { title: "Sensors", path: "reference/sensors", icon: "activity" },
        { title: "Issues", path: "reference/issues", icon: "alert-triangle" },
        { title: "Journal", path: "reference/journal", icon: "notebook" },
        { title: "Weather", path: "reference/weather", icon: "cloud-sun" },
        { title: "Reports", path: "reference/reports", icon: "bar-chart-3" },
        { title: "Integrations & API Keys", path: "reference/integrations-and-keys", icon: "key-round" },
        { title: "Architecture", path: "reference/architecture", icon: "blocks" },
        { title: "Glossary", path: "reference/glossary", icon: "list" },
      ],
    },
    {
      title: "Project",
      icon: "code",
      children: [
        { title: "Developer Guide", path: "../DEVELOPER.md", icon: "terminal-square" },
        { title: "Contributing", path: "../CONTRIBUTING.md", icon: "git-pull-request" },
      ],
    },
  ],

  plugins: {
    seo: {
      defaultDescription: "DirtOS user and feature documentation.",
      openGraph: { defaultImage: "" },
      twitter: { cardType: "summary_large_image" },
    },
    sitemap: { defaultChangefreq: "weekly" },
    search: {},
    mermaid: {},
    llms: {},
  },

  editLink: {
    enabled: false,
    baseUrl: "",
    text: "Edit this page",
  },
});
