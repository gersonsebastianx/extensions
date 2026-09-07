import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { ACCESSIBILITY_SETTINGS_URL, AUTOMATION_SETTINGS_URL } from "./lib/applescript";
import { dumpSidebarTree, readSidebar } from "./lib/sidebar";
import { listConnectedIosDevices } from "./lib/usb";
import { listEjectableVolumes } from "./lib/volumes";

/**
 * Finder's sidebar is read through the accessibility tree, whose shape has
 * moved between macOS releases. When detection misses a device, this command
 * shows exactly what each source reported, which turns "it does not work" into
 * a fixable bug report.
 */
export default function Command() {
  const { data, isLoading, revalidate } = usePromise(async () => {
    const [sidebar, tree, volumes, devices] = await Promise.all([
      readSidebar(),
      dumpSidebarTree(),
      listEjectableVolumes(),
      listConnectedIosDevices(),
    ]);
    return { sidebar, tree, volumes, devices };
  });

  return (
    <Detail
      isLoading={isLoading}
      markdown={data ? renderReport(data) : "Reading the Finder sidebar…"}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Report" content={data ? renderReport(data) : ""} />
          <Action title="Run Again" icon={Icon.ArrowClockwise} onAction={revalidate} />
          <Action.Open title="Open Accessibility Settings" target={ACCESSIBILITY_SETTINGS_URL} icon={Icon.Gear} />
          <Action.Open title="Open Automation Settings" target={AUTOMATION_SETTINGS_URL} icon={Icon.Gear} />
        </ActionPanel>
      }
    />
  );
}

interface Report {
  sidebar: Awaited<ReturnType<typeof readSidebar>>;
  tree: Awaited<ReturnType<typeof dumpSidebarTree>>;
  volumes: Awaited<ReturnType<typeof listEjectableVolumes>>;
  devices: Awaited<ReturnType<typeof listConnectedIosDevices>>;
}

function renderReport(data: Report): string {
  const { sidebar, tree, volumes, devices } = data;

  const lines = [
    "# Finder Sidebar Diagnostics",
    "",
    `**Sidebar status:** \`${sidebar.status.state}\``,
    sidebar.status.state !== "ok" ? `\n> ${sidebar.status.message}\n` : "",
    "",
    "## Sidebar rows",
    "",
    sidebar.rows.length === 0
      ? "_No rows read. The sidebar could not be reached._"
      : sidebar.rows.map((row) => `- ${row.ejectable ? "⏏︎" : "  "} \`${row.name}\``).join("\n"),
    "",
    "## Ejectable volumes (diskutil)",
    "",
    volumes.length === 0
      ? "_None mounted._"
      : volumes.map((v) => `- \`${v.name}\` — ${v.mountPoint} (${v.busProtocol ?? "unknown bus"})`).join("\n"),
    "",
    "## iOS devices on the USB bus",
    "",
    devices.length === 0
      ? "_None detected. A device synced over Wi-Fi will not appear here, but should still show in the sidebar._"
      : devices.map((d) => `- \`${d.name}\`${d.serial ? ` — serial ${d.serial}` : ""}`).join("\n"),
    "",
    "## Accessibility tree of the front Finder window",
    "",
    tree.status.state === "ok" ? "```\n" + tree.dump + "\n```" : `_Unavailable: ${tree.status.message}_`,
  ];

  return lines.join("\n");
}
