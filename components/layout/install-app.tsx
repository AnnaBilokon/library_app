"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Chrome/Edge/Samsung hand us this event when the app can be installed with one click. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const subscribeStandalone = (cb: () => void) => {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Put P·unkt on your phone's home screen: a one-tap Install button where the browser offers it,
 * and the steps for iPhone (Safari: Share → Add to Home Screen) and Android otherwise.
 */
export function InstallApp() {
  const installed = useSyncExternalStore(subscribeStandalone, standalone, () => false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || done) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <Check className="size-4 text-chart-actual" aria-hidden />
        P·unkt is installed on this device. Open it from your home screen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {prompt && (
        <Button
          className="w-fit rounded-full px-5"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setDone(true);
            setPrompt(null);
          }}
        >
          <Download aria-hidden />
          Install P·unkt
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-4 text-sm">
          <span className="font-semibold">iPhone or iPad (Safari)</span>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
            <li>
              Tap <Share className="inline size-4 align-text-bottom text-foreground" aria-label="Share" /> Share at the bottom
            </li>
            <li>
              Choose <SquarePlus className="inline size-4 align-text-bottom text-foreground" aria-hidden /> <span className="text-foreground">Add to Home Screen</span>
            </li>
            <li>Tap Add</li>
          </ol>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-4 text-sm">
          <span className="font-semibold">Android (Chrome)</span>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
            <li>Tap the ⋮ menu at the top right</li>
            <li>
              Choose <span className="text-foreground">Install app</span> (or Add to Home screen)
            </li>
            <li>Tap Install</li>
          </ol>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Log in once in the browser first; the app keeps you signed in. Long-press its icon for shortcuts: Reading habits, Add a book, Wishlist.</p>
    </div>
  );
}
