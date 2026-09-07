import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { environment } from "@raycast/api";

import { SidebarStatus } from "./types";

const execFileAsync = promisify(execFile);

/** Scripts live in assets/ so they can be read and tweaked without a rebuild. */
export function scriptPath(name: string): string {
  return path.join(environment.assetsPath, name);
}

/**
 * Runs one of the bundled scripts. Arguments are passed as argv rather than
 * interpolated into the source, so a volume named `"; rm -rf ~` stays a name.
 */
export async function runScript(name: string, args: string[] = [], timeout = 20_000): Promise<string> {
  const { stdout } = await execFileAsync("/usr/bin/osascript", [scriptPath(name), ...args], { timeout });
  return stdout.trim();
}

/**
 * Maps an osascript failure onto the permission the user actually has to grant.
 * -1743 is Automation (Apple events), -25211 is Accessibility (UI scripting);
 * they live in different panes of System Settings, so telling them apart is the
 * difference between a two-click fix and a confusing dead end.
 */
export function classifyScriptError(error: unknown): SidebarStatus {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("-1743") || message.includes("Not authorized to send Apple events")) {
    return { state: "automation-denied", message };
  }
  if (message.includes("-25211") || message.includes("not allowed assistive access")) {
    return { state: "accessibility-denied", message };
  }
  return { state: "error", message };
}

export const ACCESSIBILITY_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
export const AUTOMATION_SETTINGS_URL = "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation";
