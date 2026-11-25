import { useId, type ComponentType, type FormEvent } from 'react'
import { toast } from 'sonner'

import type { IconProps } from '@/components/icons/create-icon'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from '@/components/icons/figma-icons'

import { cn } from '@/lib/utils'

import { useBottomBar } from './bottom-bar'
import { footerColumns, footerFeatures, socialLinks } from './nav-config'
import { NavLink } from './nav-link'

const socialIcons: Record<(typeof socialLinks)[number]['label'], ComponentType<IconProps>> = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  Twitter: TwitterIcon,
  LinkedIn: LinkedinIcon,
  YouTube: YoutubeIcon,
}

/**
 * Footer do Figma (instância "Footer", 1200 × 610 px): faixa de destaques com
 * newsletter, faixa de contato e colunas de links, seguidas do copyright.
 */
export function SiteFooter() {
  const emailId = useId()
  // No mobile, entrar e criar conta ocupam a tela inteira, sem footer (Figma).
  // Nas outras telas o footer termina acima da barra fixa da base.
  const bottomBar = useBottomBar()

  // Newsletter está fora do escopo: o envio avisa que não há cadastro, sem simular sucesso.
  const handleNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    toast.info('A newsletter não está disponível nesta demonstração.')
  }

  return (
    <footer
      className={cn(
        'mx-auto mt-24 w-full max-w-content px-6 md:pb-6 xl:px-0',
        bottomBar === 'none' && 'hidden md:block',
        bottomBar === 'tabs' && 'pb-[150px]',
        bottomBar === 'buy' && 'pb-[188px]',
      )}
    >
      <div className="bg-card p-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
          {footerFeatures.map((feature) => (
            <section
              key={feature.mark}
              className="flex flex-col gap-3 lg:border-r lg:border-primary lg:px-4 lg:first:pl-4"
            >
              <span
                aria-hidden="true"
                className="flex size-[74px] items-center justify-center rounded-full bg-primary text-h2 font-bold text-primary-foreground"
              >
                {feature.mark}
              </span>
              <h2 className="text-[17px] leading-4 font-bold text-foreground">{feature.title}</h2>
              <p className="max-w-[204px] text-body-sm text-muted-foreground">{feature.text}</p>
            </section>
          ))}

          <section className="flex flex-col gap-3 lg:pl-4">
            <h2 className="text-lead leading-4 font-bold text-foreground">
              Antecipe-se ao próximo lançamento
            </h2>
            <form
              onSubmit={handleNewsletter}
              className="mt-1 flex h-10 items-center overflow-hidden rounded-md bg-accent"
            >
              <label htmlFor={emailId} className="sr-only">
                E-mail para a newsletter
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                placeholder="digite seu e-mail..."
                className="h-full min-w-0 flex-1 bg-transparent pl-3 text-body-sm text-foreground placeholder:text-secondary focus-visible:outline-offset-[-2px]"
              />
              <button
                type="submit"
                className="h-full cursor-pointer bg-primary px-4 text-lead font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Enviar
              </button>
            </form>
            <p className="text-caption leading-[22px] text-muted-foreground">
              Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
            </p>
          </section>
        </div>
      </div>

      <div className="grid gap-4 bg-accent p-8 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
        <span className="text-body-sm font-bold text-foreground">KURIO</span>
        <p className="text-body-sm text-foreground">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a
          href="mailto:contato@email.com"
          className="text-body-sm text-foreground hover:text-accent-foreground"
        >
          contato@email.com
        </a>
        <a
          href="tel:+551140028922"
          className="text-body-sm text-foreground hover:text-accent-foreground"
        >
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-card p-8 sm:grid-cols-2 lg:grid-cols-4">
        {footerColumns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
            <h2 className="text-lead leading-4 font-bold text-foreground">{column.title}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.label}>
                  <NavLink
                    item={link}
                    className="block text-body-sm leading-[30px] text-foreground hover:text-accent-foreground"
                  />
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-5">
            <h2 className="text-lead leading-4 font-bold text-foreground">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {socialLinks.map(({ label, href }) => {
                const Icon = socialIcons[label]
                return (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (abre em nova aba)`}
                      className="flex size-[30px] items-center justify-center rounded-sm border border-primary text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Icon size={16} />
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lead leading-4 font-bold text-foreground">Carteiras compatíveis</h2>
            <p className="w-fit rounded-md border border-border-soft bg-accent px-2.5 py-2 text-[9px] leading-3 font-bold tracking-[0.01em] text-accent-foreground">
              METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
            </p>
          </section>
        </div>
      </div>

      <p className="py-1.5 text-center text-body-sm leading-[30px] text-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}
