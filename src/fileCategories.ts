export const categoryLabels: Record<string, string> = {
  reference: 'Reference documents',
  client: 'Client requirements',
  design: 'Design documents & drawings',
  report: 'Technical reports',
  supporting: 'Supporting materials',
}

// Older API versions derive the category from the filename.
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

export function saveFileCategories(
  projectId: string,
  changes: Record<string, string>,
) {
  if (Object.keys(changes).length) {
    localStorage.setItem(
      key(projectId),
      JSON.stringify({ ...readFileCategories(projectId), ...changes }),
    )
  }
}
