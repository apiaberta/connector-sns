import { sourceUrl } from './config.js'

/**
 * Curated SNS Transparência datasets. Adding a dataset is config-only.
 */
export const DATASETS = [
  {
    key: 'urgencias',
    dataset_id: 'atendimentos-por-tipo-de-urgencia-hospitalar-link',
    title_pt: 'Atendimentos por Tipo de Urgência Hospitalar',
    description_pt: 'Evolução mensal dos atendimentos em urgência hospitalar por tipo (geral, pediátrica, obstétrica e psiquiátrica), por instituição.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      urgencias_geral: 'geral',
      urgencias_pediatricas: 'pediatrica',
      urgencia_obstetricia: 'obstetricia',
      urgencia_psiquiatrica: 'psiquiatrica',
      total_urgencias: 'total'
    }
  },
  {
    key: 'urgencias_triagem',
    dataset_id: 'atendimentos-em-urgencia-triagem-manchester',
    title_pt: 'Atendimentos em Urgência Hospitalar por Triagem de Manchester',
    description_pt: 'Atendimentos em urgência hospitalar por cor da triagem de Manchester, por mês e instituição.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      no_de_atendimentos_em_urgencia_su_triagem_manchester_vermelha: 'vermelha',
      no_de_atendimentos_em_urgencia_su_triagem_manchester_laranja: 'laranja',
      no_de_atendimentos_em_urgencia_su_triagem_manchester_amarela: 'amarela',
      no_de_atendimentos_em_urgencia_su_triagem_manchester_verde: 'verde',
      no_de_atendimentos_em_urgencia_su_triagem_manchester_azul: 'azul',
      no_de_atendimentos_em_urgencia_su_triagem_manchester_branca: 'branca',
      no_de_atendimentos_em_sem_triagem_manchester: 'sem_triagem'
    }
  },
  {
    key: 'cirurgia_tmrg',
    dataset_id: 'inscritos-lic-dentro-tmrg',
    title_pt: 'Inscritos em LIC dentro do TMRG (270 dias)',
    description_pt: 'Doentes inscritos na lista de inscritos para cirurgia (LIC) dentro do tempo máximo de resposta garantida de 270 dias.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      no_de_doentes_inscritos_dentro_do_tmrg_sigic: 'dentro_tmrg',
      no_de_doentes_inscritos_sigic: 'inscritos',
      de_inscritos_em_lic_dentro_do_tmrg: 'pct_dentro_tmrg'
    },
    ratios: {
      pct_dentro_tmrg: { numerator: 'dentro_tmrg', denominator: 'inscritos', scale: 100 }
    }
  },
  {
    key: 'cirurgia_tmrg_onco',
    dataset_id: 'inscritos-em-lic-dentro-do-tmrg-180-dias',
    title_pt: 'Inscritos em LIC dentro do TMRG (180 dias)',
    description_pt: 'Doentes inscritos na lista de inscritos para cirurgia (LIC) dentro do tempo máximo de resposta garantida de 180 dias.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      no_de_doentes_inscritos_dentro_do_tmrg_sigic: 'dentro_tmrg',
      no_de_doentes_inscritos_sigic: 'inscritos',
      de_inscritos_em_lic_dentro_do_tmrg: 'pct_dentro_tmrg'
    },
    ratios: {
      pct_dentro_tmrg: { numerator: 'dentro_tmrg', denominator: 'inscritos', scale: 100 }
    }
  },
  {
    key: 'consultas_hospitalares',
    dataset_id: '01_sica_evolucao-mensal-das-consultas-medicas-hospitalares',
    title_pt: 'Consultas Médicas Hospitalares',
    description_pt: 'Evolução mensal das consultas médicas hospitalares (total, primeiras e subsequentes), por instituição.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      no_de_consultas_medicas_total: 'total',
      no_de_primeiras_consultas: 'primeiras',
      no_de_consultas_subsequentes: 'subsequentes'
    }
  },
  {
    key: 'consultas_tmrg',
    dataset_id: 'consultas-em-tempo-real',
    title_pt: 'Primeiras Consultas em Tempo Adequado',
    description_pt: 'Percentagem de primeiras consultas hospitalares realizadas dentro do tempo máximo de resposta garantida.',
    period_field: 'tempo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      no_primeiras_ce_prestadas_dentro_do_tmrg: 'dentro_tmrg',
      no_primeiras_ce_realizadas_com_registo_no_cth: 'realizadas',
      '1as_consultas_realizadas_em_tempo_adequado': 'pct_dentro_tmrg'
    },
    ratios: {
      pct_dentro_tmrg: { numerator: 'dentro_tmrg', denominator: 'realizadas', scale: 100 }
    }
  },
  {
    key: 'consultas_csp',
    dataset_id: 'evolucao-das-consultas-medicas-nos-csp',
    title_pt: 'Consultas Médicas nos Cuidados de Saúde Primários',
    description_pt: 'Consultas médicas presenciais, não presenciais e ao domicílio nos cuidados de saúde primários, por entidade.',
    period_field: 'tempo',
    entity_field: 'entidade',
    geo_field: 'ponto_ou_localizacao_geografica',
    metrics: {
      no_de_consultas_medicas_presencias_qt: 'presenciais',
      no_de_consultas_medicas_nao_presenciais_ou_inespecificas_qt: 'nao_presenciais',
      no_de_consultas_medicas_ao_domicilio_qt: 'domicilio'
    }
  },
  {
    key: 'rh',
    dataset_id: 'trabalhadores-por-grupo-profissional',
    title_pt: 'Trabalhadores por Grupo Profissional',
    description_pt: 'Número de trabalhadores com contrato ativo, por instituição e grupo profissional.',
    period_field: 'periodo',
    entity_field: 'instituicao',
    geo_field: 'localizacao_geografica',
    metrics: {
      medicos_s_internos: 'medicos',
      medicos_internos: 'medicos_internos',
      enfermeiros: 'enfermeiros',
      tss: 'tss',
      farmaceuticos: 'farmaceuticos',
      farmaceuticos_residentes: 'farmaceuticos_residentes',
      tdt: 'tdt',
      at: 'at',
      ao: 'ao',
      tas: 'tas',
      ao0: 'ao0',
      ts: 'ts',
      informaticos: 'informaticos',
      outros: 'outros',
      total_geral: 'total'
    }
  }
]

export const DATASET_KEYS = DATASETS.map(d => d.key)
export const DATASETS_BY_KEY = Object.fromEntries(DATASETS.map(d => [d.key, d]))

export function getDataset(key) {
  return DATASETS_BY_KEY[key]
}

export function metricNames(ds) {
  return Object.values(ds.metrics)
}

export function selectFields(ds) {
  return [ds.period_field, 'regiao', ds.entity_field, ds.geo_field, ...Object.keys(ds.metrics)]
}

export function datasetSourceUrl(ds) {
  return sourceUrl(ds.dataset_id)
}
