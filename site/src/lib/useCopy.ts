import { useCallback, useEffect, useState } from "react";

/**
 * Copies text to the clipboard and says how it went: `copied` is true for a moment afterwards,
 * long enough to show a tick, and `failed` is true for as long when the browser refused.
 */
export function useCopy(text: string, { resetAfter = 1600 }: { resetAfter?: number } = {}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  // Either answer is shown for a moment, then the button is itself again.
  useEffect(() => {
    if (!copied && !failed) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, resetAfter);
    return () => window.clearTimeout(timer);
  }, [copied, failed, resetAfter]);
  const copy = useCallback(async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }, [text]);
  return { copied, failed, copy };
}
