import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import {
  loginRequestSchema,
  registerFormSchema,
  type LoginRequest,
  type RegisterForm,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { useLoginMutation, useRegisterMutation } from '../hooks'
import { safeRedirect } from '../redirect'
import type { AuthSearch } from '../search'
import { applyApiError } from '../form-errors'
import { FormError } from './form-error'
import { PasswordInput } from './password-input'

/** Medidas do Figma: campos 40 px/raio 5 no modal desktop, 50 px/raio 10 no mobile. */
const fieldClass = 'h-[50px] rounded-[10px] md:h-10 md:rounded-control'
const submitClass = 'h-[60px] w-full rounded-[10px] font-bold md:h-[45px] md:rounded-control'

interface AuthFormProps {
  search: AuthSearch
}

/** Depois de entrar: volta para onde a pessoa estava (só caminhos internos). */
function useAfterAuth(search: AuthSearch) {
  const navigate = useNavigate()
  return () => navigate({ href: safeRedirect(search.redirect), replace: true })
}

export function LoginForm({ search }: AuthFormProps) {
  const login = useLoginMutation()
  const afterAuth = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const session = await login.mutateAsync(values)
      toast.success(`Que bom ver você, ${session.user.displayName}.`)
      await afterAuth()
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['email', 'password']))
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="contato@email.com"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Senha</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="Senha"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="button"
          aria-disabled="true"
          onClick={() =>
            toast.info('A recuperação de senha não está disponível nesta demonstração.', {
              id: 'unavailable:password-recovery',
            })
          }
          className="self-end text-body-sm text-accent-foreground hover:underline"
        >
          Esqueceu a senha?
          {/* Como os outros itens fora do escopo: o leitor de tela ouve que não funciona. */}
          <span className="sr-only"> (indisponível nesta demonstração)</span>
        </button>
        <FormError message={formError} />
        <Button
          type="submit"
          size="lg"
          disabled={login.isPending}
          className={cn(submitClass, 'mt-3')}
        >
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </Form>
  )
}

export function RegisterForm({ search }: AuthFormProps) {
  const register = useRegisterMutation()
  const afterAuth = useAfterAuth(search)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setFormError(null)
    try {
      await register.mutateAsync(values)
      toast.success('Conta criada. Boas-vindas à Kurio!')
      await afterAuth()
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['username', 'email', 'password']))
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Nome de usuário</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  placeholder="Nome de usuário"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="Digite seu e-mail"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Senha</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="Senha"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Confirmar senha</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="Confirmar senha"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormError message={formError} />
        <Button
          type="submit"
          size="lg"
          disabled={register.isPending}
          className={cn(submitClass, 'mt-3')}
        >
          {register.isPending ? (
            'Criando conta…'
          ) : (
            <>
              <span className="md:hidden">Criar perfil</span>
              <span className="hidden md:inline">Criar conta</span>
            </>
          )}
        </Button>
      </form>
    </Form>
  )
}

/** Abas "Entrar | Criar conta" do modal desktop, mantendo o destino de volta. */
export function AuthTabs({ mode, search }: { mode: 'login' | 'register'; search: AuthSearch }) {
  const tabClass = (active: boolean) =>
    cn(
      'text-title-sm font-medium',
      active ? 'text-accent-foreground' : 'text-foreground hover:text-accent-foreground',
    )
  return (
    <nav aria-label="Acesso à conta" className="flex items-center gap-2">
      <Link to="/login" search={search} replace className={tabClass(mode === 'login')}>
        Entrar
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-highlight" />
      <Link to="/register" search={search} replace className={tabClass(mode === 'register')}>
        Criar conta
      </Link>
    </nav>
  )
}
