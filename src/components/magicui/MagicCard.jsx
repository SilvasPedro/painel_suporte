import React, { useRef, useState } from "react";
import { cn } from "../../utils/cn";

/**
 * MagicCard - Magic UI
 * Card moderno com efeito spotlight radial que reage dinamicamente à posição do mouse.
 */
export function MagicCard({
  children,
  className,
  gradientColor = "rgba(244, 63, 94, 0.12)",
  gradientSize = 250,
  onClick,
  ...props
}) {
  const cardRef = useRef(null);
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface border border-subtle transition-all duration-200",
        className
      )}
      {...props}
    >
      {/* Luz Spotlight Reativa ao Mouse */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${gradientSize}px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
}

export default MagicCard;
