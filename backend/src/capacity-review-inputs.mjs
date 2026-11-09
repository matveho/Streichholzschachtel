import {normalizeMeasurements} from './indexer.mjs'

// The worksheet has a fixed engineering question, with editable numerical
// inputs. Anchoring the complete template keeps added conditions or tasks out
// of this workflow until they have their own evidence and validation.
const number = '(\\d+(?:\\.\\d+)?|\\.\\d+)'
const flow = number + '\\s*(m3/s|L/s)'
const template = new RegExp(
 '^A subdivision has expanded from\\s+' + number + '\\s*ha\\s+to\\s+' + number + '\\s*ha\\. ' +
 'The revised five-year runoff estimate is\\s+' + flow + ', but the existing sewer design carries\\s+' + flow +
 '\\. Can we retain it and size the new detention pond with the Rational Method\\?$', 'i')

export function capacityReviewInputs(question) {
 const match=normalizeMeasurements(question).replace(/\s+/g,' ').trim().match(template)
 if(!match)return null
 const [,previousArea,area,runoff,runoffUnit,capacity,capacityUnit]=match
 const values=[previousArea,area,runoff,capacity].map(Number)
 if(values.some(value=>!Number.isFinite(value)||value<=0)||values[1]<=values[0])return null
 return {previousArea:values[0],area:values[1],runoff:Number(runoff),runoffLiteral:runoff,
  runoffUnit:runoffUnit.toLowerCase()==='l/s'?'L/s':'m3/s',capacity:Number(capacity),capacityLiteral:capacity,
  capacityUnit:capacityUnit.toLowerCase()==='l/s'?'L/s':'m3/s'}
}
