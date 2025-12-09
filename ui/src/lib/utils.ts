import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getModelColor(model: string): string {
  // Vibrant Tones Palette
  const colors = [
    '#f94144', // Strawberry Red
    '#f3722c', // Pumpkin Spice
    '#f8961e', // Carrot Orange
    '#f9844a', // Atomic Tangerine
    '#f9c74f', // Tuscan Sun
    '#90be6d', // Willow Green
    '#43aa8b', // Seaweed
    '#4d908e', // Dark Cyan
    '#577590', // Blue Slate
    '#277da1', // Cerulean
  ];

  // FNV-1a hash algorithm
  let hash = 0x811c9dc5;
  for (let i = 0; i < model.length; i++) {
    hash ^= model.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Ensure positive index
  return colors[(hash >>> 0) % colors.length];
}
