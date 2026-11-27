/**
 * `gcTime: 0` nas mutations que levam senha: a mutation (com as `variables`)
 * sai do cache do TanStack Query assim que o formulário desmonta, em vez de
 * ficar lá por 5 minutos. Enquanto o formulário está na tela, a senha fica na
 * memória dele, como no próprio campo.
 *
 * Módulo sem imports de propósito: login e cadastro (`features/auth`) e troca
 * de senha (`features/account`) usam a mesma opção sem uma feature importar a
 * outra. Quando `account/queries.ts` importava `auth/hooks.ts`, o Rolldown
 * refez a divisão dos chunks e a avaliação inicial da tela inicial ganhou uma
 * tarefa longa (TBT mobile de cerca de 210 para 275 ms no Lighthouse).
 */
export const SENSITIVE_MUTATION = { gcTime: 0 } as const
