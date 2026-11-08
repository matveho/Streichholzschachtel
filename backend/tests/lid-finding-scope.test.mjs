import test from 'node:test'
import assert from 'node:assert/strict'
import {incompatibleLidAsset} from '../src/applicability.mjs'
test('findings retain the requested LID asset while allowing explicit comparisons',()=>{
 assert.equal(incompatibleLidAsset('Review a box planter design.','The soil-cell planter must have tree openings.'),true)
 assert.equal(incompatibleLidAsset('Review a bioretention basin.','Box planters must have an underdrain.'),true)
 assert.equal(incompatibleLidAsset('Compare box planters with soil cells.','Soil cells need inspection.'),false)
 assert.equal(incompatibleLidAsset('Review a box planter design.','Do not compact the LID soil.'),false)
})
