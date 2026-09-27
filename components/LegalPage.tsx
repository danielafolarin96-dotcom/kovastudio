import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: Array<[string, string[]]>;
}) {
  return (
    <div className="glow-page">
      <SiteHeader signedIn={false} />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="text-center">
          <span className="chip">Last updated {updated}</span>
          <h1 className="display mt-5 text-4xl sm:text-5xl">{title}</h1>
        </div>
        <div className="mt-12 space-y-4">
          {sections.map(([heading, paragraphs], i) => (
            <section key={heading} className="card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal-2">
                  {i + 1}
                </span>
                <h2 className="text-lg font-bold">{heading}</h2>
              </div>
              {paragraphs.map((p) => (
                <p key={p.slice(0, 32)} className="mt-3 leading-relaxed text-soft">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
