import {capacityReviewInputs} from '../src/capacity-review-inputs.mjs'

// Curated source-backed worked reviews, not stored answer text. Numerical
// results and original source quotations are resolved at request time.
export const demoReviews = [{
  id: 'catchment-capacity-and-storage',
  projectId: 'demo-mill-creek',
  title: 'Catchment expansion and pond design',
  question: 'A subdivision has expanded from 28 ha to 42 ha. The revised five-year runoff estimate is 1.20 m³/s, but the existing sewer design carries 0.90 m³/s. Can we retain it and size the new detention pond with the Rational Method?',
  requiredDocumentIds: ['doc-09e07f57e7a3','doc-eb651c8aa7d3'],
  documentIds: ['doc-09e07f57e7a3','doc-eb651c8aa7d3'],
  basisDocumentId:'doc-09e07f57e7a3',
  methodDocumentId:'doc-eb651c8aa7d3',
  searches: [
    {heading:'Sewer capacity assessment',query:'storm sewer capacity requirement catchment areas design flow five-year runoff',sections:[]},
    {heading:'Detention pond design method',query:'stormwater management storage facilities design computer modelling analytical methods Rational Method',sections:[]},
    {heading:'Storage performance criteria',query:'stormwater management storage facilities critical design storm storage volume drawdown requirements',sections:[]},
  ],
}]

export const demoStories = [
  {id:'box-planter-width',projectId:'demo-mill-creek',title:'Cross-document width discrepancy',question:'Compare the minimum box planter width required by the standards with the width proposed in this project. Identify any difference and cite both documents.'},
  // Retain the issued-record review baseline; supplemental option studies are separate exploratory sources.
  {id:'storm-main-cover',projectId:'parkview-exchange',documentIds:["doc-ad1aa8236ea0","doc-9f6b74f9dcc6","doc-e2a14079bf7c","doc-379438043053","doc-09e07f57e7a3","doc-34f8f723c71f","doc-eb651c8aa7d3","doc-851846770fd9","doc-787b1218443e","doc-da424a924abd","doc-7ae9666e2e45","doc-ede1832e22f5","doc-78c8e4d3cbb4","doc-fd479745e2a5","doc-0ee53acf3b25","doc-7f328f329ffd","doc-f961fe8a4049"],title:'IFC-linked storm main cover discrepancy',question:'Compare the proposed cover of storm sewer ST1 (300 mm pipe) against the reference minimum main cover. Identify the shortfall and cite both documents.'},
  ...demoReviews,
]

export function findDemoReview(question, documents) {
  return capacityReviewInputs(question)?capacityReviewDefinition(documents):undefined
}

export function capacityReviewDefinition(documents) {
  const available = new Set(documents.map(document=>document.id))
  return demoReviews.find(review=>review.id==='catchment-capacity-and-storage' && (review.documentIds||review.requiredDocumentIds).every(id=>available.has(id)))
}
