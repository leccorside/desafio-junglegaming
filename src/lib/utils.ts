import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * O tailwind-merge precisa conhecer os tokens customizados do tema
 * (src/index.css). Sem isso, `text-body-sm` seria tratado como cor de texto e
 * descartado ao lado de `text-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'display-sm',
        'h1',
        'h2',
        'title',
        'title-sm',
        'lead',
        'body-lg',
        'body',
        'body-sm',
        'caption',
        'caption-sm',
        'tiny',
      ],
      radius: ['control'],
      shadow: ['top'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
