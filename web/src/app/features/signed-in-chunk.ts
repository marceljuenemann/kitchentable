// The one lazy entry point for everything behind sign-in: the shell with all its screens, the
// main app's tabs, and the admin tool. One chunk rather than two, because they share code (photo
// storage, the onboarding options), which would otherwise go in a third chunk that onboarding
// users fetch one round trip later. Members download the small admin tool too; its data stays
// protected by the database. Once the main app grows big (browse, messaging, RxDB), it gets its
// own chunk, so onboarding users don't download it.
export { ShellComponent } from './shell/shell.component';
export { MAIN_ROUTES } from './main/main.routes';
export { ADMIN_ROUTES } from './admin/admin.routes';
