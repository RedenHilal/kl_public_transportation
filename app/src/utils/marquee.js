// Auto-scrolling ("marquee") for truncated text. Markup convention:
//
//   <span class="marquee"><span class="marquee-inner">…long text…</span></span>
//
// The outer `.marquee` clips (overflow:hidden, nowrap); the inner element is
// translated left to reveal the end of the text, pauses, then loops back. Only
// kicks in when the text actually overflows, so short labels stay still.

const animations = new WeakMap(); // inner element -> { anim, overflow }

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function start(inner) {
  const outer = inner.parentElement;
  if (!outer) return;

  // Idempotent: if this element already has a live animation for the same
  // overflow, leave it running (so re-triggering — e.g. on re-render — doesn't
  // visibly restart the scroll).
  const prev = animations.get(inner);
  if (prev && prev.anim.playState !== 'idle' && prev.anim.playState !== 'finished') {
    return;
  }

  // No live animation — reset transform and measure cleanly.
  if (prev) { prev.anim.cancel(); animations.delete(inner); }
  inner.style.transform = '';

  const overflow = inner.scrollWidth - outer.clientWidth;
  if (overflow <= 2 || reducedMotion()) return;

  const PX_PER_SEC = 30;
  const HOLD_MS = 1200;
  const travel = (overflow / PX_PER_SEC) * 1000;
  const total = travel * 2 + HOLD_MS * 2;
  const hold = HOLD_MS / total;
  const trav = travel / total;

  const anim = inner.animate(
    [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: hold },
      { transform: `translateX(${-overflow}px)`, offset: hold + trav },
      { transform: `translateX(${-overflow}px)`, offset: hold * 2 + trav },
      { transform: 'translateX(0)', offset: 1 },
    ],
    { duration: total, iterations: Infinity, easing: 'ease-in-out' }
  );
  animations.set(inner, { anim, overflow });
}

// (Re)evaluate every `.marquee` inside `container` (a DOM node). Idempotent —
// safe to call on every render / resize.
export function autoScrollAll(container) {
  if (!container) return;
  container.querySelectorAll('.marquee > .marquee-inner').forEach(start);
}
