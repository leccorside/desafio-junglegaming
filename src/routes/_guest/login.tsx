import { createFileRoute } from '@tanstack/react-router'

import { AuthScreen } from '@/features/auth/components/auth-screen'

export const Route = createFileRoute('/_guest/login')({
  component: function LoginPage() {
    return <AuthScreen mode="login" />
  },
})
