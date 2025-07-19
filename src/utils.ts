export function cleanGameTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}
