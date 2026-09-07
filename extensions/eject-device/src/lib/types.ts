export type EjectableKind = "device" | "volume";

export interface Ejectable {
  /** Stable key for React lists. */
  id: string;
  /** Exactly the label Finder shows, which is what the eject script matches on. */
  name: string;
  kind: EjectableKind;
  /** Set when the item is a mounted volume we can eject with diskutil. */
  volume?: VolumeInfo;
  /** Set when we matched the item to a device on the USB bus. */
  usb?: UsbDevice;
  /** False when Finder's sidebar is unreachable and we only know about it from USB. */
  inSidebar: boolean;
}

export interface VolumeInfo {
  name: string;
  mountPoint: string;
  deviceNode?: string;
  busProtocol?: string;
  totalSize?: number;
  internal: boolean;
  removable: boolean;
}

export interface UsbDevice {
  name: string;
  serial?: string;
  manufacturer?: string;
}

/**
 * macOS gates this extension behind two separate permissions, and they fail
 * differently, so we keep them apart to be able to point at the right pane.
 */
export type SidebarStatus =
  | { state: "ok" }
  /** Raycast may not send Apple events to Finder / System Events (error -1743). */
  | { state: "automation-denied"; message: string }
  /** Raycast is not in the Accessibility list, so UI scripting fails (error -25211). */
  | { state: "accessibility-denied"; message: string }
  | { state: "error"; message: string };

export interface Preferences {
  ignoredItems?: string;
  closeAfterEject: boolean;
}
