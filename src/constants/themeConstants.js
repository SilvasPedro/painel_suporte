import { Sun, Moon, Coffee } from 'lucide-react';

export const THEMES = {
  light: {
    id: 'light',
    name: 'Modo Claro',
    shortName: 'Claro',
    badge: 'Luminoso',
    description: 'Interface clara e vibrante, padrão ideal para ambientes bem iluminados com alto brilho e clareza.',
    icon: Sun,
    activeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    dotColor: 'bg-amber-400',
    swatchBg: '#f9fafb',
    swatchCard: '#ffffff',
    swatchBorder: '#e5e7eb',
    swatchText: '#111827'
  },
  warm: {
    id: 'warm',
    name: 'Modo Morno',
    shortName: 'Morno',
    badge: 'Equilíbrio & Conforto',
    description: 'O meio-termo perfeito entre o claro e o escuro. Tons acolhedores de sépia, linho e pedra que eliminam a fadiga ocular em longas jornadas.',
    icon: Coffee,
    activeColor: 'text-amber-700 bg-amber-600/15 border-amber-600/35',
    dotColor: 'bg-amber-600',
    swatchBg: '#dfd7ca',
    swatchCard: '#ede6dc',
    swatchBorder: '#cdbfae',
    swatchText: '#261f1c'
  },
  dark: {
    id: 'dark',
    name: 'Modo Escuro',
    shortName: 'Escuro',
    badge: 'Alto Contraste',
    description: 'Tons profundos de obsidiana e carvão em contraste total com tipografia ultra nítida. Máximo descanso ocular em ambientes noturnos.',
    icon: Moon,
    activeColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    dotColor: 'bg-red-500',
    swatchBg: '#09090b',
    swatchCard: '#121215',
    swatchBorder: '#27272a',
    swatchText: '#ffffff'
  }
};
