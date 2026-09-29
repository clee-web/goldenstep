import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { chapters, navGroups, type NavChild, type NavGroup } from '@shared/content';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BrandMark } from './BrandMark';
import { TopBar } from './TopBar';

/** Matches Tailwind's `md`, the breakpoint where the desktop navigation wins. */
const DESKTOP = '(min-width: 768px)';

/** Every section the navigation can reach, top level or nested. */
const sectionIds = navGroups.flatMap((group) => [
  group.href.slice(1),
  ...(group.children ?? []).map((child) => child.href.slice(1)),
]);

/** Nav links in DOM order, which is also the order the arrow keys walk them. */
const focusable = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));

/**
 * The chapter a section belongs to, reused as the numeral beside every menu
 * item — so the menu, the narrative rail and the page itself can never disagree
 * about where a section sits in the story.
 */
const chapterNumber = (href: string) =>
  chapters.find((chapter) => chapter.id === href.slice(1))?.step;

interface DrawerChild extends NavChild {
  /** This child's row in the sheet, and so its place in the stagger. */
  row: number;
}

type DrawerItem =
  | { kind: 'group'; group: NavGroup; children: readonly DrawerChild[]; row: number }
  | { kind: 'cta'; label: string; href: string; row: number };

/**
 * The drawer, flattened to one entry per top-level item, with every row's place
 * in the sheet baked in.
 *
 * Children are carried *inside* their group row rather than emitted beside it.
 * They render indented beneath it, and emitting both put every section link in
 * the sheet twice — twenty links instead of ten, which overflowed a phone and
 * pushed the "Get involved" CTA off the bottom to be scrolled to.
 *
 * The row numbers have to be counted out rather than read off the map index.
 * The sheet staggers on one continuous index, and the groups are unevenly
 * sized — three children, then two, then three — so where a group starts
 * depends on every group above it, not on its own position in the list.
 */
function buildDrawer(): readonly DrawerItem[] {
  const items: DrawerItem[] = [];
  let row = 0;

  for (const group of navGroups) {
    if (!group.children) {
      items.push({ kind: 'cta', label: group.label, href: group.href, row });
      row += 1;
      continue;
    }

    const children: DrawerChild[] = group.children.map((child, offset) => ({
      ...child,
      row: row + 1 + offset,
    }));
    items.push({ kind: 'group', group, children, row });
    // The children render too, so the next group starts past all of them.
    row += 1 + children.length;
  }

  return items;
}

const drawerItems = buildDrawer();

