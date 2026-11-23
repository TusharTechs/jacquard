// An icon-only button (studio-experience 4.4): a lucide icon, an accessible name and a Radix
// tooltip with the same text.
import * as Tooltip from "@radix-ui/react-tooltip";
import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import { Button } from "./button";
import type { ButtonProps } from "./button";

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  readonly icon: LucideIcon;
  /** The accessible name and the tooltip text. */
  readonly label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, className, ...rest },
  ref,
) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button ref={ref} aria-label={label} className={["btn-icon", className ?? ""].filter(Boolean).join(" ")} {...rest}>
            <Icon aria-hidden="true" size={18} strokeWidth={2} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tip" side="bottom" sideOffset={6} collisionPadding={8}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});
