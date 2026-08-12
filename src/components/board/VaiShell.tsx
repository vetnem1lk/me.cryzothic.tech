// The board's terminal: the visitor's questions, the queue that answers them one
// at a time, and the paced typing that puts each answer on screen character by
// character. The pacing math is drain.ts; the wire is apiTransport.ts.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'wouter';
import { usePathname } from 'wouter/use-browser-location';
import { useLang, useT } from '../../i18n/I18nContext';
import { mirrorTarget, pathForLang } from '../../i18n/locale';
import CommandRow from './CommandRow';
import { runCommand } from './commands';
import TextType from './TextType';
import { apiTransport } from './apiTransport';
import { EMPTY, push, take, type DrainState } from './drain';
import { chain } from './queue';
import {
  CHAPTERS,
  DIMS,
  earnedCount,
  firstContact,
  isUnlocked,
  photoSlug,
  subscribe,
  takeAchievement,
  type Achievement,
  type ChapterId,
} from './story';
import { MODE_NAME, history, type AgentMode, type ChatMessage } from './transport';
import Lightbox from './views/Lightbox';

const TYPE_SPEED = { min: 45, max: 180 };
const CURSOR_BLINK = 0.5; // seconds per half-blink, matching the input's own cursor

const segClass = (active: boolean, side: 'l' | 'r') =>
  `cursor-target border border-dashed px-2 py-0.5 uppercase ${side === 'l' ? 'rounded-l border-r-0' : 'rounded-r'} ${
    active
      ? 'border-accent/60 text-accent'
      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
  }`;

// A number, so React can compare snapshots without a memo: the shell only cares how
// many covers are off, not which.
const openFileCount = () => CHAPTERS.filter(isUnlocked).length;

// What each badge is called out loud. The ids are the store's; the lines are the
// dictionary's, and the `[sys]` badge is still the renderer's.
const ACH_KEY: Record<Achievement, string> = {
  'first-file': 'vai.sys.achFirstFile',
  'all-seven': 'vai.sys.achAllSeven',
  konami: 'vai.sys.achKonami',
  'first-contact': 'vai.sys.achFirstContact',
  blueprints: 'vai.sys.achBlueprints',
};

// Which chapter a chat photo is of, read back off its own URL. The message carries
// what it shows rather than an id — the wire shape stays two strings — and the slug
// is the store's own cut, so this reverses it instead of parsing the file name.
const chapterOf = (src: string) => CHAPTERS.find((c) => src.includes(photoSlug(c)));

/**
 * A photo attached to a line of the log: a thumbnail that opens the full one. The
 * width and height are the file's measured size, which is what reserves its box
 * before the bytes arrive — the log scrolls to the bottom when a message lands, not
 * when an image finishes loading, so one that grew on arrival would push the line
 * being read out of view. The `-640` derivative is a different size but the same
 * shape, and the shape is all a reserved box needs.
 */
function ChatPhoto({
  image,
  onOpen,
}: {
  image: NonNullable<ChatMessage['image']>;
  onOpen: (id: ChapterId) => void;
}) {
  const id = chapterOf(image.src);
  if (!id) return null;
  const [w, h] = DIMS[id];
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="cursor-target mt-1.5 block w-40 max-w-full"
    >
      <img
        src={image.src}
        alt={image.alt}
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded border border-dashed border-accent/40 hover:border-accent"
      />
    </button>
  );
}

