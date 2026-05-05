/* Tiny dependency-free markdown renderer.
   Supports: # / ## / ### headings, **bold**, *italic*, `inline code`,
   bulleted (- / *) and ordered (1.) lists, > blockquotes, [link](url),
   --- horizontal rules, fenced ```code``` blocks, and paragraphs.
   Not a full CommonMark impl — just enough for KB articles. */

function escape(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(s) {
  let html = escape(s);
  // Inline code first so its contents aren't reformatted
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  // Bold (** or __)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic (* or _) — single character, not part of bold
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return html;
}

export default function Markdown({ source = "" }) {
  const lines = (source || "").split(/\r?\n/);
  const blocks = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: `h${h[1].length}`, text: h[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*-{3,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote (one or more consecutive lines starting with >)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // Unordered list (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list (1.)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line → paragraph break
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|```|---)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }

  return (
    <div className="md">
      {blocks.map((b, idx) => {
        if (b.type === "h1")
          return (
            <h1 key={idx} className="md-h1" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
          );
        if (b.type === "h2")
          return (
            <h2 key={idx} className="md-h2" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
          );
        if (b.type === "h3")
          return (
            <h3 key={idx} className="md-h3" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
          );
        if (b.type === "hr") return <hr key={idx} className="md-hr" />;
        if (b.type === "quote")
          return (
            <blockquote
              key={idx}
              className="md-quote"
              dangerouslySetInnerHTML={{ __html: renderInline(b.text) }}
            />
          );
        if (b.type === "ul")
          return (
            <ul key={idx} className="md-ul">
              {b.items.map((it, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />
              ))}
            </ul>
          );
        if (b.type === "ol")
          return (
            <ol key={idx} className="md-ol">
              {b.items.map((it, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />
              ))}
            </ol>
          );
        if (b.type === "code")
          return (
            <pre key={idx} className="md-pre">
              <code>{b.text}</code>
            </pre>
          );
        return (
          <p key={idx} className="md-p" dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />
        );
      })}
    </div>
  );
}
