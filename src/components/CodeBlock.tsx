import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Play, Maximize2, X, Code2 } from "lucide-react";
import { toast } from "sonner";

const PREVIEWABLE = new Set(["html", "htm", "css", "svg", "javascript", "js", "jsx", "xml"]);

export function isPreviewable(lang?: string) {
  return !!lang && PREVIEWABLE.has(lang.toLowerCase());
}

/** Build a sandboxed document for the inline preview. */
export function buildSrcDoc(code: string, lang: string): string {
  const l = lang.toLowerCase();
  const shell = (body: string, head = "") => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{color-scheme:dark}
  html,body{margin:0;padding:12px;background:#141414;color:#eaeaea;
    font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
  #__out{white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
  #__out div{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.07)}
</style>${head}</head><body>${body}</body></html>`;

  if (l === "html" || l === "htm") return code;
  if (l === "svg" || l === "xml") return shell(code);
  if (l === "css") {
    return shell(
      `<h1>Heading</h1><p>Paragraph text for preview.</p>
       <button class="btn">Button</button>
       <div class="box card">Box</div>`,
      `<style>${code}</style>`,
    );
  }
  // js / jsx — run it and mirror console output.
  return shell(
    `<div id="__out"></div>
<script>
  (function(){
    var out=document.getElementById('__out');
    function w(kind,args){var d=document.createElement('div');
      d.textContent=(kind==='error'?'⚠ ':'')+Array.from(args).map(function(a){
        try{return typeof a==='string'?a:JSON.stringify(a);}catch(e){return String(a);}}).join(' ');
      if(kind==='error')d.style.color='#ff8080';out.appendChild(d);}
    console.log=function(){w('log',arguments)};
    console.warn=function(){w('log',arguments)};
    console.error=function(){w('error',arguments)};
    window.onerror=function(m){w('error',[m])};
    try{ ${l === "jsx" ? "/* JSX is shown as source only */" : code} }catch(e){w('error',[e && e.message||e])}
    if(!out.childNodes.length){out.textContent='(no console output)';out.style.opacity='.6';}
  })();
<\/script>`,
  );
}

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [full, setFull] = useState(false);
  const canPreview = isPreviewable(lang) && lang.toLowerCase() !== "jsx";
  const srcDoc = useMemo(() => (preview || full ? buildSrcDoc(code, lang) : ""), [preview, full, code, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  }

  return (
    <>
      <div className="not-prose my-2 overflow-hidden rounded-xl border border-border bg-[#1a1a1a]">
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-1.5">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {lang || "code"}
          </span>
          {canPreview && (
            <button
              onClick={() => setPreview((p) => !p)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <Play className="h-3 w-3" /> {preview ? "Hide" : "Preview"}
            </button>
          )}
          {canPreview && (
            <button
              onClick={() => setFull(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label="Full screen preview"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            style={oneDark as any}
            language={lang || "text"}
            PreTag="div"
            customStyle={{ margin: 0, borderRadius: 0, background: "transparent", fontSize: 13 }}
          >
            {code.replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
        {preview && (
          <div className="border-t border-white/10">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Live preview</div>
            <iframe
              title="Code preview"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className="h-64 w-full border-0 bg-[#141414]"
            />
          </div>
        )}
      </div>

      {full && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="flex-1 text-sm font-semibold">Live preview</span>
            <button
              onClick={() => setFull(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe title="Full screen preview" sandbox="allow-scripts" srcDoc={srcDoc} className="flex-1 border-0 bg-white" />
        </div>
      )}
    </>
  );
}
