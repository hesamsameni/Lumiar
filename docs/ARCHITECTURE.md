# Project Architecture & Best Practices

## Folder Structure

- `components/` — Reusable UI components (no business logic or API calls)
- `composables/` — State management and orchestration (no direct API/database calls)
- `services/` — All API/database logic (Supabase, HTTP, etc.)
- `pages/` — Route-based views, should only use composables/services
- `utils/` — Utility functions and constants
- `types/` — TypeScript types and interfaces

## Best Practices

- **No direct Supabase or API calls in components/pages/composables.**
- **All business logic and data access must go through services.**
- **Composables orchestrate state and call services, but do not access Supabase directly.**
- **Components are presentational and receive data/state via props or composables.**
- **User/session state is provided via a single composable (`useProfile`).**
- **Sensitive operations (e.g., token deduction) are validated in the service layer and protected by Supabase RLS.**
- **Naming conventions:**
  - Composables: `useX`
  - Services: `x.service.ts`

## Security

- Ensure Supabase Row Level Security (RLS) is enabled and properly configured for all tables.
- Never expose secrets or sensitive data in the frontend code.
- Validate user permissions in all service methods that mutate data.

---

For more details, see the code comments in each folder.
