import { useState } from "react";
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
import { EjectableList, eject, loadEjectables } from "./lib/items";
import { formatSize } from "./lib/volumes";
import { Ejectable, Preferences, SidebarStatus } from "./lib/types";

export default function Command() {
  const [showingDetail, setShowingDetail] = useState(false);
  const { data, isLoading, revalidate, mutate } = usePromise(loadEjectables);
  const preferences = getPreferenceValues<Preferences>();

  const items = data?.items ?? [];
  const devices = items.filter((item) => item.kind === "device");
  const disks = items.filter((item) => item.kind === "volume" && !item.volume?.network);
  const shares = items.filter((item) => item.kind === "volume" && item.volume?.network);
  const status = data?.status;
  const blocked = status && status.state !== "ok";

  async function handleEject(item: Ejectable) {
    if (item.kind === "device" && !item.inSidebar) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Cannot eject ${item.name} yet`,
        message: "Finder's sidebar is unreachable. Grant the missing permission and try again.",
      });
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: `Ejecting ${item.name}…` });
    try {
      // Drop the row as soon as the eject starts. Waiting for a reload before
      // the list reflects the action makes a successful eject feel broken.
      await mutate(eject(item), {
        optimisticUpdate: (current: EjectableList | undefined): EjectableList => ({
          status: current?.status ?? { state: "ok" },
          connectedIosDevices: current?.connectedIosDevices ?? 0,
          items: (current?.items ?? []).filter((other) => other.id !== item.id),
        }),
        rollbackOnError: true,
      });
      toast.style = Toast.Style.Success;
      toast.title = `Ejected ${item.name}`;
      if (preferences.closeAfterEject) await closeMainWindow();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Could not eject ${item.name}`;
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  const toggleDetail = () => setShowingDetail((current) => !current);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showingDetail && items.length > 0}
      searchBarPlaceholder="Search devices and disks…"
    >
      {blocked ? <PermissionItem status={status} onRetry={revalidate} /> : null}

      <Section
        title="Devices"
        items={devices}
        showingDetail={showingDetail}
        onEject={handleEject}
        onToggleDetail={toggleDetail}
        onRefresh={revalidate}
      />
      <Section
        title="Disks"
        items={disks}
        showingDetail={showingDetail}
        onEject={handleEject}
        onToggleDetail={toggleDetail}
        onRefresh={revalidate}
      />
      <Section
        title="Network"
        items={shares}
        showingDetail={showingDetail}
        onEject={handleEject}
        onToggleDetail={toggleDetail}
        onRefresh={revalidate}
      />

      <List.EmptyView
        icon={Icon.Eject}
        title={isLoading ? "Looking for devices…" : "Nothing to eject"}
        description={
          isLoading
            ? undefined
            : "Connect an iPhone, iPad or a disk, then refresh. Mounted disk images show up here too."
        }
        actions={
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
          </ActionPanel>
        }
      />
    </List>
  );
}

function Section({
  title,
  items,
  showingDetail,
  onEject,
  onToggleDetail,
  onRefresh,
}: {
  title: string;
  items: Ejectable[];
  showingDetail: boolean;
  onEject: (item: Ejectable) => void;
  onToggleDetail: () => void;
  onRefresh: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <List.Section title={title} subtitle={String(items.length)}>
      {items.map((item) => (
        <List.Item
          key={item.id}
          icon={iconFor(item)}
          title={item.name}
          subtitle={showingDetail ? undefined : subtitleFor(item)}
          accessories={showingDetail ? undefined : accessoriesFor(item)}
          detail={showingDetail ? <ItemDetail item={item} /> : undefined}
          actions={
            <ActionPanel>
              <Action title="Eject" icon={Icon.Eject} onAction={() => onEject(item)} />
              {item.volume ? (
                <Action.ShowInFinder
                  title="Show in Finder"
                  path={item.volume.mountPoint}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                />
              ) : null}
              <Action
                title={showingDetail ? "Hide Details" : "Show Details"}
                icon={Icon.Sidebar}
                onAction={onToggleDetail}
                shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={onRefresh}
                shortcut={Keyboard.Shortcut.Common.Refresh}
              />
              <Action.CopyToClipboard
                title="Copy Name"
                content={item.name}
                shortcut={Keyboard.Shortcut.Common.CopyName}
              />
              {item.volume ? (
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={item.volume.mountPoint}
                  shortcut={Keyboard.Shortcut.Common.CopyPath}
                />
              ) : null}
            </ActionPanel>
          }
        />
      ))}
    </List.Section>
  );
}

