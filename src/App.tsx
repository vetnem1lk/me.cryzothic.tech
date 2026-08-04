import FastPath from './components/FastPath'

export default function App() {
  return (
    <>
      <FastPath />
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 pt-12 text-neutral-100">
        <div className="px-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vladislav Klimentev</h1>
          <p className="mt-3 text-lg text-neutral-400">
            C++ / Qt developer heading into game development · tools and gameplay.
          </p>
          <p className="mt-8 text-sm text-neutral-500">
            The interactive portfolio is under construction. The CV above is one click away.
          </p>
        </div>
      </main>
    </>
  )
}
