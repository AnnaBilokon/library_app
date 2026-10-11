"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Achievement } from "@/lib/habits";

// Confetti: fixed spread and timing so it's the same every time (no randomness during render).
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 70,
  colour: `var(--genre-${(i % 8) + 1})`,
  size: 6 + (i % 3) * 3,
  turn: (i * 47) % 360,
}));

/** A badge you just earned: big, popping in, with a burst of confetti. */
export function Celebration({ achievements, onClose }: { achievements: Achievement[]; onClose: () => void }) {
  const [first, ...rest] = achievements;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="overflow-hidden text-center sm:max-w-sm">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {PIECES.map((p, i) => (
            <span
              key={i}
              className="confetti-fall absolute -top-4 rounded-[2px]"
              style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, background: p.colour, animationDelay: `${p.delay}ms`, rotate: `${p.turn}deg` }}
            />
          ))}
        </div>
        <span className="badge-pop mx-auto grid size-24 place-items-center rounded-full bg-highlight text-5xl shadow-lg" aria-hidden>
          {first.emoji}
        </span>
        <DialogTitle className="font-heading text-2xl">{first.title}!</DialogTitle>
        <DialogDescription className="text-base">{first.description}</DialogDescription>
        {rest.length > 0 && <p className="text-sm text-muted-foreground">Also earned: {rest.map((a) => `${a.emoji} ${a.title}`).join(", ")}</p>}
        <Button className="mx-auto rounded-full px-6" onClick={onClose}>
          Yay!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
