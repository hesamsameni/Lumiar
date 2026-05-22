export default defineNuxtPlugin(() => {
  const route = useRoute();
  const router = useRouter();

  const refCookie = useCookie("lumiar_ref", {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    path: "/",
  });

  function captureRef() {
    const code = route.query.ref as string | undefined;
    if (code && code.length >= 6 && code.length <= 16) {
      refCookie.value = code;
    }
  }

  captureRef();
  router.afterEach(() => captureRef());
});
