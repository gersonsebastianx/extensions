import { getPreferenceValues } from "@raycast/api";

import { readSidebar, ejectSidebarItem, SidebarRow } from "./sidebar";
import { listAllEjectableVolumes, ejectVolume } from "./volumes";
import { listConnectedIosDevices } from "./usb";
import { Ejectable, Preferences, SidebarStatus, UsbDevice } from "./types";

export interface EjectableList {
  items: Ejectable[];
  status: SidebarStatus;
  /** iOS devices seen on the USB bus, whether or not Finder could be read. */
  connectedIosDevices: number;
}

/**
 * Builds one list out of two sources that each see half the picture: diskutil
 * knows mounted volumes but not iPhones, Finder's sidebar knows both but needs
 * Accessibility. Anything in the sidebar that is not a mounted volume is
 * treated as a device and ejected through Finder.
 */
export async function loadEjectables(): Promise<EjectableList> {
  const [sidebar, volumes, iosDevices] = await Promise.all([
    readSidebar(),
    listAllEjectableVolumes(),
    listConnectedIosDevices(),
  ]);

  const volumesByName = new Map(volumes.map((volume) => [volume.name, volume]));
  const items: Ejectable[] = [];

  for (const row of sidebar.rows) {
    if (!isEjectableRow(row, iosDevices)) continue;

    const volume = volumesByName.get(row.name);
    if (volume) {
      items.push({ id: `volume:${volume.mountPoint}`, name: row.name, kind: "volume", volume, inSidebar: true });
      volumesByName.delete(row.name);
    } else {
      items.push({
        id: `device:${row.name}`,
        name: row.name,
        kind: "device",
        usb: matchUsbDevice(row.name, iosDevices),
        inSidebar: true,
      });
    }
  }

  // Volumes Finder did not list -- either the sidebar was unreadable, or the
  // volume is hidden from it. diskutil can still eject them.
  for (const volume of volumesByName.values()) {
    items.push({ id: `volume:${volume.mountPoint}`, name: volume.name, kind: "volume", volume, inSidebar: false });
  }

  // Without the sidebar we cannot eject an iPhone, but we can still show that
  // it is plugged in and offer the permission fix instead of an empty list.
  if (sidebar.status.state !== "ok") {
    for (const device of iosDevices) {
      items.push({
        id: `usb:${device.serial ?? device.name}`,
        name: device.name,
        kind: "device",
        usb: device,
        inSidebar: false,
      });
    }
  }

  return { items: applyIgnoreList(items), status: sidebar.status, connectedIosDevices: iosDevices.length };
}

export async function eject(item: Ejectable): Promise<void> {
  if (item.kind === "volume" && item.volume) {
    await ejectVolume(item.volume);
    return;
  }
  await ejectSidebarItem(item.name);
}

/**
 * A row qualifies when it carries a titled button, which is how Finder marks
 * something as ejectable. A row whose name carries the model of a device on the
 * USB bus counts too, as a safety net for a macOS release that stops exposing
 * those titles -- disks would survive that through diskutil, devices would not.
 */
function isEjectableRow(row: SidebarRow, iosDevices: UsbDevice[]): boolean {
  if (row.ejectable) return true;
  return iosDevices.some((device) => row.name.toLowerCase().includes(device.name.toLowerCase()));
}

/**
 * Finder shows the name the owner gave the device ("Gerson's iPhone") while the
 * USB bus reports the model ("iPhone"), so an exact match is the exception. A
 * single connected device is the common case and is matched outright.
 */
function matchUsbDevice(sidebarName: string, devices: { name: string; serial?: string }[]) {
  if (devices.length === 0) return undefined;
  if (devices.length === 1) return devices[0];
  return devices.find((device) => sidebarName.toLowerCase().includes(device.name.toLowerCase()));
}

function applyIgnoreList(items: Ejectable[]): Ejectable[] {
  const { ignoredItems } = getPreferenceValues<Preferences>();
  const ignored = (ignoredItems ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (ignored.length === 0) return items;
  return items.filter((item) => !ignored.includes(item.name.toLowerCase()));
}
