// Explicit-basis, project-scoped holdouts supplement the broad engineering
// suite. Passing these does not qualify unrestricted design interpretation.
const scope={projectId:'demo-mill-creek',documentIds:['doc-09e07f57e7a3']}
export const quantitativeScenarios=[
 {
  ...scope,id:'capacity-explicit-basis',
  question:'For a 42 ha storm sewer catchment, use Design Guidelines Table 2.1 as the selected calculation basis. The supplied five-year runoff is 1.20 m3/s and existing capacity is 0.90 m3/s. Calculate the table-based design flow and capacity difference, treating the supplied figures as assumptions and leaving design approval unresolved.',
  terms:[/1\.5(?:0)?\s*m[³3]\/s/,/0\.6(?:0)?\s*m[³3]\/s/],
  arithmeticExpected:[{value:1.5,dimension:'flow'},{value:0.6,dimension:'flow',operation:'-'}],
 },
 {
  ...scope,id:'capacity-mixed-units',
  question:'Use Design Guidelines Table 2.1 as the selected calculation basis for a 42 ha storm sewer catchment. The supplied five-year runoff is 1.20 m3/s and existing capacity is 900 L/s. Calculate the table-based flow and the capacity difference with compatible units, leaving design approval unresolved.',
  terms:[/1\.5(?:0)?\s*m[³3]\/s|1500\s*L\/s/,/0\.6(?:0)?\s*m[³3]\/s|600\s*L\/s/],
  arithmeticExpected:[{value:1.5,dimension:'flow'},{value:0.6,dimension:'flow',operation:'-'}],
 },
 {
  ...scope,id:'capacity-missing-input',
  question:'For a 42 ha storm sewer catchment, use Design Guidelines Table 2.1 as the selected basis. Five-year runoff is 1.20 m3/s, but existing sewer capacity has not been provided. What is the exact numerical capacity shortfall?',
  noAnswer:true,
  requiredInputKind:'capacity_difference',
  forbidden:[/0\.6(?:0)?\s*m[³3]\/s|600\s*L\/s/],
 },
]
