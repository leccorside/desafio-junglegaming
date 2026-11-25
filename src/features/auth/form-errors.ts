import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { normalizeError } from '@/api/errors'

/**
 * Distribui o erro da API no formulário: cada `fields[campo]` vai para o
 * campo correspondente; o que não tem campo vira mensagem geral.
 * Devolve a mensagem geral (ou null se todos os erros tinham campo).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
): string | null {
  const apiError = normalizeError(error)
  let assigned = false
  for (const [field, message] of Object.entries(apiError.fields)) {
    if ((fieldNames as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !assigned })
      assigned = true
    }
  }
  return assigned ? null : apiError.message
}
