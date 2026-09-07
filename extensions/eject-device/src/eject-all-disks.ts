import { Toast, showToast } from "@raycast/api";

import { listEjectableVolumes, ejectVolume } from "./lib/volumes";

/**
 * Unmounts every ejectable volume. Deliberately limited to disks: an iPhone is
 * ejected through Finder's UI, which is slow and focus-stealing, and nobody
 * wants that fired off in bulk from a no-view command.
 */
export default async function Command() {
  const volumes = await listEjectableVolumes();

  if (volumes.length === 0) {
    await showToast({ style: Toast.Style.Success, title: "No disks to eject" });
    return;
  }

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Ejecting ${volumes.length} ${volumes.length === 1 ? "disk" : "disks"}…`,
  });

  const failed: string[] = [];
  for (const volume of volumes) {
    try {
      await ejectVolume(volume);
    } catch {
      failed.push(volume.name);
    }
  }

  const ejected = volumes.length - failed.length;
  if (failed.length === 0) {
    toast.style = Toast.Style.Success;
    toast.title = `Ejected ${ejected} ${ejected === 1 ? "disk" : "disks"}`;
    return;
  }

  toast.style = Toast.Style.Failure;
  toast.title = ejected > 0 ? `Ejected ${ejected}, ${failed.length} failed` : "Could not eject";
  toast.message = `Still mounted: ${failed.join(", ")}. A disk in use cannot be ejected.`;
}
