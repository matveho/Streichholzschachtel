export const categoryLabels: Record<string, string> = {
  reference: 'Reference documents',
  client: 'Client requirements',
  design: 'Design documents & drawings',
  report: 'Technical reports',
  supporting: 'Supporting materials',
}

// Import choices saved by the browser-only editor when the user saves Manage project.
const key = (projectId: string) => 'basis.fileCategories.v1:' + projectId

export function readFileCategories(projectId: string): Record<string, string> {
  try {
    const stored = JSON.parse(localStorage.getItem(key(projectId)) || '{}')
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, category]) =>
          typeof category === 'string' &&
          Object.hasOwn(categoryLabels, category),
      ),
    ) as Record<string, string>
  } catch {
    return {}
  }
}

export function clearLegacyCategories(projectId: string) {
  localStorage.removeItem(key(projectId))
}
