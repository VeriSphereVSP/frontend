import ClaimCard from "./ClaimCard";

export default function InlineArticle({ article }: { article: any }) {
  return (
    <div className="card">
      <h2>{article.title}</h2>

      {article.sections.map((s: any) => (
        <div key={s.id} style={{ marginBottom: 16 }}>
          <p
            style={{
              borderLeft: "3px solid #e5e7eb",
              paddingLeft: 12,
              position: "relative",
            }}
          >
            {s.text}
            <sup style={{ opacity: 0.5, marginLeft: 4 }}>◊</sup>
          </p>

          <div style={{ marginLeft: 16 }}>
            {s.claims.map((c: any, i: number) => (
              <ClaimCard key={i} card={c} onAction={() => {}} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

