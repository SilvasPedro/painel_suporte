import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

/**
 * BorderBeam - Magic UI
 * Feixe de luz que percorre o perímetro de um card ou elemento.
 */
export const BorderBeam = ({
  className,
  size = 200,
  duration = 10,
  delay = 0,
  colorFrom = "#f43f5e",
  colorTo = "#fb7185",
  borderWidth = 1.5,
  anchor = 90,
}) => {
  return (
    <div
      style={{
        "--border-width": `${borderWidth}px`,
      }}
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.div
        className={cn(
          "absolute aspect-square bg-gradient-to-l from-rose-500 via-red-500 to-transparent",
          className
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round 16px)`,
        }}
        animate={{
          offsetDistance: ["0%", "100%"],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay,
        }}
      />
    </div>
  );
};

export default BorderBeam;
