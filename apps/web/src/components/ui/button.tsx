// Shared Button (design-language.md, component rules). Always a real <button>, type "button"
// unless a form submit is asked for, with the shared focus ring and 44px touch target from styles.css.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly small?: boolean;
  readonly children: ReactNode;
}

export function Button({ variant = "secondary", small = false, className, type = "button", children, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, small ? "btn-small" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
