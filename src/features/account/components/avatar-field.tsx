import { useEffect, useId, useRef } from 'react'

import { AVATAR_MIME_TYPES, avatarFileSchema } from '@/api/contracts'
import { ImageIcon } from '@/components/icons/figma-icons'
import { cn } from '@/lib/utils'

/** O que o "Salvar" fará com o avatar. */
export type AvatarChange =
  { kind: 'keep' } | { kind: 'new'; file: File; previewUrl: string } | { kind: 'remove' }

/**
 * Avatar do Figma ("Avatar Controls"): círculo de 50 px, "Alterar" (abre o
 * seletor de arquivo) e "Remover". A imagem escolhida aparece na hora
 * (prévia) e só vai para a API no "Salvar". Tipo e tamanho são conferidos
 * antes, com as mesmas regras da API (`avatarFileSchema`).
 */
export function AvatarField({
  currentUrl,
  change,
  onChange,
  error,
  onError,
  disabled,
}: {
  currentUrl: string | null
  change: AvatarChange
  onChange: (change: AvatarChange) => void
  error: string | null
  onError: (message: string | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const errorId = useId()
  const hintId = useId()
  const shownUrl =
    change.kind === 'new' ? change.previewUrl : change.kind === 'remove' ? null : currentUrl

  // A URL da prévia é liberada quando sai da tela (troca de arquivo ou saída).
  const previewUrl = change.kind === 'new' ? change.previewUrl : null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const pick = (file: File | undefined) => {
    if (!file) return
    const valid = avatarFileSchema.safeParse(file)
    if (!valid.success) {
      onError(valid.error.issues[0]?.message ?? 'Imagem inválida.')
      return
    }
    onError(null)
    onChange({ kind: 'new', file, previewUrl: URL.createObjectURL(file) })
  }

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2.5">
      <span id={labelId} className="text-[15px] leading-[15px] text-foreground">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <span
          className="flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-popover"
          data-avatar-preview={change.kind}
        >
          {shownUrl ? (
            <img
              src={shownUrl}
              alt={change.kind === 'new' ? 'Prévia do novo avatar' : 'Avatar atual'}
              width={50}
              height={50}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon size={24} className="text-primary" />
          )}
        </span>
        <div className="flex items-center gap-5">
          <button
            type="button"
            disabled={disabled}
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
            className="h-10 w-[98px] cursor-pointer rounded-[3px] bg-primary text-body-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Alterar
            <span className="sr-only"> avatar</span>
          </button>
          <button
            type="button"
            disabled={disabled || !shownUrl}
            onClick={() => {
              onError(null)
              onChange(currentUrl ? { kind: 'remove' } : { kind: 'keep' })
            }}
            className="h-10 cursor-pointer text-body-sm text-foreground transition-colors hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remover
            <span className="sr-only"> avatar</span>
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_MIME_TYPES.join(',')}
        aria-label="Escolher imagem do avatar"
        tabIndex={-1}
        className="sr-only"
        data-avatar-input=""
        onChange={(event) => {
          pick(event.target.files?.[0])
          // Escolher o mesmo arquivo de novo dispara o change.
          event.target.value = ''
        }}
      />
      <p id={hintId} className="text-caption text-muted-foreground">
        {change.kind === 'new'
          ? 'Nova imagem escolhida: será enviada ao salvar.'
          : change.kind === 'remove'
            ? 'O avatar será removido ao salvar.'
            : 'PNG, JPEG ou WebP, até 2 MB.'}
      </p>
      {error ? (
        <p id={errorId} role="alert" className={cn('text-sm text-destructive-foreground')}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
