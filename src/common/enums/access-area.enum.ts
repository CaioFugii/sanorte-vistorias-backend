export enum AccessArea {
  GESTAO = 'gestao',
  QUALIDADE_DADOS = 'qualidade_dados',
  QUALIDADE_PAINEL = 'qualidade_painel',
  QUALIDADE_PENDENCIAS = 'qualidade_pendencias',
  SEGURANCA_DADOS = 'seguranca_dados',
  ENGENHARIA_OBRAS = 'engenharia_obras',
  ENGENHARIA_RELATORIOS = 'engenharia_relatorios',
  CAMPO_MINHAS = 'campo_minhas',
  CAMPO_NOVA = 'campo_nova',
}

export const ACCESS_AREAS_IN_ORDER: AccessArea[] = [
  AccessArea.GESTAO,
  AccessArea.QUALIDADE_DADOS,
  AccessArea.QUALIDADE_PAINEL,
  AccessArea.QUALIDADE_PENDENCIAS,
  AccessArea.SEGURANCA_DADOS,
  AccessArea.ENGENHARIA_OBRAS,
  AccessArea.ENGENHARIA_RELATORIOS,
  AccessArea.CAMPO_MINHAS,
  AccessArea.CAMPO_NOVA,
];
