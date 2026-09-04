type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  subtitle?: string;
};

/** The official grey Niza Prime AI mark. Never recolored or redrawn. */
export function BrandLogo({ size = 32, withWordmark = false, className = "", subtitle }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/niza-logo-mark.png"
        alt="Niza Prime AI"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
        loading="eager"
        decoding="async"
      />
      {withWordmark && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold tracking-tight">Niza Prime AI</span>
          {subtitle && <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
