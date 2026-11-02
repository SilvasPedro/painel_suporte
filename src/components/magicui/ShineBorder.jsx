import React from "react";
import { cn } from "../../utils/cn";

/**
 * ShineBorder - Magic UI
 * Adiciona uma borda iluminada animada e elegante em torno de qualquer container.
 */
export function ShineBorder({
  children,
  borderWidth = 1.5,
  duration = 8,
  shineColor = ["#f43f5e", "#fb7185", "#e11d48"],
  className,
  style,
  ...props
}) {
  const colorString = Array.isArray(shineColor) ? shineColor.join(",") : shineColor;

  return (
    <div
      style={{
        ...style,
        position: "relative",
      }}
      className={cn("relative overflow-hidden rounded-2xl", className)}
      {...props}
    >
      <div
        style={{
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${colorString}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: `${borderWidth}px`,
        }}
        className="pointer-events-none absolute inset-0 size-full rounded-[inherit] animate-shimmer will-change-[background-position] z-10 opacity-70"
      />
      {children}
    </div>
  );
}

export default ShineBorder;
