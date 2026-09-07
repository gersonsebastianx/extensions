import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import plist from "plist";

import { VolumeInfo } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Everything mounted under /Volumes that diskutil reports as ejectable. That
 * filter is what keeps the boot volume off the list without hard-coding names.
 */
export async function listEjectableVolumes(): Promise<VolumeInfo[]> {
  let entries: string[];
  try {
    entries = await readdir("/Volumes");
  } catch {
    return [];
  }

  const infos = await Promise.all(entries.map((entry) => readVolumeInfo(`/Volumes/${entry}`)));
  return infos.filter((info): info is VolumeInfo => info !== null);
}

async function readVolumeInfo(mountPoint: string): Promise<VolumeInfo | null> {
  let parsed: Record<string, unknown>;
  try {
    const { stdout } = await execFileAsync("/usr/sbin/diskutil", ["info", "-plist", mountPoint], { timeout: 10_000 });
    parsed = plist.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.Ejectable !== true) {
    return null;
  }

  return {
    name: asString(parsed.VolumeName) ?? mountPoint.replace("/Volumes/", ""),
    mountPoint: asString(parsed.MountPoint) ?? mountPoint,
    deviceNode: asString(parsed.DeviceNode),
    busProtocol: asString(parsed.BusProtocol),
    totalSize: typeof parsed.TotalSize === "number" ? parsed.TotalSize : undefined,
    internal: parsed.Internal === true,
    removable: parsed.RemovableMedia === true,
  };
}

/** Unmounts a volume. The device node is preferred: it survives odd names. */
export async function ejectVolume(volume: VolumeInfo): Promise<void> {
  const target = volume.deviceNode ?? volume.mountPoint;
  await execFileAsync("/usr/sbin/diskutil", ["eject", target], { timeout: 60_000 });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function formatSize(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}
