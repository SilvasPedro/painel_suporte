import React from "react";
import { cn } from "../../utils/cn";

/**
 * AnimatedShinyText - Magic UI
 * Texto com efeito de brilho metálico contínuo deslizando sobre as palavras.
 */
export const AnimatedShinyText = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={{
        "--shiny-width": `${shimmerWidth}px`,
      }}
      className={cn(
        "inline-flex items-center text-rose-500/90 dark:text-rose-400 font-semibold",
        "animate-shimmer bg-clip-text [background-size:200%_100%] [transition:background-position_1s_ease]",
        "bg-gradient-to-r from-transparent via-rose-500/80 via-50% to-transparent dark:via-rose-300",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default AnimatedShinyText;
