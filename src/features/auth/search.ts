import { z } from 'zod'

/**
 * Search params das telas de entrada: para onde voltar depois do login e
 * por que a pessoa chegou aqui. O `redirect` é filtrado por `safeRedirect`
 * antes de ser usado.
 */
export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>
