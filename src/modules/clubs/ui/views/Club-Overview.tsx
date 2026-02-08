export default function ClubOverview() {
  return (
    <div className="min-h-screen bg-zinc-50">
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">

    <section className="relative">

    <div className="h-48 w-full rounded-2xl bg-zinc-300" >
        <div className="h-48 w-48 rounded-3xl bg-zinc-400 ring-4 ring-white" />
    </div>

 

    <div className="flex-1">
        <h1 className="text-3xl font-bold text-zinc-900">
        AUB Computer Science Club
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
        Faculty-based · Technology
        </p>
    </div>

    <button className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
        Join Club
    </button>
    </section>
  
        <section>Info</section>


        <section>About</section>


        <section>Content</section>
      </div>
    </div>
  )
}