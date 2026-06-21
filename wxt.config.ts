import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "New Relic SLO → APM Transaction",
    description:
      "Jump from a New Relic SLO summary page to the APM transaction detail it monitors, with one keyboard shortcut.",
    permissions: ["activeTab", "storage", "tabs", "scripting"],
    host_permissions: ["https://one.newrelic.com/*", "https://api.newrelic.com/*"],
    commands: {
      "jump-to-apm": {
        suggested_key: {
          default: "Alt+Shift+L",
          mac: "MacCtrl+Shift+L",
        },
        description: "Jump from SLO summary to APM transaction detail",
      },
    },
  },
});
