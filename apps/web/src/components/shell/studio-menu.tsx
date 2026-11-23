// The Studio menu (studio-experience 4.2): the few actions that have no place of their own.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Keyboard, Menu as MenuIcon, Lamp } from "lucide-react";
import type { Ref } from "react";
import { IconButton } from "../ui/icon-button";

export interface StudioMenuProps {
  readonly onShortcuts: () => void;
  /** Absent until the Opening can be replayed. */
  readonly onOpening?: () => void;
  /** The trigger, so a dialog opened from the menu can return focus to it. */
  readonly triggerRef?: Ref<HTMLButtonElement>;
}

export function StudioMenu({ onShortcuts, onOpening, triggerRef }: StudioMenuProps) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <IconButton ref={triggerRef} small icon={MenuIcon} label="Studio menu" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={6} collisionPadding={8}>
          <Menu.Item className="menu-item" onSelect={onShortcuts}>
            <Keyboard aria-hidden="true" size={16} /> Point paper shortcuts
          </Menu.Item>
          {onOpening === undefined ? null : (
            <Menu.Item className="menu-item" onSelect={onOpening}>
              <Lamp aria-hidden="true" size={16} /> Show the opening again
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
