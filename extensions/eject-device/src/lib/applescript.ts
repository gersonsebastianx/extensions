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

/** Apple event denied: Raycast may not talk to Finder or System Events at all. */
const AUTOMATION_ERROR_CODES = ["-1743"];

/**
 * Assistive access denied. macOS reports this as -1719 or -25211 depending on
 * the release, and both turn up in the wild.
 */
const ACCESSIBILITY_ERROR_CODES = ["-1719", "-25211"];

/**
 * Maps an osascript failure onto the permission the user actually has to grant.
 * Automation and Accessibility live in different panes of System Settings, so
 * telling them apart is the difference between a two-click fix and a dead end.
 *
 * Matching is on the numeric code rather than the message: macOS localises the
 * text, so an English substring silently fails to classify anything on a Mac
 * that is not running in English -- which is precisely the case where a user
 * most needs to be pointed at the right pane.
 */
export function classifyScriptError(error: unknown): SidebarStatus {
  const message = error instanceof Error ? error.message : String(error);

  if (AUTOMATION_ERROR_CODES.some((code) => message.includes(code))) {
    return { state: "automation-denied", message };
  }
  if (ACCESSIBILITY_ERROR_CODES.some((code) => message.includes(code))) {
    return { state: "accessibility-denied", message };
  }
  return { state: "error", message };
}

export const ACCESSIBILITY_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
export const AUTOMATION_SETTINGS_URL = "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation";