export function Header() {
  const { condensed, hidden, progressRef } = useHeaderScroll();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP);
  const activeId = useActiveSection(sectionIds);

  const panelRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef(0);

  // The menus are a pointer-and-keyboard affordance for the desktop row. Rather
  // than watching the breakpoint and clearing state, neither surface is read
  // above it — no effect, no flash of a panel behind the hamburger, and a drawer
  // left open by a rotation cannot keep the page's scroll locked.
  const open = isDesktop ? openGroup : null;
  const drawer = isDesktop ? false : drawerOpen;
  const group = navGroups.find((item) => item.id === open);
  const children = group?.children ?? [];
  const blurb = chapters.find((chapter) => chapter.id === group?.href.slice(1))?.summary;

  // The header steps aside only when nothing of it is in use: an open menu or an
  // open drawer always keeps it on screen, and `useHeaderScroll` already pins it
  // for reduced motion and for the top of the page.
  const aside = hidden && !drawer && !open;

  useLockBodyScroll(drawer);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drawer) {
        setDrawerOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (!openGroup) return;
      // Escape always hands focus back to the trigger that opened the panel, so
      // the reader is never dropped at the top of the document.
      setOpenGroup(null);
      document.getElementById(`nav-trigger-${openGroup}`)?.focus();
      // ...but a trigger re-opens its own panel the moment it receives focus,
      // so that one line above undoes this one: the close is re-queued as an
      // open, the state settles back where it started, and Escape appears to do
      // nothing. Closing again on the next frame is what actually sticks. The
      // intermediate render is the state Escape started from, so there is no
      // flicker — the panel just begins its 220ms collapse a frame later.
      requestAnimationFrame(() => setOpenGroup(null));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, openGroup]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const openPanel = (id: string) => {
    window.clearTimeout(closeTimer.current);
    setOpenGroup(id);
  };

  /**
   * Closing waits a beat. The panel is a descendant of the header, so travelling
   * from the nav row down into it never leaves the header and never triggers
   * this — the delay only absorbs a pointer that is genuinely on its way out.
   */
  const releasePanel = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenGroup(null), 110);
  };

  const toggleDrawer = () => {
    if (drawer) {
      setDrawerOpen(false);
      return;
    }
    setDrawerOpen(true);
    // The sheet is inert while it is closed, so focus can only be moved into it
    // once the open state has been committed.
    requestAnimationFrame(() => focusable(drawerRef.current ?? document.body)[0]?.focus());
  };

  /**
   * Moves focus to `element` after the panel has been re-rendered. The panel is
   * a single shared element, so switching groups swaps its contents; focusing
   * into it has to wait for that commit or the link that is about to exist is
   * not in the document yet.
   */
  const focusIntoPanel = (group: string | undefined, index: number) => {
    setOpenGroup(group ?? null);
    requestAnimationFrame(() => {
      const link = focusable(panelRef.current ?? document.body)[index];
      if (link) link.focus();
      else document.getElementById(`nav-trigger-${group ?? ''}`)?.focus();
    });
  };

  const onHeaderKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const panel = panelRef.current;
    const inPanel = Boolean(panel?.contains(target));

    /*
     * Tab is wired to the panel so the two cannot drift apart in the reading
     * order. One panel serves all three groups and it sits after the whole nav
     * row, so without this a reader tabbing off a trigger walked through the
     * other two triggers — each of which re-rendered the panel out from under
     * them — and only reached its own menu at the very end. Nothing is trapped:
     * every trigger, panel link and the CTA stay reachable in both directions,
     * they are just visited as trigger, its own panel, next trigger, and so on.
     */
    if (event.key === 'Tab') {
      if (target.dataset.navTrigger) {
        if (event.shiftKey) {
          // Backing out of a group; nothing to return into.
          setOpenGroup(null);
          return;
        }
        event.preventDefault();
        focusIntoPanel(target.dataset.navTrigger, 0);
        return;
      }

      if (!panel || !inPanel) return;
      const links = focusable(panel);
      const at = links.indexOf(target);
      if (at < 0) return;
      const group = panel.dataset.group ?? '';
      const trigger = document.getElementById(`nav-trigger-${group}`);

      if (event.shiftKey) {
        // Shift from the first row is the way back to the trigger that opened it.
        if (at !== 0) return;
        event.preventDefault();
        trigger?.focus();
        return;
      }

      // Forward from the last row is the way on to the next item in the row.
      if (at !== links.length - 1) return;
      const row = rowRef.current;
      if (!row) return;
      const items = focusable(row);
      const next = items[items.indexOf(trigger as HTMLElement) + 1];
      if (!next) return;
      event.preventDefault();
      if (next.dataset.navTrigger) {
        focusIntoPanel(next.dataset.navTrigger, 0);
      } else {
        setOpenGroup(null);
        next.focus();
      }
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      // Inside a panel the reading order is the reading order; left and right
      // belong to the nav row.
      if (inPanel) return;
      const row = rowRef.current;
      if (!row) return;
      const items = focusable(row);
      const index = items.indexOf(target);
      if (index < 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
      return;
    }

    if (event.key === 'ArrowDown' && target.dataset.navTrigger) {
      event.preventDefault();
      focusIntoPanel(target.dataset.navTrigger, 0);
      return;
    }

    if (event.key === 'ArrowUp' && inPanel) {
      // Up from the first row returns to the trigger that opened the panel.
      if (focusable(panelRef.current as HTMLElement)[0] !== target) return;
      event.preventDefault();
      document.getElementById(`nav-trigger-${panelRef.current?.dataset.group ?? ''}`)?.focus();
    }
  };

  const onShellKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !drawer) return;
    const sheet = drawerRef.current;
    const toggle = toggleRef.current;
    if (!sheet || !toggle) return;
    // The ring is the drawer's links plus the trigger that opened it, so Tab
    // cycles inside the sheet and can never land on the dimmed page behind.
    // Escape, in the listener above, is always the way out.
    const ring = [...focusable(sheet), toggle];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/*
        The scrim is a sibling of the sticky shell rather than a child of it: the
        shell is transformed while it hides, and a transformed ancestor becomes
        the containing block for fixed positioning, which would tie the scrim to
        the header's own box instead of the viewport.
      */}
      {drawer ? (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        />
      ) : null}

      <div
        onKeyDown={onShellKeyDown}
        className={`sticky top-0 z-50 transition-transform duration-[320ms] ease-settle ${
          aside ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <TopBar />

        <header
          onKeyDown={onHeaderKeyDown}
          onPointerLeave={releasePanel}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setOpenGroup(null);
            }
          }}
          className={`relative border-b backdrop-blur-lg transition-[background-color,border-color,backdrop-filter,box-shadow] duration-[300ms] ease-settle ${
            open
              ? 'border-gold/30 bg-cream/85'
              : condensed
                ? 'border-line bg-paper/90 shadow-bar backdrop-blur-xl'
                : 'border-transparent bg-paper/70'
          }`}
        >
          {/* The reading position, told to the reader in the header itself. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-line/50">
            <div
              ref={progressRef}
              className="progress-fill h-full origin-left bg-gradient-to-r from-brand via-gold to-gold"
            />
          </div>

          <div
            className={`shell flex items-center justify-between gap-4 transition-[height] duration-[300ms] ease-settle ${
              condensed ? 'h-[60px]' : 'h-[68px] md:h-[78px]'
            }`}
          >
            <BrandMark condensed={condensed} />

            <nav aria-label="Primary" className="hidden md:block">
              <ul ref={rowRef} className="flex items-center">
                {navGroups.map((item) => {
                  if (!item.children) {
                    return (
                      <li key={item.id} className="ml-3">
                        <a
                          href={item.href}
                          className="inline-flex items-center rounded-full bg-brand px-[18px] py-[11px] text-[13px] font-extrabold text-white shadow-lift transition-[background-color,transform] duration-200 ease-state hover:-translate-y-0.5 hover:bg-brand-600"
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  }

                  const isOpen = open === item.id;
                  // A group is current when any section it can reach is the one
                  // the reader is in — its own, or any of its children.
                  const isActive = [item.href, ...item.children.map((c) => c.href)].some(
                    (href) => activeId === href.slice(1),
                  );

                  return (
                    <li key={item.id}>
                      <a
                        id={`nav-trigger-${item.id}`}
                        href={item.href}
                        data-nav-trigger={item.id}
                        /* Disclosure, not menu: the trigger is a real link that
                           navigates, and the panel is a region of links rather
                           than a `menu` widget, so `aria-haspopup` is left off
                           on purpose. `aria-expanded` + `aria-controls` is the
                           relationship that describes it honestly. */
                        aria-expanded={isOpen}
                        aria-controls="nav-panel"
                        onPointerEnter={() => openPanel(item.id)}
                        onFocus={() => openPanel(item.id)}
                        onClick={() => setOpenGroup(null)}
                        className={`group relative flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] transition-colors duration-200 ease-state ${
                          // The underline is gold, which is 2.21:1 on paper and
                          // cannot be the thing that says "you are here". The
                          // trigger gains a weight step as well, so the state
                          // survives at 9.67:1 and the gold stays decoration.
                          isActive || isOpen
                            ? 'font-extrabold text-brand'
                            : 'font-bold text-[#425049] hover:text-brand'
                        }`}
                      >
                        {item.label}
                        <svg
                          viewBox="0 0 10 6"
                          width="9"
                          height="6"
                          aria-hidden="true"
                          className={`transition-transform duration-[300ms] ease-settle ${
                            isOpen ? 'rotate-180 opacity-100' : 'opacity-40'
                          }`}
                        >
                          <path
                            d="M1 1l4 4 4-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span
                          aria-hidden="true"
                          className={`absolute inset-x-3 bottom-0.5 h-[2px] origin-left rounded-full bg-gold transition-transform duration-[300ms] ease-settle ${
                            isActive ? 'scale-x-100' : 'scale-x-0'
                          }`}
                        />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Two rules that morph into a cross — the same two lines, rotated
                into each other, rather than one icon swapped for another. */}
            <button
              ref={toggleRef}
              type="button"
              onClick={toggleDrawer}
              aria-label={drawer ? 'Close navigation' : 'Open navigation'}
              aria-expanded={drawer}
              aria-controls="mobile-nav"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-ink transition-colors duration-200 ease-state hover:bg-cream md:hidden"
            >
              <span aria-hidden="true" className="relative block h-4 w-5">
                <span
                  className={`absolute inset-x-0 top-[3px] block h-[1.5px] rounded-full bg-current transition-transform duration-[300ms] ease-settle ${
                    drawer ? 'translate-y-[5px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`absolute inset-x-0 top-[13px] block h-[1.5px] rounded-full bg-current transition-transform duration-[300ms] ease-settle ${
                    drawer ? '-translate-y-[5px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>

          {/*
            One panel serves all three menus, so switching groups crossfades in
            place instead of moving a box. It is a grid row rather than a
            measured height, so nothing has to be observed to resize it, and it
            is `inert` while closed, which keeps its links out of the tab order
            without a focus trap.
          */}
          <div
            id="nav-panel"
            ref={panelRef}
            data-nav-panel
            data-group={group?.id ?? ''}
            data-open={open ? 'true' : 'false'}
            inert={!open}
            className="absolute inset-x-0 top-full hidden md:grid"
            style={{
              gridTemplateRows: open ? '1fr' : '0fr',
              transition: `grid-template-rows ${open ? 300 : 220}ms var(--ease-settle)`,
            }}
          >
            <div className="overflow-hidden">
              <div
                className={`border-t border-gold/45 bg-paper/95 shadow-panel backdrop-blur-xl transition-[opacity,transform] duration-[240ms] ease-settle ${
                  open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'
                }`}
              >
                <div className="shell flex flex-col gap-6 py-7 lg:flex-row lg:gap-12">
                  <div className="lg:w-[212px] lg:shrink-0 lg:border-r lg:border-line lg:pr-10">
                    <p className="font-display text-[19px] leading-tight font-semibold text-ink">
                      {group?.label}
                    </p>
                    {blurb ? (
                      <p className="mt-2 max-w-[38ch] text-[11.5px] leading-relaxed text-muted">
                        {blurb}
                      </p>
                    ) : null}
                  </div>

                  {/* Keyed on the group: a switch of menus replays the stagger
                      instead of showing the new rows already settled. */}
                  <ul
                    key={group?.id ?? 'closed'}
                    className={`grid flex-1 gap-1 sm:grid-cols-2 ${
                      children.length > 2 ? 'lg:grid-cols-3' : ''
                    }`}
                  >
                    {children.map((child, index) => {
                      const isCurrent = activeId === child.href.slice(1);

                      return (
                        <li
                          key={child.href}
                          className="nav-row"
                          style={{ '--row-delay': `${index * 34}ms` } as CSSProperties}
                        >
                          <a
                            href={child.href}
                            aria-current={isCurrent ? 'true' : undefined}
                            onClick={() => setOpenGroup(null)}
                            className={`group/row flex h-full gap-3 rounded-xl border px-3 py-3 transition-colors duration-200 ease-state hover:border-transparent hover:bg-cream focus-visible:border-transparent focus-visible:bg-cream ${
                              isCurrent ? 'border-gold/40 bg-cream' : 'border-transparent'
                            }`}
                          >
                            {/* Gold on cream is 2.2:1, so the numeral is set in
                                brand green (6.9:1) and the gold is spent on the
                                marker and the panel's top edge instead. */}
                            <span
                              aria-hidden="true"
                              className={`mt-[3px] h-6 w-[2px] shrink-0 rounded-full transition-colors duration-200 ease-state ${
                                isCurrent ? 'bg-gold' : 'bg-line group-hover/row:bg-gold'
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="flex items-baseline gap-2">
                                <span className="font-display text-[11px] font-bold tabular-nums text-brand-600">
                                  {chapterNumber(child.href)}
                                </span>
                                {/*
                                  The active row is distinguished by a weight
                                  step and by colour, not by the gold marker
                                  alone. Two pale hues at 2.21:1 and 1.27:1 are
                                  indistinguishable to a low-vision reader, so
                                  the marker is treated as decoration and the
                                  state itself is carried at 9.67:1.
                                */}
                                <span
                                  className={`text-[13.5px] ${
                                    isCurrent
                                      ? 'font-extrabold text-brand'
                                      : 'font-bold text-ink'
                                  }`}
                                >
                                  {child.label}
                                </span>
                              </span>
                              <span className="mt-1 block max-w-[36ch] text-[11.5px] leading-[1.5] text-muted">
                                {child.description}
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* A curtain, not a slide: the sheet is anchored to the header, so a
              vertical wipe reads as the menu unrolling from the bar rather than
              a box arriving from nowhere. */}
          <nav
            id="mobile-nav"
            ref={drawerRef}
            aria-label="Mobile"
            data-open={drawer ? 'true' : 'false'}
            inert={!drawer}
            className="drawer absolute inset-x-0 top-full max-h-[calc(100dvh-6.5rem)] overflow-y-auto border-t border-line bg-paper py-5 shadow-panel md:hidden"
          >
            <ul className="flex flex-col">
              {drawerItems.map((item) => {
                const close = () => setDrawerOpen(false);
                const delay = (row: number) =>
                  ({ '--row-delay': `${row * 32}ms` }) as CSSProperties;

                if (item.kind === 'cta') {
                  return (
                    <li key={item.href} className="drawer-row pt-4" style={delay(item.row)}>
                      <a
                        href={item.href}
                        onClick={close}
                        className="block rounded-full bg-brand px-5 py-3.5 text-center text-[13px] font-extrabold text-white shadow-lift"
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                }

                return (
                  <li
                    key={item.group.id}
                    className="drawer-row border-b border-line/70 pb-2"
                    style={delay(item.row)}
                  >
                    <a
                      href={item.group.href}
                      onClick={close}
                      aria-current={activeId === item.group.href.slice(1) ? 'true' : undefined}
                      className={`flex items-center justify-between gap-3 pt-3.5 pb-2 text-[15px] font-extrabold transition-colors duration-200 ${
                        activeId === item.group.href.slice(1) ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {item.group.label}
                      <span className="font-display text-[12px] font-bold tabular-nums text-brand-600">
                        {chapterNumber(item.group.href)}
                      </span>
                    </a>
                    <ul>
                      {item.children.map((child) => (
                        <li key={child.href} className="drawer-row" style={delay(child.row)}>
                          <a
                            href={child.href}
                            onClick={close}
                            aria-current={activeId === child.href.slice(1) ? 'true' : undefined}
                            className={`block py-2.5 pl-4 text-[13.5px] transition-colors duration-200 ${
                              activeId === child.href.slice(1)
                                ? 'font-semibold text-brand'
                                : 'font-medium text-muted'
                            }`}
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>
      </div>
    </>
  );
}
