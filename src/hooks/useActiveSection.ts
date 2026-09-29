import { useEffect, useState } from 'react';

/** Highlights the nav item whose section is currently on screen. */
export function useActiveSection(ids: readonly string[]) {
  const [activeId, setActiveId] = useState<string>(ids[0] ?? '');

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) return;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }

        if (visible.size > 0) {
          // Pick whichever tracked section occupies the most viewport.
          const ranked = [...visible.entries()].sort((a, b) => b[1] - a[1]);
          setActiveId(ranked[0][0]);
        }
      },
      { threshold: [0.15, 0.35, 0.6, 0.85], rootMargin: '-96px 0px -40% 0px' },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}