export default function VaiShell({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  // Base-unaware, unlike the router's own location: the mirror is computed on the
  // real address bar, and the `~` puts the resulting link outside the base again.
  const pathname = usePathname();
  // Base-aware navigation — the whole point of taking it from the router instead of
  // the browser-location module: `/loot` from a command becomes `/ru/loot` under
  // the RU base. Commands stay unprefixed; wouter prepends.
  const [location, navigate] = useLocation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<AgentMode>('vai');
  // The chapter the viewer is open on, if a photo in the log was clicked. Its own
  // instance, not the one /nda mounts: the terminal is on screen in every sector,
  // and only one dialog is ever open anyway.
  const [photo, setPhoto] = useState<ChapterId | null>(null);
  const modeRef = useRef<AgentMode>('vai');
  // ponytail: promise-chain serialization — replies land in submit order even
  // when a future live transport resolves out of order. The chaining itself is
  // queue.ts, which is where that claim is pinned instead of asserted.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  // A turn reads the log as it stands when the queue reaches it, long after the
  // render that started it — so the ref leads and React follows. Neither an
  // effect nor a functional updater is soon enough: both run at commit or render
  // time, while the next queued turn resumes on a microtask as soon as the last
  // one resolves, and it would read a log still missing the answer that just
  // finished. Every write to the log goes through here, which is what lets the
  // ref be the newest version instead of a copy chasing one.
  const messagesRef = useRef(messages);
  const setMsgs = (fn: (m: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = fn(messagesRef.current);
    setMessages(messagesRef.current);
  };
  // Leaving the board must not leave a paint loop or an open socket behind.
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);
  // ponytail: read per render like TextType, not subscribed — an OS toggle
  // mid-answer applies to the next turn.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Only one line is ever pending: the queue answers one question at a time.
  const pendingId = messages.find((m) => m.pending)?.id;

  // The greeting is furniture the shell prints, not a turn the model took — hence
  // `local`, and hence derived per render instead of seeded into the log: a
  // language switch does not remount this component, so a greeting held in state
  // would keep its old words and hand the chip a stale path to mirror.
  const greeting: ChatMessage = {
    role: 'agent',
    text: t('vai.greeting'),
    from: 'vai',
    local: true,
    actions: [
      // First chip: the story is the one door here that is played rather than
      // read. Same label as the briefing's own chip — one offer, two places.
      { label: t('vai.cta.story'), to: '/nda' },
      // Straight to the route, not a synthesized /3d — the visitor asked for the
      // engine bay, not for a command echoed back at them.
      { label: t('vai.cta.engine'), to: '/3d' },
      // The label is the command that does the same thing, so the chip teaches the
      // shell instead of only using it — and being shell syntax rather than prose,
      // it reads the same to whoever cannot read the page they are on. Query and
      // hash come off the address bar at render; a chip the visitor clicks needs
      // the value as it stands then, not a subscription.
      {
        label: lang === 'ru' ? '[/en]' : '[/ru]',
        to: mirrorTarget(pathname, window.location.search, window.location.hash),
      },
    ],
  };

  // One string, three jobs: the field's accessible name, its placeholder and the
  // label that types itself while the field is empty. Only the `C:\>` prefix is
  // composed here — shell syntax, not prose, so it stays out of the dictionary.
  const ask = t('vai.sys.ask', { mode: MODE_NAME[mode] });
  const prompt = `C:\\> ${ask}`;

  useGSAP(
    () => {
      if (!cursorRef.current) return;
      gsap.to(cursorRef.current, {
        opacity: 0,
        duration: CURSOR_BLINK,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
    },
    { scope: rootRef, dependencies: [pendingId], revertOnUpdate: true },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A photo is open in the viewer, which owns the keyboard while it is: Esc
      // closes the dialog and must not also close the sheet behind it, and `~` must
      // not pull focus to a field the modal has made inert. Read off the document
      // rather than the event's target, which is the same answer for both keys
      // however focus happens to be placed.
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose();
        return;
      }
      if (e.key !== '`' && e.key !== '~') return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  // Covers come off all over the board — a tile on /nda, a CV taken from the loot
  // table — and the terminal is the one thing standing beside all of them, so it is
  // what says a file just opened and names the command that reads it out. Written
  // from an effect and never from the store's callback: /declassify opens its file
  // in the middle of assembling that same turn, and a line pushed from in there
  // would land above the visitor's own. The lore queue is left alone — it is /lore's.
  const openFiles = useSyncExternalStore(subscribe, openFileCount);
  const announced = useRef(openFiles);
  // `t` is a fresh closure every render, so naming it a dependency re-ran this
  // effect on every frame of a typed answer. The count is the only thing that can
  // make it say anything, and the label is wanted in whatever language is on
  // screen the moment a cover comes off — which is exactly what a ref holds.
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    // Only growth is news. Anything else — a reset, a first read — just re-baselines.
    if (openFiles > announced.current)
      setMsgs((m) => [...m, { role: 'sys', text: tRef.current('sector.nda.labels.newChapter') }]);
    announced.current = openFiles;
  }, [openFiles]);

  // The badges, on the same principle and one lane over: earned all over the board —
  // and three of them nowhere near a cover — announced by the one thing standing
  // beside all of them. Its own snapshot, because a badge can be earned without a
  // cover coming off; the queue is what is read, not the count, so a second run of
  // this effect finds it already empty rather than saying everything twice; the
  // dep is the doorbell — remove it and the queue is only read once.
  const badges = useSyncExternalStore(subscribe, earnedCount);
  useEffect(() => {
    for (let a = takeAchievement(); a; a = takeAchievement())
      setMsgs((m) => [...m, { role: 'sys', text: tRef.current(ACH_KEY[a]) }]);
  }, [badges]);

  // Navigation is the sheet's exit: on a phone the shell covers the board, so a
  // route change — an action link, or any /command that navigates — means the
  // visitor chose a destination hidden behind the overlay. Only a *change*
  // closes it; opening the sheet leaves the location alone and re-runs this. A
  // language switch — the chip, or the /en and /ru commands — mirrors the path,
  // so base-relative it is the same location (/career -> /career) and the sheet
  // stays open on purpose: the visitor stays where they were, in the other
  // language. That only holds while those two commands mirror instead of jumping
  // to the root; the base-relative location would change and this would fire.
  const prevLoc = useRef(location);
  useEffect(() => {
    if (location === prevLoc.current) return;
    prevLoc.current = location;
    if (mobileOpen) onMobileClose();
  }, [location, mobileOpen, onMobileClose]);

  function switchMode(next: AgentMode) {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    setMsgs((m) => [
      ...m,
      { role: 'sys', text: t(next === 'vai' ? 'vai.sys.modeVai' : 'vai.sys.modeGai') },
    ]);
  }

  /**
   * One live answer: tokens stream into the drain, a paint loop types them out,
   * and the promise settles when the last character is on screen — which is what
   * holds the next question in the queue until this one has finished.
   */
  const runTurn = (text: string, turnMode: AgentMode, askId: string, replyId: string) =>
    new Promise<void>((resolve) => {
      // Queued behind an unmount: never open a request the board cannot show.
      if (!aliveRef.current) return resolve();
      let st: DrainState = EMPTY;
      let last = performance.now();
      let failed = false;

      const paint = (now: number) => {
        if (!aliveRef.current) return resolve(); // the board went away mid-answer
        const [chunk, next] = take(st, reduced ? Infinity : now - last);
        st = next;
        last = now;
        if (chunk) {
          setMsgs((all) => all.map((m) => (m.id === replyId ? { ...m, text: m.text + chunk } : m)));
        }
        if (st.doneFeeding && st.shown >= st.buf.length) {
          // A turn that produced no text at all leaves no empty line behind, but
          // it does owe the visitor a reason: the error path wrote one already,
          // a clean stream that said nothing has to say so itself.
          if (!st.buf && !failed) {
            setMsgs((m) => [...m, { role: 'sys', text: t('vai.sys.empty') }]);
          }
          setMsgs((all) =>
            all
              .filter((m) => m.id !== replyId || m.text)
              .map((m) => (m.id === replyId ? { ...m, pending: false } : m)),
          );
          // A word said to VAI and answered. Here rather than at submit or the end
          // of the feed, so the badge lands under a reply the visitor has finished
          // reading instead of interrupting one still being typed out — and
          // idempotent in the store, so every turn after the first is free. A
          // question the transport never answered earns nothing: a clean stream that
          // said nothing is not an answer, and neither is half of one under an error —
          // the condition the end of the feed used to carry on its own.
          if (st.buf && !failed) firstContact();
          return resolve();
        }
        requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);

      const ac = new AbortController();
      abortRef.current = ac;
      apiTransport.send(
        text,
        turnMode,
        // ponytail: `askId` drops this question and only this one. Type a third
        // question while the first answer is still running and it is already in
        // the log, so the model can see a question that comes after the one it
        // is answering — accepted, like drop-oldest: the alternative is threading
        // a turn index through every line.
        history(messagesRef.current, turnMode, askId),
        {
          onToken: (tok) => {
            st = push(st, tok);
          },
          onDone: () => {
            st = { ...st, doneFeeding: true };
          },
          onError: (msg, vars) => {
            // Ending the feed is what closes the turn: the loop types out
            // whatever arrived, drops the cursor and lets the queue move on.
            // The service's own watchdogs mean a stalled stream lands here too.
            failed = true;
            st = { ...st, doneFeeding: true };
            // A `vai.error.*` key resolves; a message the service sent is not a
            // key and comes back out of `t` unchanged, still English.
            setMsgs((m) => [...m, { role: 'sys', text: t(msg, vars) }]);
          },
        },
        ac.signal,
      );
    });

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const requestMode = modeRef.current;
    // Resolved here, once: /joke and /lore advance a counter, so the queue must
    // not run them a second time. Only the rendering waits for the queue.
    const cmd = runCommand(text);
    const askId = crypto.randomUUID();
    const replyId = crypto.randomUUID();
    // A command and its answer are shell-local — shown, never replayed to the
    // model, whose message and character budget belongs to the conversation.
    setMsgs((m) => [...m, { role: 'user', text, from: requestMode, id: askId, local: !!cmd }]);
    // The `.catch` stays here rather than moving into the chain: it is the shell
    // that has a log to write the failure into, and swallowing it one call earlier
    // would print nothing.
    queueRef.current = chain(queueRef.current, async () => {
      if (cmd) {
        // The registry answers with a dictionary key; the language is whatever
        // the URL said when the visitor pressed Enter. /en and /ru are the two
        // that then change it — their confirmation is written in the language
        // they switch to, so it still matches the page it lands on.
        setMsgs((m) => [
          ...m,
          {
            role: 'agent',
            text: t(cmd.textKey),
            from: requestMode,
            local: true,
            // The photo's alt is a dictionary key like the answer itself, and is
            // resolved with it: what goes into the log is what is on the screen.
            image: cmd.image && { ...cmd.image, alt: t(cmd.image.alt) },
          },
        ]);
        if (cmd.navigateLang) {
          // Same sector, other language. Read off the address bar rather than
          // the render that queued this, because a command can sit in the queue
          // behind a whole model answer while the visitor keeps clicking — the
          // mirror has to be of where they are now. `~` then puts the result
          // outside the router base, which is where the other language lives.
          const to = pathForLang(cmd.navigateLang, window.location.pathname);
          // Already reading that language: pathForLang is a no-op and so is the
          // command. Pushing the identical URL would only litter the history.
          // The guard compares paths alone on purpose — the query and hash
          // appended below are the ones already in the bar, so weighing them
          // too would only ever compare each to itself.
          if (to !== window.location.pathname)
            navigate('~' + to + window.location.search + window.location.hash);
        } else if (cmd.navigateTo) navigate(cmd.navigateTo);
        return;
      }
      // An empty pending line is the thinking state: the cursor blinks alone
      // until the first token lands.
      setMsgs((m) => [
        ...m,
        { role: 'agent', text: '', from: requestMode, id: replyId, pending: true },
      ]);
      await runTurn(text, requestMode, askId, replyId);
    }).catch(() => {
      setMsgs((m) => [...m, { role: 'sys', text: t('vai.sys.transport') }]);
    });
  }

  return (
    <aside
      ref={rootRef}
      data-dock
      className={`flex min-h-0 flex-col md:border-r md:border-dashed md:border-neutral-800 ${
        mobileOpen
          ? 'max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:z-50 max-md:max-h-[70dvh] max-md:rounded-lg max-md:border max-md:border-accent/50 max-md:bg-neutral-950/95 max-md:backdrop-blur'
          : ''
      }`}
    >
      <header className="flex items-center justify-between border-b border-dashed border-neutral-800 px-3 py-2">
        <span className="font-mono text-sm tracking-widest text-accent uppercase">
          {MODE_NAME[mode]}
        </span>
        <div className="flex items-center gap-3">
          <div role="group" aria-label={t('vai.modeGroup')} className="flex font-mono text-xs">
            <button
              type="button"
              aria-pressed={mode === 'vai'}
              onClick={() => switchMode('vai')}
              className={segClass(mode === 'vai', 'l')}
            >
              VAI
            </button>
            <button
              type="button"
              aria-pressed={mode === 'gai'}
              onClick={() => switchMode('gai')}
              className={segClass(mode === 'gai', 'r')}
            >
              GAI
            </button>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={onMobileClose}
              className="cursor-target font-mono text-sm text-neutral-400 md:hidden"
            >
              {t('vai.close')}
            </button>
          )}
        </div>
      </header>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-base max-md:max-h-56"
      >
        {[greeting, ...messages].map((m, i) =>
          m.role === 'sys' ? (
            // The one place the `[sys]` badge is printed. It marks the shell
            // talking about itself rather than answering, and every line of that
            // kind lands here — the dictionary's, the transport's, and whatever a
            // later feature writes — so none of them carries its own.
            <p key={i} className="font-mono text-xs text-sep-mint/80">
              [sys] {m.text}
            </p>
          ) : (
            <p
              // Two keys for one line, deliberately. A line still being typed is
              // aria-hidden, because an announcement every frame is unusable —
              // but that made the finish nothing more than an attribute coming
              // off, and an un-hidden node is not an added one: several screen
              // readers say nothing at all. Moving the key on the same commit
              // makes React replace the <p> rather than update it, so the
              // finished answer enters the live region as new content and is
              // read once, whole. Only the typing line's key moves — every other
              // index keeps the key it had, so nothing else in the log reshuffles.
              key={m.pending ? `${i}-typing` : i}
              aria-hidden={m.pending || undefined}
              className={
                m.role === 'agent'
                  ? 'whitespace-pre-line text-neutral-200'
                  : 'text-right text-neutral-400'
              }
            >
              {m.role === 'agent' && (
                <span className="mr-1 font-mono text-accent">{MODE_NAME[m.from ?? 'vai']}:</span>
              )}
              {m.text}
              {m.pending && !reduced && (
                <span ref={cursorRef} className="ml-0.5 inline-block text-accent">
                  _
                </span>
              )}
              {/* Same guard as the links below, for the same two reasons — and a
                  real button, not a click handler on the image: opening the full
                  photo is an action, so it has to be reachable from the keyboard.
                  Its accessible name is the alt text inside it. */}
              {m.image && !m.pending && <ChatPhoto image={m.image} onOpen={setPhoto} />}
              {/* `!m.pending` keeps a focusable control out of an aria-hidden
                  subtree — the two are mutually exclusive by construction. It
                  also keeps the offer off a half-typed line. Real links, not
                  buttons: middle-click, open-in-new-tab and the links rotor all
                  work, and wouter still routes the plain click. */}
              {m.actions && !m.pending && (
                <span className="mt-1.5 flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <Link
                      key={a.label}
                      href={a.to}
                      // The route watcher above closes the sheet on a change, and a
                      // chip is a chosen destination whether or not the address
                      // changes: tapping the story chip while already on /nda would
                      // otherwise leave the overlay sitting over the page it just
                      // asked for. Closing twice is free.
                      onClick={onMobileClose}
                      className="cursor-target rounded border border-dashed border-accent/60 px-2 py-0.5 font-mono text-xs text-accent hover:border-accent"
                    >
                      {a.label}
                    </Link>
                  ))}
                </span>
              )}
            </p>
          ),
        )}
      </div>
      <CommandRow onRun={submit} />
      <form
        className="relative border-t border-dashed border-neutral-800 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = inputRef.current?.value ?? '';
          if (inputRef.current) inputRef.current.value = '';
          submit(v);
        }}
      >
        <input
          ref={inputRef}
          id="vai-prompt"
          name="prompt"
          aria-label={ask}
          autoComplete="off"
          // The service rejects anything longer; better a full field than a
          // round trip that comes back a 400.
          maxLength={500}
          placeholder={prompt}
          className="caret-terminal peer w-full bg-transparent px-1 py-1 font-mono text-base outline-none placeholder:text-transparent focus:placeholder:text-neutral-600"
        />
        <TextType
          // Remounts on a language switch as well as a mode switch, so the label
          // retypes from empty instead of resuming halfway through other words.
          key={`${mode}-${lang}`}
          text={prompt}
          variableSpeed={TYPE_SPEED}
          className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 font-mono text-base peer-focus:hidden peer-not-placeholder-shown:hidden"
        />
      </form>
      {/* The dialog lives in the top layer, so where it is mounted decides nothing
          about where it appears — only which chapter it is asked for. */}
      <Lightbox chapters={CHAPTERS} openAt={photo} onClose={() => setPhoto(null)} />
    </aside>
  );
}
