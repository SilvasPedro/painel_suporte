import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina nomes de classes CSS utilizando clsx e tailwind-merge,
 * resolvendo conflitos de utilitários Tailwind de forma elegante.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
