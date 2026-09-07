import { classifyScriptError, runScript } from "./applescript";
import { SidebarStatus } from "./types";

export interface SidebarRow {
  name: string;
  /**
   * The row carries a button with a title, which is how Finder marks an eject
   * arrow. Rows can hold untitled buttons that eject nothing -- an iCloud
   * folder has a sync button -- so the title, not the button, is the signal.
   */
  ejectable: boolean;
}

export interface SidebarResult {
  rows: SidebarRow[];
  status: SidebarStatus;
}

/**
 * Reads the Finder sidebar. Rows carrying an eject button are the ejectable
 * ones -- disks, disk images, network shares and, the reason this extension
 * exists, iPhones and iPads, which never mount as volumes and so are invisible
 * to diskutil.
 */
export async function readSidebar(): Promise<SidebarResult> {
  try {
    const stdout = await runScript("list-sidebar-items.applescript");
    return { rows: parseRows(stdout), status: { state: "ok" } };
  } catch (error) {
    return { rows: [], status: classifyScriptError(error) };
  }
}

/** Clicks the eject arrow of a sidebar row, by name. */
export async function ejectSidebarItem(name: string): Promise<void> {
  await runScript("eject-sidebar-item.applescript", [name], 60_000);
}

/** Reports each sidebar row's buttons, to tell an eject button from a sync one. */
export async function probeSidebarButtons(): Promise<{ probe: string; status: SidebarStatus }> {
  try {
    const probe = await runScript("probe-sidebar-buttons.applescript", [], 60_000);
    return { probe, status: { state: "ok" } };
  } catch (error) {
    return { probe: "", status: classifyScriptError(error) };
  }
}

/** Dumps the accessibility tree of the front Finder window for troubleshooting. */
export async function dumpSidebarTree(): Promise<{ dump: string; status: SidebarStatus }> {
  try {
    const dump = await runScript("dump-sidebar.applescript", [], 60_000);
    return { dump, status: { state: "ok" } };
  } catch (error) {
    return { dump: "", status: classifyScriptError(error) };
  }
}

function parseRows(stdout: string): SidebarRow[] {
  return stdout
    .split("\n")
    .map((line) => line.split("\t"))
    .filter((parts) => parts.length >= 2 && parts[0].trim().length > 0)
    .map((parts) => ({ name: parts[0].trim(), ejectable: parts[1].trim() === "1" }));
}
