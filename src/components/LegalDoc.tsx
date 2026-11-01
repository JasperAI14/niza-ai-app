import { Link } from "@tanstack/react-router";
import { PRIVACY_SECTIONS, PRIVACY_UPDATED, TERMS_SECTIONS, TERMS_UPDATED, type LegalSection } from "@/lib/legal-content";

/** Renders the shared legal sections; used by the public pages and the in-app privacy screen. */
export function LegalBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {s.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc space-y-1 pl-5">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PrivacyBody() {
  return (
    <>
      <p className="text-xs text-muted-foreground">Last updated: {PRIVACY_UPDATED}</p>
      <LegalBody sections={PRIVACY_SECTIONS} />
      <p className="text-sm text-muted-foreground">
        See also our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
      </p>
    </>
  );
}

export function TermsBody() {
  return (
    <>
      <p className="text-xs text-muted-foreground">Last updated: {TERMS_UPDATED}</p>
      <LegalBody sections={TERMS_SECTIONS} />
      <p className="text-sm text-muted-foreground">
        See also our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
      </p>
    </>
  );
}
