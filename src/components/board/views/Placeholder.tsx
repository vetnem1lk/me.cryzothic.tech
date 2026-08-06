export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="grid min-h-48 flex-1 place-items-center p-8 text-center">
      <div>
        <h2 className="font-mono text-sm tracking-widest text-accent uppercase">{title}</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Sector under construction — content drops at T4. Ask VAI meanwhile.
        </p>
      </div>
    </section>
  );
}
