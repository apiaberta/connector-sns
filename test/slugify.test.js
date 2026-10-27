import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from '../src/mapper.js'

describe('slugify', () => {
  it('lowercases, de-accents and collapses punctuation', () => {
    assert.equal(
      slugify('Unidade Local de Saúde da Lezíria, EPE'),
      'unidade-local-de-saude-da-leziria-epe'
    )
  })

  it('strips Portuguese accents including ç and ã', () => {
    assert.equal(slugify('Ação Governativa'), 'acao-governativa')
    assert.equal(slugify('São José'), 'sao-jose')
    assert.equal(slugify('Região de Saúde do Alentejo'), 'regiao-de-saude-do-alentejo')
  })

  it('trims leading and trailing hyphens', () => {
    assert.equal(slugify('  --Foo Bar--  '), 'foo-bar')
  })

  it('returns null for empty input', () => {
    assert.equal(slugify(null), null)
    assert.equal(slugify('   '), null)
    assert.equal(slugify('---'), null)
  })
})
