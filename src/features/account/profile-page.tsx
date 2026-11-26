import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { Profile } from '@/api/contracts'
import { errorMessage, normalizeError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyApiError } from '@/features/auth/form-errors'
import { FormError } from '@/features/auth/components/form-error'
import { PasswordInput } from '@/features/auth/components/password-input'
import { centerFocusedField } from '@/lib/focus'
import { formSuccessToast } from '@/lib/form-toasts'
import { cn } from '@/lib/utils'

import { AccountLayout } from './components/account-layout'
import { AvatarField, type AvatarChange } from './components/avatar-field'
import { AccountLabel, EnsInput, accountFieldClass } from './components/fields'
import {
  profileChanged,
  profileDefaults,
  profileFormSchema,
  toProfileRequest,
  wantsPasswordChange,
  type ProfileFormValues,
} from './profile-form'
import {
  useChangePassword,
  useProfile,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from './queries'

const grid = 'grid gap-6 md:grid-cols-2 md:gap-x-7'

/** Tela "Perfil do colecionador" (frame desktop do Figma; mobile em uma coluna). */
export function ProfilePage() {
  const profile = useProfile()
  return (
    <AccountLayout current="profile" title="Meu perfil">
      <section aria-labelledby="profile-title" className="flex flex-col gap-8">
        <h1 id="profile-title" className="text-body-lg leading-4 font-bold text-foreground">
          Perfil do colecionador
        </h1>
        {profile.isPending ? (
          <ProfileSkeleton />
        ) : profile.isError ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
          >
            <p className="text-body-lg font-bold text-foreground">
              Não foi possível carregar o perfil.
            </p>
            <p className="text-body-sm text-destructive-foreground">
              {errorMessage(profile.error)}
            </p>
            <Button onClick={() => void profile.refetch()}>Tentar de novo</Button>
          </div>
        ) : (
          // A chave refaz o formulário quando o perfil muda de dono (troca de conta).
          <ProfileForm key={profile.data.id} profile={profile.data} />
        )}
      </section>
    </AccountLayout>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-hidden="true" data-profile-skeleton="" className="flex flex-col gap-6">
      <div className={grid}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
      <Skeleton className="size-[50px] rounded-full" />
    </div>
  )
}

const PROFILE_FIELDS = ['displayName', 'username', 'ensName'] as const
const PASSWORD_FIELDS = ['currentPassword', 'newPassword'] as const

function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const removeAvatar = useRemoveAvatar()
  const changePassword = useChangePassword()
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: 'keep' })
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileDefaults(profile),
  })

  /**
   * Um "Salvar", como no Figma: grava em sequência o que mudou (dados,
   * avatar, senha). Cada parte salva sai do "pendente"; se uma falha, o erro
   * vai para o campo dela e as seguintes esperam a próxima tentativa.
   */
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    // A recusa de um arquivo (ou uma falha anterior) não vale mais depois de salvar.
    setAvatarError(null)
    const saved: string[] = []
    const report = () => {
      if (saved.length) formSuccessToast(`${saved.join(' ')}`)
    }
    setSaving(true)
    try {
      let current = profile
      if (profileChanged(profile, values)) {
        try {
          current = await updateProfile.mutateAsync(toProfileRequest(values))
          form.reset({ ...profileDefaults(current), ...passwordValues(values) })
          saved.push('Dados do perfil salvos.')
        } catch (error) {
          setFormError(applyApiError(error, form.setError, PROFILE_FIELDS))
          return report()
        }
      }

      if (avatar.kind !== 'keep') {
        try {
          if (avatar.kind === 'new') await uploadAvatar.mutateAsync(avatar.file)
          else await removeAvatar.mutateAsync()
          saved.push(avatar.kind === 'new' ? 'Avatar atualizado.' : 'Avatar removido.')
          setAvatar({ kind: 'keep' })
        } catch (error) {
          const apiError = normalizeError(error)
          setAvatarError(apiError.fields.avatar ?? apiError.message)
          return report()
        }
      }

      if (wantsPasswordChange(values)) {
        try {
          await changePassword.mutateAsync({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          })
          form.resetField('currentPassword', { defaultValue: '' })
          form.resetField('newPassword', { defaultValue: '' })
          form.resetField('confirmPassword', { defaultValue: '' })
          saved.push('Senha alterada.')
        } catch (error) {
          setFormError(applyApiError(error, form.setError, PASSWORD_FIELDS))
          return report()
        }
      }

      if (saved.length) report()
      else toast.info('Não há alterações para salvar.')
    } finally {
      setSaving(false)
    }
  }, centerFocusedField)

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <div className={grid}>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem className="content-start gap-2.5">
                <AccountLabel required>Nome de exibição</AccountLabel>
                <FormControl>
                  <Input autoComplete="name" className={accountFieldClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem className="content-start gap-2.5">
                <AccountLabel required>Nome de usuário</AccountLabel>
                <FormControl>
                  <Input autoComplete="username" className={accountFieldClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid content-start gap-2.5">
            <label htmlFor="profile-email" className="text-[15px] leading-[29px] text-foreground">
              E-mail
            </label>
            <Input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              aria-describedby="profile-email-hint"
              className={cn(accountFieldClass, 'cursor-default text-muted-foreground')}
            />
            <p id="profile-email-hint" className="text-caption text-muted-foreground">
              O e-mail não pode ser alterado.
            </p>
          </div>
          <FormField
            control={form.control}
            name="ensName"
            render={({ field }) => (
              <FormItem className="content-start gap-2.5">
                <AccountLabel>Nome ENS</AccountLabel>
                <FormControl>
                  <EnsInput placeholder="seu-nome (opcional)" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <AvatarField
            currentUrl={profile.avatarUrl}
            change={avatar}
            onChange={setAvatar}
            error={avatarError}
            onError={setAvatarError}
            disabled={saving}
          />
        </div>

        <fieldset className="flex flex-col gap-6">
          <legend className="mb-6 text-body-lg leading-4 font-medium text-foreground">
            Alterar senha
          </legend>
          <p className="-mt-3 text-caption text-muted-foreground">
            Deixe em branco para manter a senha atual.
          </p>
          {(
            [
              ['currentPassword', 'Senha atual', 'current-password'],
              ['newPassword', 'Nova senha', 'new-password'],
              ['confirmPassword', 'Confirmar nova senha', 'new-password'],
            ] as const
          ).map(([name, label, autoComplete]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="content-start gap-3 md:max-w-[417px]">
                  <AccountLabel>{label}</AccountLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete={autoComplete}
                      className={accountFieldClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </fieldset>

        <FormError message={formError} />
        <Button
          type="submit"
          disabled={saving}
          className="h-10 w-full rounded-[3px] px-4 text-body-sm font-bold md:w-auto md:min-w-[131px]"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Form>
  )
}

const passwordValues = (values: ProfileFormValues) => ({
  currentPassword: values.currentPassword,
  newPassword: values.newPassword,
  confirmPassword: values.confirmPassword,
})
