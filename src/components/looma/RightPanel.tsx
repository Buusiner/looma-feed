const SUGGESTIONS = [
  { name: "Lucas Mendes", handle: "@lucasmendes", role: "Youtuber" },
  { name: "Camila Rocha", handle: "@camilarocha", role: "Designer" },
  { name: "Diego Dev", handle: "@diegodev", role: "Desenvolvedor" },
];

const TRENDS = [
  { label: "Criadores", topic: "#looma", count: "2.4k publicações" },
  { label: "Edição de vídeo", topic: "Dicas", count: "1.8k publicações" },
  { label: "Marketplace", topic: "Freelance", count: "940 publicações" },
];

export function LoomaAside() {
  return (
    <aside className="sticky top-0 hidden h-fit w-80 shrink-0 px-4 py-5 xl:block">
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold text-foreground">Quem seguir</h2>
        <div className="mt-3 space-y-4">
          {SUGGESTIONS.map((s) => (
            <div key={s.handle} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-avatar" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{s.handle}</p>
                <p className="truncate text-xs text-subtle">{s.role}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-primary px-4 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Seguir
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold text-foreground">Em alta na Looma</h2>
        <div className="mt-3 space-y-4">
          {TRENDS.map((t) => (
            <div key={t.topic}>
              <p className="text-xs text-subtle">{t.label}</p>
              <p className="text-[15px] font-semibold text-foreground">{t.topic}</p>
              <p className="text-[13px] text-muted-foreground">{t.count}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
