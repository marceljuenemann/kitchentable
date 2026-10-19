// Markdown files are imported as plain strings (the `.md` loader in angular.json).
declare module '*.md' {
  const content: string;
  export default content;
}
