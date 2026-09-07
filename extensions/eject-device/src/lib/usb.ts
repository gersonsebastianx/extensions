import { execFile } from "child_process";
import { promisify } from "util";

import { UsbDevice } from "./types";

const execFileAsync = promisify(execFile);

const IOS_DEVICE_PATTERN = /\b(iphone|ipad|ipod)\b/i;

interface ProfilerNode {
  _name?: string;
  _items?: ProfilerNode[];
  serial_num?: string;
  manufacturer?: string;
}

/**
 * iOS devices on the USB bus. Finder is the source of truth for what can be
 * ejected, but this survives a missing Accessibility permission, so it is how
 * we can still say "your iPhone is plugged in" when UI scripting is blocked.
 */
export async function listConnectedIosDevices(): Promise<UsbDevice[]> {
  let tree: { SPUSBDataType?: ProfilerNode[] };
  try {
    const { stdout } = await execFileAsync("/usr/sbin/system_profiler", ["SPUSBDataType", "-json"], {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    tree = JSON.parse(stdout);
  } catch {
    return [];
  }

  const found: UsbDevice[] = [];
  collect(tree.SPUSBDataType ?? [], found);
  return found;
}

function collect(nodes: ProfilerNode[], found: UsbDevice[]): void {
  for (const node of nodes) {
    const name = node._name;
    if (name && IOS_DEVICE_PATTERN.test(name)) {
      found.push({ name, serial: node.serial_num, manufacturer: node.manufacturer });
    }
    if (node._items?.length) {
      collect(node._items, found);
    }
  }
}
