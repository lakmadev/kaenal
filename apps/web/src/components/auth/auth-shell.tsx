import Link from "next/link";

/**
 * The auth two-column shell (matches `src/auth.jsx`): an ink-mono form column on
 * the left (brand header, the stage content as `children`, footer) and the blue
 * gradient marketing panel on the right. The right panel is hidden below `lg`,
 * where the form takes the full width.
 *
 * The marketing copy/stats/testimonial are static design content, ported
 * verbatim from the visual spec.
 */
export function AuthShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-2">
      {/* Left: form column */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        {/* Brand */}
        <div className="mb-12 flex items-center gap-2.5 lg:mb-16">
          <span style={{ color: "var(--accent)" }}>
            <Logo size={26} />
          </span>
          <span className="text-[16px] font-bold" style={{ letterSpacing: "0.08em" }}>
            KAENAL
          </span>
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted"
            style={{ background: "var(--bg-subtle)" }}
          >
            Quality · Safety · Compliance
          </span>
        </div>

        {/* Stage content */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-[11px]" style={{ color: "var(--text-subtle)" }}>
          <span>© 2026 Kaenal Inc.</span>
          <div className="flex gap-3.5">
            <Link href="/sign-in" className="k-link">
              Privacy
            </Link>
            <Link href="/sign-in" className="k-link">
              Terms
            </Link>
            <Link href="/sign-in" className="k-link">
              Status
            </Link>
          </div>
        </div>
      </div>

      {/* Right: marketing panel */}
      <div
        className="relative hidden overflow-hidden text-white lg:block"
        style={{ background: "linear-gradient(135deg, #0f1d35 0%, #1e3a8a 60%, #312e81 100%)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.18,
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-14">
          <div className="mt-14">
            <div
              className="mb-6 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              AI-driven · Powered by Anthropic
            </div>
            <h2 className="mb-4 text-[40px] font-bold leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
              The quality
              <br />
              copilot for
              <br />
              <span style={{ color: "#93c5fd" }}>modern factories.</span>
            </h2>
            <p className="max-w-[420px] text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              Inspections, NCRs, and 8D — connected end-to-end with AI root-cause analysis and SPC monitoring.
              Trusted by 200+ plants across 14 countries.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { v: "47%", l: "Faster issue closure" },
              { v: "$2.1M", l: "Avg. annual scrap savings" },
              { v: "IATF 16949", l: "Audit-ready out of the box" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-[22px] font-bold" style={{ color: "#bfdbfe" }}>
                  {s.v}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mb-2 rounded-xl p-[18px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
              &ldquo;We closed our IATF surveillance audit with zero findings. Kaenal&rsquo;s evidence trail saved
              us six weeks of prep.&rdquo;
            </div>
            <div className="mt-3.5 flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
                style={{ background: "#dc2626" }}
              >
                RM
              </div>
              <div>
                <div className="text-[12px] font-semibold">Ramesh Mehta</div>
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Quality Director, Precision Auto Components
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Logo({ size = 26 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12 L12 3 L21 12 L12 21 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" />
      <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
    </svg>
  );
}
