// iOS reports 'inactive' for Control Center, the app switcher, calls and system
// prompts. Only background stops device work; returning to active resumes it.
export function lifecycleChange(state: string): { foreground: boolean; active?: boolean } {
  if (state === 'active') return { foreground: true, active: true };
  if (state === 'background') return { foreground: false, active: false };
  return { foreground: false };
}
