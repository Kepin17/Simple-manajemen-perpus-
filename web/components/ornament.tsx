import type { CSSProperties } from "react";

export type OrnamentKind = "seigaiha" | "kawung" | "parang" | "asanoha" | "megamendung" | "sakura";

// Aksen dekoratif: aria-hidden, tidak menggangu keterbacaan.
export function Ornament({
  kind,
  className = "",
  style,
}: {
  kind: OrnamentKind;
  className?: string;
  style?: CSSProperties;
}) {
  const single = kind === "sakura" ? " orn-single" : "";
  return <span aria-hidden="true" className={`ornament orn-${kind}${single} ${className}`} style={style} />;
}

// Latar tetap di belakang seluruh halaman, sangat samar.
export function BackdropOrnament() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Ornament kind="kawung" className="absolute inset-0 opacity-[0.06]" />
    </div>
  );
}
