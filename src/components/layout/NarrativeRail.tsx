import { chapters } from '@shared/content';
import { useActiveSection } from '@/hooks/useActiveSection';

const chapterIds = chapters.map((chapter) => chapter.id);

/**
 * The narrative rail: an ascending staircase of the story's chapters, fixed to
 * the right edge. It turns the page's structure into a visible object — you can
 * see how many steps are behind you and how many remain, which is the brand
 * promise ("every step toward empowerment") made literal.
 *
 * Desktop only; the reading position itself is carried by the gold hairline
 * across the top of the header, which is the one place it belongs to a control
 * rather than floating over the page.
 */
export function NarrativeRail() {
  const activeId = useActiveSection(chapterIds);

  const activeIndex = Math.max(
    chapters.findIndex((chapter) => chapter.id === activeId),
    0,
  );

  return (
    <nav
      aria-label="Story progress"
      className="fixed top-1/2 right-5 z-50 hidden -translate-y-1/2 2xl:block"
    >
      <ol className="flex flex-col items-end gap-1.5">
        {chapters.map((chapter, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;

          return (
            <li key={chapter.id} className="group flex items-center justify-end gap-2.5">
              <span
                className={`text-[9px] font-extrabold tracking-[0.14em] whitespace-nowrap uppercase transition-all duration-300 ${
                  isActive
                    ? 'text-brand opacity-100'
                    : 'text-muted opacity-0 group-hover:opacity-100'
                }`}
              >
                {chapter.label}
              </span>

              <a
                href={`#${chapter.id}`}
                aria-label={`Step ${chapter.step}: ${chapter.label}`}
                aria-current={isActive ? 'step' : undefined}
                className="flex items-center gap-1"
              >
                {/*
                  Step state is carried by width and by the label that appears
                  on hover, never by the bar's own colour: the label is hidden
                  until hover, so a bar that only differs in hue is a bar whose
                  state a low-vision reader cannot read. Gold was 2.21:1 here
                  and the done steps were 2.35:1 — both under the 3:1 that
                  1.4.11 asks of a graphic that carries meaning, so both are
                  now brand green (9.67:1, 5.4:1 at 70%) and gold is spent
                  only where it is decoration.
                */}
                <span
                  className={`block h-[3px] rounded-full transition-all duration-500 ${
                    isActive
                      ? 'bg-brand'
                      : isDone
                        ? 'bg-brand/70'
                        : 'bg-line group-hover:bg-brand/25'
                  }`}
                  style={{ width: `${18 + index * 9}px` }}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
