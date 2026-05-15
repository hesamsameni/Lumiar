export default defineNuxtRouteMiddleware(() => {
  const { profile } = useProfile();

  if (!profile.value?.is_admin) {
    return navigateTo("/");
  }
});
