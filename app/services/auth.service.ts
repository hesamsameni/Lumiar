export function useAuthService() {
  const supabase = useSupabaseClient()

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  }

  async function signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signInWithMagicLink(email: string, emailRedirectTo: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
  }

  async function signInWithGoogle(redirectTo: string) {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  async function signUpWithPassword(email: string, password: string, emailRedirectTo: string) {
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    })
  }

  async function resetPasswordForEmail(email: string, redirectTo: string) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo })
  }

  async function updatePassword(password: string) {
    return supabase.auth.updateUser({ password })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  return {
    getCurrentUser,
    signInWithPassword,
    signInWithMagicLink,
    signInWithGoogle,
    signUpWithPassword,
    resetPasswordForEmail,
    updatePassword,
    signOut,
  }
}
