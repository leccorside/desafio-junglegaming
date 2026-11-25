import { createFileRoute } from '@tanstack/react-router'

import { AuthScreen } from '@/features/auth/components/auth-screen'

export const Route = createFileRoute('/_guest/register')({
  component: function RegisterPage() {
    return <AuthScreen mode="register" />
  },
})
