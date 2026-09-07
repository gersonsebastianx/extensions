import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import plist from "plist";

import { VolumeInfo } from "./types";

const execFileAsync = promisify(execFile);

/** Filesystems that live on another machine rather than on a bus. */
const NETWORK_FILESYSTEMS = new Set(["smbfs", "afpfs", "nfs", "webdav", "ftp", "ftpfs"]);

/**
 * Everything ejectable, from both sources that matter: local media through
 * diskutil -- USB sticks, SD cards, external SSDs and mounted disk images
 * alike, since a .dmg reports as Ejectable with a "Disk Image" bus -- and
 * network shares through mount, which diskutil does not describe at all.
 */
export async function listAllEjectableVolumes(): Promise<VolumeInfo[]> {
  const [local, network] = await Promise.all([listEjectableVolumes(), listNetworkMounts()]);

  // A share under /Volumes can surface in both passes; the local one wins
  // because it carries the richer diskutil metadata.
  const byMountPoint = new Map<string, VolumeInfo>();
  for (const volume of [...network, ...local]) {
    byMountPoint.set(volume.mountPoint, volume);
  }
  return [...byMountPoint.values()];
}

/**
 * Mounted network shares, read from `mount`. diskutil cannot describe them, so
 * without this pass a mounted server disappears from the list whenever Finder's
 * sidebar is unreadable.
 */
export async function listNetworkMounts(): Promise<VolumeInfo[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("/sbin/mount", [], { timeout: 10_000 }));
  } catch {
    return [];
  }

  const mounts: VolumeInfo[] = [];
  for (const line of stdout.split("\n")) {
    // "//user@host/share on /Volumes/share (smbfs, nodev, nosuid, mounted by x)"
    const match = line.match(/^(.+?) on (.+?) \(([^,)]+)/);
    if (!match) continue;

    const [, source, mountPoint, fsType] = match;
    if (!NETWORK_FILESYSTEMS.has(fsType.trim())) continue;

    mounts.push({
      name: mountPoint.split("/").pop() || mountPoint,
      mountPoint,
      busProtocol: fsType.trim().replace(/fs$/, "").toUpperCase(),
      filesystem: fsType.trim(),
      mediaName: source,
      internal: false,
      removable: false,
      network: true,
      deviceNode: source,
    });
  }
  return mounts;
}

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
    freeSpace: typeof parsed.FreeSpace === "number" ? parsed.FreeSpace : undefined,
    filesystem: asString(parsed.FilesystemName),
    mediaName: asString(parsed.MediaName),
    internal: parsed.Internal === true,
    removable: parsed.RemovableMedia === true,
    network: false,
  };
}

/**
 * Detaches a volume. A network share has no media to eject, so it is unmounted;
 * local media is ejected by device node, which survives an odd volume name.
 */
export async function ejectVolume(volume: VolumeInfo): Promise<void> {
  if (volume.network) {
    await execFileAsync("/usr/sbin/diskutil", ["unmount", volume.mountPoint], { timeout: 60_000 });
    return;
  }
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
