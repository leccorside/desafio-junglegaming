import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { HomePage } from '@/features/catalog/home-page'
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query'

import { AuthTabs, LoginForm, RegisterForm } from './auth-forms'
import { SocialSignIn } from './social-sign-in'

type Mode = 'login' | 'register'

const COPY: Record<Mode, { title: string; mobileTitle: string; description: string }> = {
  login: {
    title: 'Entrar',
    mobileTitle: 'Entrar',
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
  },
  register: {
    title: 'Criar conta',
    mobileTitle: 'Criar perfil de colecionador',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
  },
}

function ExpiredNotice() {
  return (
    <p
      role="status"
      className="rounded-control border border-warning/50 bg-accent px-3 py-2 text-body-sm text-warning"
    >
      Sua sessão expirou. Entre de novo para continuar de onde parou.
    </p>
  )
}

/**
 * Entrar e criar conta. Desktop: modal de 500 px sobre a tela inicial, com
 * abas e faixa Primary na base (frames "Sign In/Up Modal"). Mobile: tela
 * cheia com o logo grande (frames "Mobile / Login" e "Mobile / Cadastro").
 */
export function AuthScreen({ mode }: { mode: Mode }) {
  const search = useSearch({ from: '/_guest' })
  const navigate = useNavigate()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const copy = COPY[mode]
  const Form = mode === 'login' ? LoginForm : RegisterForm
  const expired = search.reason === 'expired'

  if (isDesktop) {
    return (
      <>
        <HomePage />
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) void navigate({ to: '/', replace: true })
          }}
        >
          <DialogContent
            showCloseButton={false}
            // Foco inicial no primeiro campo (o Radix focaria o botão de fechar).
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              const target = event.currentTarget as HTMLElement | null
              target?.querySelector<HTMLInputElement>('input')?.focus()
            }}
            className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-lg border-none bg-card p-0 sm:max-w-[500px]"
          >
            <DialogClose
              aria-label="Fechar"
              className="absolute top-[11px] right-[11px] flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-accent"
            >
              <XIcon className="size-[18px]" />
            </DialogClose>
            <div className="flex flex-col gap-10 px-12 pt-12">
              <div className="flex flex-col items-center gap-10">
                <AuthTabs mode={mode} search={search} />
                <DialogTitle className="sr-only">{copy.title}</DialogTitle>
                <DialogDescription className="text-center text-caption text-foreground">
                  {copy.description}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col gap-6 px-20 pt-6 pb-[57px]">
              {expired ? <ExpiredNotice /> : null}
              <Form search={search} />
              <SocialSignIn />
            </div>
            <div aria-hidden="true" className="h-2.5 bg-primary" />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <section
      aria-labelledby="auth-title"
      className="mx-auto flex max-w-[414px] flex-col px-7 pt-20 pb-10"
    >
      <div className="flex h-[136px] items-center justify-center">
        <Link to="/" className="text-display-sm font-bold tracking-normal text-foreground">
          KURIO
          <span className="sr-only"> (página inicial)</span>
        </Link>
      </div>
      <h1 id="auth-title" className="mt-10 text-center text-title-sm font-bold text-foreground">
        {copy.mobileTitle}
      </h1>
      <p className="sr-only">{copy.description}</p>
      <div className="mt-10 flex flex-col gap-10">
        {expired ? <ExpiredNotice /> : null}
        <Form search={search} />
        <SocialSignIn />
        <p className="text-center text-body text-muted-foreground">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link
                to="/register"
                search={search}
                replace
                className="text-accent-foreground hover:underline"
              >
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <Link
                to="/login"
                search={search}
                replace
                className="text-accent-foreground hover:underline"
              >
                Entre
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  )
}