function ItemDetail({ item }: { item: Ejectable }) {
  const { volume, usb } = item;

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Name" text={item.name} />
          <List.Item.Detail.Metadata.Label title="Kind" text={kindLabel(item)} />

          {volume ? (
            <>
              <List.Item.Detail.Metadata.Separator />
              {volume.totalSize !== undefined ? (
                <List.Item.Detail.Metadata.Label title="Capacity" text={formatSize(volume.totalSize)} />
              ) : null}
              {volume.freeSpace !== undefined ? (
                <List.Item.Detail.Metadata.Label title="Available" text={formatSize(volume.freeSpace)} />
              ) : null}
              {volume.filesystem ? <List.Item.Detail.Metadata.Label title="Format" text={volume.filesystem} /> : null}
              {volume.busProtocol ? (
                <List.Item.Detail.Metadata.Label title="Connection" text={volume.busProtocol} />
              ) : null}
              {volume.mediaName ? <List.Item.Detail.Metadata.Label title="Media" text={volume.mediaName} /> : null}
              <List.Item.Detail.Metadata.Label title="Mounted at" text={volume.mountPoint} />
            </>
          ) : null}

          {item.kind === "device" ? (
            <>
              <List.Item.Detail.Metadata.Separator />
              {usb?.name ? <List.Item.Detail.Metadata.Label title="Model" text={usb.name} /> : null}
              {usb?.serial ? <List.Item.Detail.Metadata.Label title="Serial" text={usb.serial} /> : null}
              <List.Item.Detail.Metadata.Label
                title="Connection"
                text={usb ? "USB" : "Finder sidebar (no USB match)"}
              />
              <List.Item.Detail.Metadata.Label
                title="Note"
                text="Unlike a disk, a device can be unplugged without ejecting. This just ends Finder's session with it."
              />
            </>
          ) : null}
        </List.Item.Detail.Metadata>
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

  const subtitle = isAutomation
    ? "Allow Raycast to control Finder and System Events"
    : isPermission
      ? "Add Raycast under Privacy & Security → Accessibility"
      : status.state === "error"
        ? status.message
        : "";

  return (
    <List.Section title="Permission needed">
      <List.Item
        icon={{ source: Icon.Warning, tintColor: Color.Orange }}
        title={title}
        subtitle={subtitle}
        accessories={[{ tag: { value: "Disks still work", color: Color.SecondaryText } }]}
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
    const source = /ipad/i.test(item.usb?.name ?? item.name) ? Icon.Devices : Icon.Mobile;
    return item.inSidebar ? source : { source, tintColor: Color.Orange };
  }

  const volume = item.volume;
  if (volume?.network) return Icon.Network;
  if (volume?.busProtocol === "Disk Image") return Icon.Document;
  if (volume?.busProtocol === "Secure Digital") return Icon.MemoryChip;
  if (volume?.busProtocol === "USB" && volume.removable) return Icon.MemoryStick;
  return Icon.HardDrive;
}

function kindLabel(item: Ejectable): string {
  if (item.kind === "device") return "Device";
  const volume = item.volume;
  if (volume?.network) return `Network share (${volume.busProtocol ?? "network"})`;
  if (volume?.busProtocol === "Disk Image") return "Disk image";
  if (volume?.removable) return "Removable media";
  return "External disk";
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
    if (size) accessories.push({ text: size, tooltip: "Capacity" });
    if (item.volume.busProtocol) accessories.push({ tag: item.volume.busProtocol });
  }

  if (item.kind === "device" && !item.inSidebar) {
    accessories.push({ tag: { value: "Needs permission", color: Color.Orange } });
  }

  return accessories;
}
