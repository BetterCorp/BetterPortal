/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";

function inlineText(text: string): HtmlRenderable {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return (
    <>
      {parts.map((part) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}

function tableBlock(lines: string[]): HtmlRenderable {
  const rows = lines
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter((cell) => cell.length > 0));
  const header = rows[0] ?? [];
  const body = rows.slice(2);

  return (
    <div class="table-responsive my-4 border rounded-2 overflow-hidden">
      <table class="table table-sm table-hover align-middle mb-0">
        <thead>
          <tr>{header.map((cell) => <th>{inlineText(cell)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr>{row.map((cell) => <td>{inlineText(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function listBlock(lines: string[]): HtmlRenderable {
  return (
    <ul class="mb-4 ps-3">
      {lines.map((line) => (
        <li>{inlineText(line.replace(/^-\s+/, ""))}</li>
      ))}
    </ul>
  );
}

export function renderMarkdown(markdown: string): HtmlRenderable {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: HtmlRenderable[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p>{inlineText(paragraph.join(" "))}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(listBlock(list));
    list = [];
  };

  const flushTable = () => {
    if (table.length === 0) return;
    blocks.push(tableBlock(table));
    table = [];
  };

  const flushCode = () => {
    if (code.length === 0) return;
    blocks.push(<pre class="bg-dark text-light border rounded-2 p-3 overflow-auto shadow-sm"><code>{code.join("\n")}</code></pre>);
    code = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(<h1 class="h2 mb-3 pb-3 border-bottom">{inlineText(line.replace(/^#\s+/, ""))}</h1>);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(<h2 class="h4 mt-4 mb-3">{inlineText(line.replace(/^##\s+/, ""))}</h2>);
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(<h3 class="h5 mt-4 mb-2">{inlineText(line.replace(/^###\s+/, ""))}</h3>);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      flushTable();
      list.push(line);
      continue;
    }

    if (line.includes("|") && line.trim().startsWith("|")) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }

    flushList();
    flushTable();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();
  flushCode();

  return <>{blocks}</>;
}
