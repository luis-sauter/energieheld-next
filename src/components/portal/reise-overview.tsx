import Link from "next/link";

export function ReiseOverview({ title, intro, entries }: {
  title: string;
  intro: string;
  entries: readonly string[];
}) {
  return <main id="hauptinhalt" className="container trade-page">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
      <Link href="/">Startseite</Link><span>›</span><span>{title}</span>
    </nav>
    <section className="section">
      <div className="section-heading"><div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div></div>
      <div className="category-grid reise-overview-grid">
        {entries.map((entry) => <article className="category-card" key={entry}>
          <h2>{entry}</h2>
        </article>)}
      </div>
    </section>
  </main>;
}
