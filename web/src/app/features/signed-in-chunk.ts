// The one lazy entry point for everything behind sign-in: the shell with all its screens, and
// the admin tool. One chunk rather than two, because they share code (photo storage, the
// onboarding options), which would otherwise go in a third chunk that onboarding users fetch
// one round trip later. Members download the small admin tool too; its data stays protected by
// the database.
export { ShellComponent } from './shell/shell.component';
export { ADMIN_ROUTES } from './admin/admin.routes';
