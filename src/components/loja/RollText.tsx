/**
 * Letras que rolam no hover (mesma técnica do menu do Siteflux): cada grafema
 * tem duas cópias empilhadas num recorte de uma linha. O conjunto animado é
 * aria-hidden; o nome acessível vem do texto oculto ao lado.
 */
const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("pt-BR", { granularity: "grapheme" }) : null;

function graphemes(text: string): string[] {
  return seg ? Array.from(seg.segment(text), (s) => s.segment) : Array.from(text);
}

export function RollText({ text }: { text: string }) {
  const chars = graphemes(text);
  // atraso por letra limitado a ~180 ms no total, para a saída não arrastar
  const step = Math.min(22, 180 / Math.max(1, chars.length));
  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="roll" aria-hidden="true">
        {chars.map((c, i) =>
          c === " " ? (
            <span key={i} className="roll-sp"> </span>
          ) : (
            <span key={i} className="roll-c">
              <span className="roll-t" style={{ "--d": `${Math.round(i * step)}ms` } as React.CSSProperties}>
                <span>{c}</span>
                <span>{c}</span>
              </span>
            </span>
          ),
        )}
      </span>
    </>
  );
}
