import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopy } from "../../lib/useCopy";
import { Button, IconButton } from "./Button";
import { Swap } from "./Swap";
import type { Sx } from "./sx";

interface CopyButtonProps {
  /** What goes on the clipboard: the whole value, even where its display is cut short. */
  text: string;
  /** Names what is copied: "Copy link". */
  label?: string;
  /** Just the icon, with the label as its tooltip. */
  compact?: boolean;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
  xstyle?: Sx;
}

/** Copies a value. The icon turns into a tick for a moment, and the label says what happened. */
export function CopyButton({ text, label = "Copy", compact, size = "md", variant = "secondary", xstyle }: CopyButtonProps) {
  const { copied, failed, copy } = useCopy(text);
  const px = size === "sm" ? 14 : 15;
  const icon = (
    <Swap id={copied ? "check" : "copy"}>
      {copied ? <CheckIcon size={px} weight="bold" /> : <CopyIcon size={px} />}
    </Swap>
  );
  if (compact)
    return (
      <IconButton
        label={failed ? "Copy failed. Select and copy the text." : copied ? "Copied" : label}
        size={size}
        onClick={copy}
        xstyle={xstyle}
      >
        {icon}
      </IconButton>
    );
  return (
    <Button variant={variant} size={size} icon={icon} onClick={copy} xstyle={xstyle}>
      {failed ? "Copy failed" : copied ? "Copied" : label}
    </Button>
  );
}
