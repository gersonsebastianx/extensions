import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { ACCESSIBILITY_SETTINGS_URL, AUTOMATION_SETTINGS_URL } from "./lib/applescript";
import { eject, loadEjectables } from "./lib/items";
import { formatSize } from "./lib/volumes";
import { Ejectable, Preferences, SidebarStatus } from "./lib/types";

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(loadEjectables);
  const preferences = getPreferenceValues<Preferences>();

  const items = data?.items ?? [];
  const devices = items.filter((item) => item.kind === "device");
  const volumes = items.filter((item) => item.kind === "volume");
  const status = data?.status;

  async function handleEject(item: Ejectable) {
    if (!item.inSidebar && item.kind === "device") {
      await showToast({
        style: Toast.Style.Failure,
        title: `Cannot eject ${item.name} yet`,
        message: "Finder's sidebar is unreachable. Grant the missing permission and try again.",
      });
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: `Ejecting ${item.name}…` });
    try {
      await eject(item);
      toast.style = Toast.Style.Success;
      toast.title = `Ejected ${item.name}`;
      if (preferences.closeAfterEject) {
        await closeMainWindow();
      } else {
        revalidate();
      }
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Could not eject ${item.name}`;
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search devices and disks…">
      {status && status.state !== "ok" ? <PermissionItem status={status} onRetry={revalidate} /> : null}

      <List.Section title="Devices" subtitle={devices.length > 0 ? String(devices.length) : undefined}>
        {devices.map((item) => (
          <EjectableItem key={item.id} item={item} onEject={handleEject} onRefresh={revalidate} />
        ))}
      </List.Section>

      <List.Section title="Disks" subtitle={volumes.length > 0 ? String(volumes.length) : undefined}>
        {volumes.map((item) => (
          <EjectableItem key={item.id} item={item} onEject={handleEject} onRefresh={revalidate} />
        ))}
      </List.Section>

      <List.EmptyView
        icon={Icon.Eject}
        title={isLoading ? "Looking for devices…" : "Nothing to eject"}
        description={isLoading ? undefined : "Connect an iPhone, iPad or external disk and refresh with Cmd+R."}
        actions={
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
          </ActionPanel>
        }
      />
    </List>
  );
}

function EjectableItem({
  item,
  onEject,
  onRefresh,
}: {
  item: Ejectable;
  onEject: (item: Ejectable) => void;
  onRefresh: () => void;
}) {
  return (
    <List.Item
      key={item.id}
      icon={iconFor(item)}
      title={item.name}
      subtitle={subtitleFor(item)}
      accessories={accessoriesFor(item)}
      actions={
        <ActionPanel>
          <Action title="Eject" icon={Icon.Eject} onAction={() => onEject(item)} />
          {item.volume ? <Action.ShowInFinder title="Show in Finder" path={item.volume.mountPoint} /> : null}
          <Action.CopyToClipboard title="Copy Name" content={item.name} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={onRefresh}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
        </ActionPanel>
      }
    />
  );
}

function PermissionItem({ status, onRetry }: { status: SidebarStatus; onRetry: () => void }) {
  const isAutomation = status.state === "automation-denied";
  const isPermission = isAutomation || status.state === "accessibility-denied";
  const settingsUrl = isAutomation ? AUTOMATION_SETTINGS_URL : ACCESSIBILITY_SETTINGS_URL;

  const title = isAutomation
    ? "Raycast cannot control Finder yet"
    : isPermission
      ? "Raycast needs Accessibility permission"
      : "Could not read the Finder sidebar";

  const description = isAutomation
    ? "Allow Raycast to control Finder and System Events, then try again."
    : isPermission
      ? "Add Raycast under Privacy & Security → Accessibility, then try again."
      : status.state === "error"
        ? status.message
        : "";

  return (
    <List.Section title="Permission needed">
      <List.Item
        icon={{ source: Icon.Warning, tintColor: Color.Orange }}
        title={title}
        subtitle={description}
        actions={
          <ActionPanel>
            {isPermission ? <Action.Open title="Open System Settings" target={settingsUrl} icon={Icon.Gear} /> : null}
            <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={onRetry} />
          </ActionPanel>
        }
      />
    </List.Section>
  );
}

function iconFor(item: Ejectable) {
  if (item.kind === "device") {
    return item.inSidebar ? Icon.Mobile : { source: Icon.Mobile, tintColor: Color.Orange };
  }
  return item.volume?.busProtocol === "Disk Image" ? Icon.Document : Icon.HardDrive;
}

function subtitleFor(item: Ejectable): string | undefined {
  if (item.kind === "device") {
    return item.inSidebar ? item.usb?.name : "Plugged in, but Finder is unreachable";
  }
  return item.volume?.mountPoint;
}

function accessoriesFor(item: Ejectable): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];

  if (item.kind === "volume" && item.volume) {
    const size = formatSize(item.volume.totalSize);
    if (size) accessories.push({ text: size });
    if (item.volume.busProtocol) accessories.push({ tag: item.volume.busProtocol });
  }

  if (item.kind === "device" && !item.inSidebar) {
    accessories.push({ tag: { value: "Needs permission", color: Color.Orange } });
  }

  return accessories;
}
