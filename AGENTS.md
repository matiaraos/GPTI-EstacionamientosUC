# MiEstacionamientoUC

- Para implementar una feature del MVP, abre [el índice de specs](docs/specs/README.md), identifica el tramo y sigue [implementar-spec](.agents/skills/implementar-spec/SKILL.md).
- Para cambios móviles, lee primero `expo-overview`. Usa `expo-router` para navegación y `expo-data-fetching` para red. Si hay una decisión visual, usa `ui-ux-pro-max` para la dirección, `expo-native-ui` para los patrones nativos y `expo-design-system` para el tema y los componentes compartidos. Comprueba la compatibilidad con el SDK instalado antes de elegir una API.
- Usa `prisma-cli` para migraciones y generación, `prisma-client-api` para consultas y transacciones, y `supabase-postgres-best-practices` antes de cambiar el esquema o escribir SQL. Para cambios del panel, usa `vercel-react-best-practices`.
- Las skills están en `.agents/skills`. Carga las que correspondan al cambio y sus referencias pertinentes.
