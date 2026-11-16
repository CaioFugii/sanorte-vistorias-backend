const ACCENTED =
  'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const UNACCENTED =
  'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';

export const POST_WORK_REQUIRED_MESSAGE =
  'O resultado desta ordem de serviço não exige vistoria de pós-obra.';

const POST_WORK_RESULTS = [
  'DESCOBERTO E NIVELADO POÇO DE VISITA',
  'FRESADO E RECAPEADO PAV ASFALTICO INV',
  'NIVELADO POÇO DE INSPEÇÃO',
  'NIVELADO POÇO DE VISITA',
  'NIVELADO TERMINAL DE LIMPEZA',
  'RECOMPOSTA SINALIZAÇÃO VIARIA HORIZ INV',
  'REPOSIÇÃO DE ASFALTO',
  'REPOSIÇÃO DE ASFALTO A FRIO',
  'REPOSIÇÃO DE ASFALTO A FRIO INV',
  'REPOSIÇÃO DE ASFALTO ECOLOGICO INV',
  'REPOSIÇÃO DE ASFALTO INV',
  'REPOSIÇÃO DE ASFALTO RETRABALHO',
  'REPOSIÇÃO DE BLOQUETE',
  'REPOSIÇÃO DE BLOQUETE INV',
  'REPOSIÇÃO DE BLOQUETE RETRABALHO',
  'REPOSIÇÃO DE CAPA ASFALTICA',
  'REPOSIÇÃO DE CAPA ASFALTICA ECOLOGIC INV',
  'REPOSIÇÃO DE CAPA ASFALTICA INV',
  'REPOSIÇÃO DE CAPA ASFALTICA RETRABALHO',
  'REPOSIÇÃO DE CONCRETO',
  'REPOSIÇÃO DE CONCRETO INV',
  'REPOSIÇÃO DE CONCRETO RETRABALHO',
  'REPOSIÇÃO DE GUIA',
  'REPOSIÇÃO DE PA CIMENTADO',
  'REPOSIÇÃO DE PA CIMENTADO INV',
  'REPOSIÇÃO DE PA ESPECIAL',
  'REPOSIÇÃO DE PA ESPECIAL INV',
  'REPOSIÇÃO DE PARALELO INV',
  'REPOSIÇÃO DE PASSEIO ESPECIAL RETRABALHO',
  'REPOSIÇÃO DE PASSEIO RETRABALHO',
  'REPOSIÇÃO DE PO CIMENTADO',
  'REPOSIÇÃO DE PO CIMENTADO INV',
  'REPOSIÇÃO DE PO ESPECIAL',
  'REPOSIÇÃO DE PO ESPECIAL INV',
  'REPOSIÇÃO DE SARJETA',
  'REPOSIÇÃO DE PARALELO',
  'REPOSIÇÃO DE SARJETA INV',
] as const;

export function normalizeServiceResult(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const NORMALIZED_POST_WORK_RESULTS = new Set(
  POST_WORK_RESULTS.map((result) => normalizeServiceResult(result)),
);

export function isPostWorkRequired(
  resultado: string | null | undefined,
): boolean {
  const normalized = normalizeServiceResult(resultado);
  if (!normalized) return false;
  return NORMALIZED_POST_WORK_RESULTS.has(normalized);
}

export function postWorkEligibleResults(): string[] {
  return [...NORMALIZED_POST_WORK_RESULTS];
}

export function postWorkEligibleSql(alias = 'serviceOrder'): string {
  return `upper(btrim(regexp_replace(translate(coalesce("${alias}"."resultado", ''), '${ACCENTED}', '${UNACCENTED}'), '[[:space:]]+', ' ', 'g'))) IN (:...postWorkEligibleResults)`;
}
