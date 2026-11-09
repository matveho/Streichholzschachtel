export type DocId = string
// PDF points measured from the top-left of each original 612 × 792 pt page.
export type Reference = {
  id: string
  doc: DocId
  page: number
  label: string
  rect: [number, number, number, number]
  regions?: [number, number, number, number][]
  excerpt?: string
}
