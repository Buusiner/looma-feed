import { useState } from "react";
import {
  Image as ImageIcon,
  Smile,
  MessageCircle,
  Repeat2,
  Heart,
  Share,
} from "lucide-react";

const POSTS = [
  {
    name: "Ana Costa",
    handle: "@anacosta",
    time: "2h",
    text: "Acabei de fechar meu primeiro projeto pelo Looma 🔥 Encontrei um youtuber incrível em menos de 24h. Isso aqui é diferente.",
    stats: [12, 4, 86, 3],
  },
  {
    name: "Rafael Torres",
    handle: "@rafaeltorres",
    time: "5h",
    text: "Alguém aqui trabalha com edição de vídeo para canal de finanças? Preciso de alguém constante, 4 vídeos por semana. Me chama.",
    stats: [31, 9, 47, 6],
  },
  {
    name: "Julia Alves",
    handle: "@juliaalves",
    time: "8h",
    text: "Dica: preencha seu perfil completo no Looma. Recebi 3 propostas em 2 dias só por ter colocado meu portfólio direitinho.",
    stats: [8, 15, 124, 11],
  },
];

const ACTIONS = [MessageCircle, Repeat2, Heart, Share];

export function LoomaFeed() {
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [text, setText] = useState("");

  return (
    <main className="mx-auto w-full max-w-[600px] border-line lg:border-x">
      <div className="sticky top-0 z-10 flex border-b border-line bg-background/95 backdrop-blur">
        {[
          { id: "foryou", label: "Para você" },
          { id: "following", label: "Seguindo" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className="flex-1 p-4 text-[15px]"
          >
            <span
              className={
                "inline-block pb-3 -mb-3 " +
                (tab === t.id
                  ? "border-b-2 border-primary font-bold text-foreground"
                  : "text-muted-foreground")
              }
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div className="border-b border-line p-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-avatar" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que está acontecendo?"
            className="min-h-20 w-full resize-none border-none bg-transparent text-lg text-foreground outline-none placeholder:text-subtle"
          />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-4 pl-13">
            <ImageIcon size={20} className="text-primary" />
            <Smile size={20} className="text-primary" />
          </div>
          <button
            type="button"
            disabled={!text.trim()}
            className="rounded-full bg-primary px-[18px] py-2 text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            Publicar
          </button>
        </div>
      </div>

      {POSTS.map((post) => (
        <article key={post.handle} className="border-b border-line p-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-avatar" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold text-foreground">{post.name}</span>
                <span className="text-sm text-muted-foreground">{post.handle}</span>
                <span className="text-sm text-subtle">· {post.time}</span>
              </div>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground">{post.text}</p>
              <div className="mt-3 flex items-center justify-between pr-6">
                {ACTIONS.map((Icon, i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex items-center gap-1 text-[13px] text-subtle transition-colors hover:text-primary"
                  >
                    <Icon size={16} />
                    {post.stats[i]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
    </main>
  );
}
