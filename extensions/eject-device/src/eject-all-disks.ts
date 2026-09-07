import { Alert, Icon, Toast, confirmAlert, showToast } from "@raycast/api";

import { listAllEjectableVolumes, ejectVolume } from "./lib/volumes";

/**
 * Unmounts every ejectable volume: external media, mounted disk images and
 * network shares. Deliberately excludes devices -- an iPhone is ejected through
 * Finder's UI, which is slow and pulls Finder forward, and nobody wants that
 * fired off in bulk from a no-view command.
 */
export default async function Command() {
  const volumes = await listAllEjectableVolumes();

  if (volumes.length === 0) {
    await showToast({ style: Toast.Style.Success, title: "No disks to eject" });
    return;
  }

  // A bulk action gets an explicit list of what it is about to touch. Reading
  // the names beats trusting a count.
  const confirmed = await confirmAlert({
    title: `Eject ${volumes.length} ${volumes.length === 1 ? "disk" : "disks"}?`,
    message: volumes.map((volume) => volume.name).join(", "),
    icon: Icon.Eject,
    primaryAction: { title: "Eject All", style: Alert.ActionStyle.Destructive },
  });
  if (!confirmed) return;

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
