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
    badge: 'Suave & Agradável',
    description: 'Paleta escura refinada em tons suaves de ardósia e grafite com iluminação equilibrada e descanso visual prolongado sem contrastes agressivos.',
    icon: Moon,
    activeColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    dotColor: 'bg-red-500',
    swatchBg: '#0f1115',
    swatchCard: '#181a20',
    swatchBorder: '#282b35',
    swatchText: '#e4e6ea'
  }
};
