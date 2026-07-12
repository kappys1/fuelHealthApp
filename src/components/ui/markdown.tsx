import type { ReactNode } from "react";

/*
  Renderer de markdown MÍNIMO para las respuestas de IA (coach, preparar-visita,
  chat). Los modelos devuelven **negrita**, *cursiva*, listas y párrafos; sin esto
  se veían los `**` en crudo. Cubre lo que la IA usa de verdad; no es un parser
  completo. Seguro: genera elementos React (nunca dangerouslySetInnerHTML).
*/

// Inline: **negrita** / __negrita__ · *cursiva* / _cursiva_ · `código`.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null = regex.exec(text);
  while (m !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[4] != null) nodes.push(<em key={key++}>{m[4]}</em>);
    else if (m[5] != null)
      nodes.push(
        <code key={key++} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">
          {m[5]}
        </code>,
      );
    last = regex.lastIndex;
    m = regex.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isListItem = (l: string) => /^\s*([-*]|\d+\.)\s+/.test(l);
const isHeading = (l: string) => /^#{1,4}\s+/.test(l);

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(
        <p key={key++} className="font-semibold text-foreground">
          {renderInline(h[2] ?? "")}
        </p>,
      );
      i++;
      continue;
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && isListItem(lines[i] ?? "")) {
        const content = (lines[i] ?? "").replace(/^\s*([-*]|\d+\.)\s+/, "");
        items.push(<li key={items.length}>{renderInline(content)}</li>);
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={key++} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={key++} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        ),
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !isListItem(lines[i] ?? "") &&
      !isHeading(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(para.join(" "))}</p>);
  }

  return <div className={className ?? "space-y-2 leading-relaxed"}>{blocks}</div>;
}
