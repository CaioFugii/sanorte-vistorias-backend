import {
  isPostWorkRequired,
  normalizeServiceResult,
} from './post-work-eligibility';

describe('post-work eligibility', () => {
  it('normaliza acento, caixa e espaço repetido', () => {
    expect(normalizeServiceResult('  reposição   de asfalto ')).toBe(
      'REPOSICAO DE ASFALTO',
    );
  });

  it('aceita variação de caixa e espaço e recusa pontuação sobrando', () => {
    expect(isPostWorkRequired('reposição de asfalto')).toBe(true);
    expect(isPostWorkRequired('REPOSIÇÃO  DE ASFALTO')).toBe(true);
    expect(isPostWorkRequired('REPOSIÇÃO DE ASFALTO.')).toBe(false);
  });

  it('resultado fora da lista não exige pós-obra', () => {
    expect(isPostWorkRequired('REPARO DE REDE DE AGUA')).toBe(false);
    expect(isPostWorkRequired(null)).toBe(false);
    expect(isPostWorkRequired('')).toBe(false);
  });
});
