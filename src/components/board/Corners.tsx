// The board's corner marks, lifted out of Board.tsx so anything framed can wear them:
// four brackets hung a pixel outside the host's own border, so they read as clamps on
// the frame rather than as decoration inside it. Host contract: `relative`, no radius
// (a bracket cannot follow a curve), and nothing on the way up that clips the overhang.

const CORNER = 'absolute h-2.5 w-2.5 border-accent';
const CORNERS = [
  'top-[-1px] left-[-1px] border-t border-l',
  'top-[-1px] right-[-1px] border-t border-r',
  'bottom-[-1px] left-[-1px] border-b border-l',
  'bottom-[-1px] right-[-1px] border-b border-r',
];

export default function Corners() {
  return (
    <>
      {CORNERS.map((c) => (
        <span key={c} aria-hidden className={`${CORNER} ${c}`} />
      ))}
    </>
  );
}
