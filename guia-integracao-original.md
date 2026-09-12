# Guia de Integração — Interviews API

**Versão da API:** 2.1.0 · **Última atualização:** Setembro de 2026
**Audiência:** desenvolvedores de empresas parceiras
**Base URL de produção:** `https://apisophia-632e2671412f.herokuapp.com`

Bem-vindo. Este guia é destinado a desenvolvedores de empresas parceiras que vão consumir a Interviews API para receber, em seus próprios sistemas (ATS, CRM de RH, painéis internos, BI), os dados de entrevistas e vagas de candidatos.

A API é **somente leitura**: você consulta dados, não envia. As entrevistas e vagas são criadas pelo nosso ecossistema de produtos e ficam disponíveis para consulta logo após o processamento.

> **Migrando da 2.0.0?** Leia a seção [O que mudou na 2.1.0](#o-que-mudou-na-210) antes de qualquer coisa. A ordenação de entrevistas foi corrigida e o campo de data recomendado mudou.

---

## Sumário

1. [O que mudou na 2.1.0](#o-que-mudou-na-210)
2. [Antes de começar](#antes-de-começar)
3. [Autenticação](#autenticação)
4. [Convenções gerais](#convenções-gerais)
5. [Rate limiting](#rate-limiting)
6. [Endpoints](#endpoints)
   - [GET / — Informações da API](#get--—-informações-da-api)
   - [GET /health — Verificação de saúde](#get-health-—-verificação-de-saúde)
   - [GET /api/v1/interviews — Listar entrevistas](#get-apiv1interviews-—-listar-entrevistas)
   - [GET /api/v1/interviews/latest — Última entrevista](#get-apiv1interviewslatest-—-última-entrevista)
   - [GET /api/v1/jobs — Listar vagas](#get-apiv1jobs-—-listar-vagas)
7. [Dicionário de dados](#dicionário-de-dados)
8. [Tratamento de erros](#tratamento-de-erros)
9. [Exemplos de código](#exemplos-de-código)
10. [Boas práticas](#boas-práticas)
11. [LGPD e proteção de dados](#lgpd-e-proteção-de-dados)
12. [Versionamento e changelog](#versionamento-e-changelog)
13. [Suporte](#suporte)
14. [Glossário](#glossário)

---

## O que mudou na 2.1.0

Três pontos afetam diretamente quem já está integrado:

**1. A ordenação de entrevistas foi corrigida.**
Até a 2.0.0, `/interviews` e `/interviews/latest` ordenavam pelo campo `interview.date`, que é uma string no formato `"M/D/YYYY, h:mm:ss AM/PM"`. A ordenação era **textual**, não cronológica — `"9/9/2025"` vinha antes de `"9/3/2026"`, e `"11:51 AM"` vinha depois de `"11:40 PM"`. O efeito prático era `/interviews/latest` devolvendo uma entrevista antiga como "última" e a paginação de `/interviews` fora de ordem. A partir da 2.1.0 a ordenação usa `created_at` (timestamp real). **Se o seu polling do `/latest` parecia "travado" numa mesma entrevista, era isso.**

**2. Novo campo `interview.created_at`.**
ISO 8601 com timezone (ex: `"2026-09-03T21:14:21.959Z"`). Use este campo para qualquer lógica de data: ordenação, sincronização incremental, exibição. É o campo pelo qual a API ordena.

**3. `interview.date` está em UTC, não em horário de Brasília.**
A documentação anterior afirmava que o campo estava em `America/Sao_Paulo`. Estava errado: o valor é o horário **UTC** formatado em en-US. Se você fazia parsing de `interview.date` como horário de Brasília, suas datas estão 3 horas adiantadas. Corrija usando `interview.created_at`. O campo `date` é mantido apenas para compatibilidade e pode ser removido numa futura major.

Nenhuma mudança é breaking no contrato: nada foi removido ou renomeado.

---

## Antes de começar

### O que você vai precisar

- Uma **API key**, fornecida pelo nosso time. O formato é `sk_` seguido de 32 caracteres hexadecimais (ex: `sk_a1b2c3d4e5f67890abcdef1234567890`). Chaves fora desse formato são rejeitadas antes mesmo de consultar o banco.
- A **URL base** da API: `https://apisophia-632e2671412f.herokuapp.com`
- Um cliente HTTP capaz de fazer requisições GET com header `Authorization`. Qualquer linguagem moderna serve.

### O que você vai receber

A API expõe três famílias de dados:

- **Vagas** (`/api/v1/jobs`) — descrições das posições abertas no seu cadastro, com requisitos, responsabilidades e configurações de processo.
- **Entrevistas** (`/api/v1/interviews`) — relatórios consolidados de candidatos avaliados, incluindo dados de contato, endereço, score, pontos fortes/fracos e avaliação por IA.
- **Última entrevista** (`/api/v1/interviews/latest`) — atalho para obter rapidamente o último relatório recebido, útil para integração em tempo quase-real via polling leve.

### Isolamento de dados

Sua API key está vinculada a um `codigo_cliente` exclusivo. Você só enxerga vagas e entrevistas associadas à sua empresa — em nenhuma circunstância dados de outros clientes serão retornados.

### Identificadores: `id` da entrevista vs `codigo` da vaga

Uma confusão comum que vale esclarecer logo:

- **`id`** (UUID, ex: `"4802144f-d42c-479b-bc54-9f02c1417da1"`) identifica **uma entrevista**. É único, imutável e é a chave que você deve usar para correlacionar, deduplicar e reportar problemas.
- **`job.codigo`** (ex: `"RHIN-1875"`) identifica **uma vaga**. Uma vaga tem várias entrevistas — vários candidatos, e às vezes o mesmo candidato mais de uma vez. **Nunca use `codigo` como identificador de entrevista.**

---

## Autenticação

Todas as rotas sob `/api/v1/*` exigem autenticação. Envie sua API key no header `Authorization`, no esquema Bearer:

```http
GET /api/v1/interviews HTTP/1.1
Host: apisophia-632e2671412f.herokuapp.com
Authorization: Bearer sk_a1b2c3d4e5f67890abcdef1234567890
```

### Cuidados com a chave

- **Nunca exponha a API key em código frontend** (browser, app mobile, GitHub público). A chave concede acesso a todos os dados de candidatos da sua empresa.
- Armazene em variável de ambiente ou em um secret manager (AWS Secrets Manager, Vault, etc.).
- Em caso de suspeita de vazamento, entre em contato imediatamente para rotação. A chave anterior será invalidada na hora.
- Não compartilhe a mesma chave entre ambientes (dev/staging/prod) se possível — solicite chaves separadas.

### O que pode dar errado

| Status | Causa |
|--------|-------|
| `401 Unauthorized` | Header `Authorization` ausente ou não começa com `Bearer ` |
| `403 Forbidden` | Chave com formato inválido (não é `sk_` + 32 hex), inexistente ou revogada |

Exemplo de erro `401`:

```json
{ "error": "Não autorizado: Token de autenticação não fornecido." }
```

Exemplo de erro `403`:

```json
{ "error": "Proibido: Chave de API inválida." }
```

> **Dica:** um `403` inesperado com a chave "certa" quase sempre é um caractere a mais copiado junto — espaço, quebra de linha, aspas. Confira o comprimento: são exatamente 35 caracteres (`sk_` + 32).

---

## Convenções gerais

### Base URL

```
https://apisophia-632e2671412f.herokuapp.com
```

Todos os exemplos deste guia usam essa URL.

### Formato

- **Request:** método GET, sem body. Parâmetros vão em query string.
- **Response:** sempre JSON (`Content-Type: application/json`) em UTF-8.
- **Charset:** UTF-8 em tudo (atenção a campos com acentos como `logradouro`, `cidade`).

### Datas e fuso horário

Cada entrevista traz dois campos temporais:

| Campo | Formato | Fuso | Uso recomendado |
|-------|---------|------|-----------------|
| `interview.created_at` | ISO 8601, ex: `"2026-09-03T21:14:21.959Z"` | UTC (com `Z` explícito) | **Use este.** Ordenação, sync incremental, exibição (converta para o fuso do usuário). |
| `interview.date` | string en-US, ex: `"9/3/2026, 9:14:21 PM"` | **UTC** (sem indicador) | Legado. Só exibição, se tanto. Não ordene por ele. |

Os dois representam o **mesmo instante**. `created_at` é simplesmente a versão parseável e sem ambiguidade.

### Envelope de resposta

Todas as respostas bem-sucedidas seguem o padrão:

```json
{ "data": ... }
```

ou, para endpoints paginados:

```json
{ "data": [...], "pagination": { ... } }
```

Todas as respostas de erro seguem:

```json
{ "error": "Mensagem descritiva em português." }
```

---

## Rate limiting

A API aplica dois limites para proteger a estabilidade do serviço:

| Escopo | Limite padrão | Janela |
|--------|---------------|--------|
| Por IP de origem | 300 requisições | 15 minutos |
| Por API key autenticada | 120 requisições | 1 minuto |

Cada resposta inclui headers padrão de rate limit (RFC draft 7):

```
RateLimit-Limit: 120
RateLimit-Remaining: 118
RateLimit-Reset: 47
```

`RateLimit-Reset` indica em quantos segundos a janela atual zera.

Ao exceder o limite, você recebe:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47

{ "error": "Limite de requisições do cliente atingido." }
```

### Recomendações

- **Implemente backoff exponencial** ao receber `429`. Comece com 1s e dobre a cada tentativa, com teto de 60s.
- **Espace suas chamadas.** Se você só consulta `/interviews/latest` para detectar novos relatórios, um polling a cada 30–60 segundos é mais que suficiente. Polling agressivo (a cada segundo) só consome seu rate limit sem ganho real.
- **Não tente acelerar paginação** fazendo várias páginas em paralelo com a mesma chave — ainda vai bater no limite de 120/min, só que mais rápido.

---

## Endpoints

### GET / — Informações da API

Endpoint público (sem autenticação) que retorna informações básicas da API. Útil para verificar que a URL base está correta.

**Request:**

```bash
curl https://apisophia-632e2671412f.herokuapp.com/
```

**Response `200`:**

```json
{
  "message": "Bem-vindo à API de Integração de Entrevistas!",
  "status": "online",
  "version": "2.1.0"
}
```

### GET /health — Verificação de saúde

Endpoint público que verifica a conectividade com o banco de dados. Use em monitoramento de uptime (intervalo de 1 minuto é suficiente).

**Request:**

```bash
curl https://apisophia-632e2671412f.herokuapp.com/health
```

**Response `200`** (saudável):

```json
{ "status": "ok", "database": "ok", "auth_mode": "service_role", "version": "2.1.0" }
```

**Response `503`** (degradado):

```json
{ "status": "degraded", "database": "error", "auth_mode": "service_role" }
```

O campo `auth_mode` é informativo e destinado à nossa operação; você pode ignorá-lo.

### GET /api/v1/interviews — Listar entrevistas

Retorna a lista paginada de relatórios de entrevista do seu cliente, ordenados **da mais recente para a mais antiga por `interview.created_at`**. A ordem é determinística (desempate por `id`), então a paginação é estável entre requisições.

**Query parameters:**

| Parâmetro | Tipo | Default | Restrições |
|-----------|------|---------|------------|
| `page` | inteiro | 1 | >= 1 |
| `limit` | inteiro | 20 | entre 1 e 100 |

**Request:**

```bash
curl -H "Authorization: Bearer sk_a1b2c3..." \
  "https://apisophia-632e2671412f.herokuapp.com/api/v1/interviews?page=1&limit=20"
```

**Response `200`:**

```json
{
  "data": [
    {
      "id": "8ecb88bf-d1e8-4f43-bf5f-9c4c62461183",
      "candidate": {
        "name": "Ramon Clemente",
        "email": "ramon.clemente@example.com",
        "phone": "31994301901",
        "cpf": "06390483660",
        "video_url": null,
        "address": {
          "cep": "38182670",
          "logradouro": "Avenida Lorena Simeão Vale",
          "numero": "70 C",
          "complemento": null,
          "bairro": "Loteamento Residencial Dona Adélia II",
          "cidade": "Araxá",
          "estado": "MG"
        }
      },
      "job": {
        "position": "Diretor de Operações",
        "codigo": "STAR-DIROP"
      },
      "interview": {
        "created_at": "2026-05-29T17:12:36.481Z",
        "date": "5/29/2026, 5:12:36 PM",
        "overall_score": null,
        "core10_link": null
      },
      "results": {
        "strengths": null,
        "development_points": null,
        "ai_summary": null
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 1,
    "totalPages": 1,
    "totalRecords": 1
  }
}
```

**Notas:**

- O `id` retornado é o `interview_uuid` — use-o como chave única para correlacionar com seus próprios registros.
- Campos `null` são comuns em entrevistas ainda em processamento pela IA. Veja [Status de processamento](#status-de-processamento-de-uma-entrevista).
- `pageSize` indica quantos itens efetivamente vieram nesta página (pode ser menor que `limit` na última página).

**Possíveis erros:**

| Status | Quando ocorre |
|--------|---------------|
| `400` | `page` ou `limit` inválidos (não inteiros, fora do range permitido) |
| `401` / `403` | Problema de autenticação |
| `429` | Rate limit excedido |
| `500` | Erro interno |

Exemplo de erro `400`:

```json
{ "error": "Parâmetro `limit` inválido. Deve ser inteiro entre 1 e 100." }
```

### GET /api/v1/interviews/latest — Última entrevista

Atalho para obter apenas a entrevista mais recente **por `created_at`** (mesmo formato de objeto que cada item de `/interviews`).

**Request:**

```bash
curl -H "Authorization: Bearer sk_a1b2c3..." \
  https://apisophia-632e2671412f.herokuapp.com/api/v1/interviews/latest
```

**Response `200`:**

```json
{
  "data": {
    "id": "8ecb88bf-d1e8-4f43-bf5f-9c4c62461183",
    "candidate": { "...": "mesmo formato de /interviews" },
    "job": { "position": "Diretor de Operações", "codigo": "STAR-DIROP" },
    "interview": {
      "created_at": "2026-05-29T17:12:36.481Z",
      "date": "5/29/2026, 5:12:36 PM",
      "overall_score": null,
      "core10_link": null
    },
    "results": { "strengths": null, "development_points": null, "ai_summary": null }
  }
}
```

**Response `404`** (nenhuma entrevista cadastrada):

```json
{ "error": "Nenhuma entrevista encontrada." }
```

**Quando usar este endpoint vs `/interviews`:**

- Use `/interviews/latest` se você só precisa detectar a entrada da entrevista mais recente (polling leve) **e** o volume de entrevistas é baixo o bastante para que duas nunca cheguem entre dois polls.
- Use `/interviews` se você precisa de histórico, sincronização incremental ou processamento em lote. **Se duas entrevistas puderem entrar dentro do seu intervalo de polling, `/latest` vai perder a primeira** — nesse caso, use `/interviews?limit=10` e compare pelo `created_at`. Veja [Sincronização incremental](#sincronização-incremental-vs-completa).

### GET /api/v1/jobs — Listar vagas

Retorna todas as vagas cadastradas pelo seu cliente, ordenadas por `id` decrescente (mais recente primeiro).

Não há paginação neste endpoint — o volume de vagas por cliente costuma ser pequeno (dezenas a poucas centenas).

**Request:**

```bash
curl -H "Authorization: Bearer sk_a1b2c3..." \
  https://apisophia-632e2671412f.herokuapp.com/api/v1/jobs
```

**Response `200`:**

```json
{
  "data": [
    {
      "id": 1705,
      "title": "Área de Produção",
      "company": "Tramontina Multi",
      "work_model": "Presencial",
      "status": "active",
      "description": "Profissional responsável por atuar na produção industrial...",
      "responsibilities": [
        "Montar peças, componentes e jogos utilizando dispositivos, ferramentas manuais ou automáticas",
        "Embalar as peças e acondicioná-las nas respectivas embalagens",
        "Operar máquinas do processo produtivo"
      ],
      "requirements": [
        "No mínimo Ensino fundamental incompleto",
        "Atenção aos detalhes"
      ],
      "nice_to_have": [],
      "codigo": "TRAM-PROD01",
      "testecomportamental": true,
      "anexar_curriculo_obrigatorio": false,
      "divulgar": false,
      "perguntavideo": null,
      "video": false,
      "log_cargos": "recrutador@empresa.com"
    }
  ]
}
```

---

## Dicionário de dados

### Status de processamento de uma entrevista

Uma entrevista passa por etapas. Os campos abaixo refletem o estágio:

| Estágio | `interview.overall_score` | `results.strengths`, `development_points`, `ai_summary` | `interview.core10_link` | `candidate.video_url` |
|---------|---------------------------|----------------------------------------------------------|-------------------------|-----------------------|
| Em coleta | `null` | `null` | `null` | `null` |
| Coletada, IA processando | `null` ou parcial | `null` | pode estar disponível | pode estar disponível |
| Concluída | preenchido | preenchido | preenchido | preenchido |

**Trate `null` graciosamente** em todos esses campos. Se você precisa esperar a IA terminar, faça polling pelo `id` da entrevista até `overall_score` deixar de ser `null`.

### Campos de `candidate`

| Campo | Tipo | Formato | Exemplo | Observações |
|-------|------|---------|---------|-------------|
| `name` | string \| null | nome completo | `"João Silva"` | — |
| `email` | string \| null | RFC 5322 | `"joao@example.com"` | — |
| `phone` | string \| null | dígitos + DDD, sem máscara | `"11987654321"` | 10 ou 11 dígitos. Aplique máscara no seu sistema se for exibir. |
| `cpf` | string \| null | 11 dígitos, sem máscara | `"12345678901"` | Dígitos verificadores incluídos. Dado sensível — veja [LGPD](#lgpd-e-proteção-de-dados). |
| `video_url` | string \| null | URL HTTPS | `"https://.../video.mp4"` | URL pública para o vídeo da entrevista. `null` se não gerado. |

### Campos de `candidate.address`

Endereço residencial do candidato, capturado durante a entrevista.

| Campo | Tipo | Formato | Exemplo | Observações |
|-------|------|---------|---------|-------------|
| `cep` | string \| null | 8 dígitos, sem máscara | `"01310100"` | Aplique máscara `00000-000` no seu sistema se for exibir. |
| `logradouro` | string \| null | livre | `"Avenida Paulista"` | Geralmente preenchido via lookup de CEP. |
| `numero` | string \| null | livre | `"1578"` | Tipo string, não número — aceita `"S/N"`, `"100 A"`, `"70 C"`. |
| `complemento` | string \| null | livre | `"Apto 42"`, `null` | Frequentemente `null`. |
| `bairro` | string \| null | livre | `"Bela Vista"` | — |
| `cidade` | string \| null | livre | `"São Paulo"` | — |
| `estado` | string \| null | sigla UF de 2 letras | `"SP"` | Maiúsculas. |

### Campos de `job` (dentro da entrevista)

| Campo | Tipo | Exemplo | Observações |
|-------|------|---------|-------------|
| `position` | string \| null | `"Diretor de Operações"` | Título da vaga no momento da entrevista. |
| `codigo` | string \| null | `"STAR-DIROP"` | Código interno da **vaga**. Use este campo para juntar (`JOIN`) com o `codigo` de `/api/v1/jobs`. **Não é identificador de entrevista** — uma vaga tem N entrevistas. |

### Campos de `interview`

| Campo | Tipo | Formato | Exemplo | Observações |
|-------|------|---------|---------|-------------|
| `created_at` | string | ISO 8601 com timezone (UTC) | `"2026-09-03T21:14:21.959Z"` | **Campo de data recomendado.** Instante em que a entrevista foi registrada. É o campo pelo qual a API ordena. |
| `date` | string \| null | locale en-US, `"M/D/YYYY, h:mm:ss AM/PM"` | `"9/3/2026, 9:14:21 PM"` | **Legado.** Mesmo instante de `created_at`, formatado em **UTC**. Ver nota abaixo. |
| `overall_score` | número \| null | decimal | `7.5`, `null` | Score consolidado de 0 a 10. `null` até a IA terminar. |
| `core10_link` | string \| null | URL HTTPS | `"https://.../core10/..."` | Link para o relatório detalhado do teste comportamental Core10. |

#### ⚠ Sobre `interview.date`

Este campo é uma string sem indicador de fuso, gerada em **UTC**. Ele foi documentado até a 2.0.0 como horário de Brasília — **isso estava errado**. Se você fez parsing dele assumindo `America/Sao_Paulo`, suas datas estão 3 horas adiantadas.

A recomendação é **não usar `date`** e trabalhar com `created_at`:

**JavaScript:**

```javascript
const when = new Date(interview.created_at); // instante correto, sem ambiguidade
// Exibir em horário de Brasília:
when.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
```

**Python:**

```python
from datetime import datetime
from zoneinfo import ZoneInfo

when = datetime.fromisoformat(interview["created_at"].replace("Z", "+00:00"))
when_brt = when.astimezone(ZoneInfo("America/Sao_Paulo"))
```

Se por algum motivo precisar parsear `date`, trate-o como UTC explicitamente:

```javascript
import { parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
const local = parse("9/3/2026, 9:14:21 PM", "M/d/yyyy, h:mm:ss a", new Date());
const utc = fromZonedTime(local, 'UTC');
```

**Nunca ordene comparando as strings de `date`** — `"10/01/2026"` vem antes de `"5/29/2026"` em ordenação textual. Confie na ordem que a API já entrega ou ordene por `created_at`.

### Campos de `results`

| Campo | Tipo | Conteúdo | Observações |
|-------|------|----------|-------------|
| `strengths` | string \| null | texto livre | Pontos fortes identificados pela IA. Pode conter quebras de linha e formatação leve. |
| `development_points` | string \| null | texto livre | Pontos a desenvolver / áreas de atenção. |
| `ai_summary` | string \| null | texto livre | Avaliação geral consolidada pela IA. |

> ⚠ **Decisões automatizadas (LGPD Art. 20):** os campos `overall_score`, `strengths`, `development_points` e `ai_summary` são gerados por IA. Sob a LGPD, o candidato tem direito a solicitar revisão por pessoa natural. Veja [LGPD](#lgpd-e-proteção-de-dados).

### Campos de vagas (`/api/v1/jobs`)

| Campo | Tipo | Exemplo | Observações |
|-------|------|---------|-------------|
| `id` | inteiro | `1705` | ID interno da vaga. Único por vaga. |
| `title` | string | `"Diretor de Operações"` | Título exibível. |
| `company` | string \| null | `"Tramontina Multi"` | Pode ser diferente do nome do cliente em casos de holding. |
| `work_model` | string \| null | `"Presencial"`, `"Remoto"`, `"Híbrido"` | — |
| `status` | string \| null | `"active"` | Outros valores possíveis incluem variantes de inativo/encerrado conforme cadastro do cliente. |
| `description` | string \| null | texto livre, pode conter `\n` | Descrição da vaga. |
| `responsibilities` | array de strings | `["Responsabilidade 1", ...]` | Pode vir vazio (`[]`). |
| `requirements` | array de strings | `["Requisito 1", ...]` | Requisitos obrigatórios. |
| `nice_to_have` | array de strings | `["Diferencial 1", ...]` | Diferenciais. Frequentemente vazio. |
| `codigo` | string \| null | `"STAR-DIROP"` | Use para juntar com `job.codigo` das entrevistas. |
| `testecomportamental` | boolean | `true` | Indica se a vaga aplica o teste Core10. |
| `anexar_curriculo_obrigatorio` | boolean | `true` | Indica se o anexo de currículo é obrigatório no fluxo de aplicação. |
| `divulgar` | boolean | `true` | Indica se a vaga deve ser divulgada publicamente. |
| `perguntavideo` | string \| null | texto livre | Pergunta enviada em formato vídeo durante a entrevista (quando aplicável). |
| `video` | boolean | `false` | Indica se a vaga inclui resposta em vídeo do candidato. |
| `log_cargos` | string \| null | email | Email do recrutador responsável pela vaga. |

---

## Tratamento de erros

Todos os erros retornam status HTTP apropriado e payload JSON `{ "error": "..." }`.

| Status | Significado | Ação recomendada |
|--------|-------------|------------------|
| `200` | Sucesso | Processe `data`. |
| `400` | Parâmetro inválido | Corrija o request. Mensagem indica qual parâmetro está errado. |
| `401` | Autenticação ausente | Adicione o header `Authorization: Bearer ...`. |
| `403` | Chave inválida, malformada ou revogada | Verifique a chave (35 caracteres, `sk_` + 32 hex). Se estiver correta, contate suporte. |
| `404` | Recurso não encontrado | Em `/interviews/latest`: ainda não há entrevistas. Em outros: rota inexistente. |
| `413` | Payload muito grande | Não deveria ocorrer em GETs. Verifique se não está enviando body. |
| `429` | Rate limit excedido | Aplique backoff exponencial. Veja header `Retry-After`. |
| `500` | Erro interno do servidor | Retentar com backoff. Se persistir, contate suporte. |
| `502` / `503` / `504` | Indisponibilidade da plataforma de hospedagem, ou (em `/health`) banco indisponível | Retentar com backoff. Indica problema temporário de infraestrutura. |

### Estratégia de retry

Retente automaticamente apenas em `429`, `500`, `502`, `503`, `504`. **Nunca retente em `400`, `401`, `403`, `404`** — esses indicam problema no seu request que não vai se resolver com retry.

```
tentativa 1: imediata
tentativa 2: após 1s
tentativa 3: após 2s
tentativa 4: após 4s
tentativa 5: após 8s (desistir após esta)
```

Para `429`, respeite o header `Retry-After` se presente.

---

## Exemplos de código

### cURL

```bash
# Listar primeira página de entrevistas
curl -H "Authorization: Bearer sk_a1b2c3d4e5f67890abcdef1234567890" \
  "https://apisophia-632e2671412f.herokuapp.com/api/v1/interviews?page=1&limit=50"

# Obter última entrevista
curl -H "Authorization: Bearer sk_a1b2c3d4e5f67890abcdef1234567890" \
  "https://apisophia-632e2671412f.herokuapp.com/api/v1/interviews/latest"

# Listar todas as vagas
curl -H "Authorization: Bearer sk_a1b2c3d4e5f67890abcdef1234567890" \
  "https://apisophia-632e2671412f.herokuapp.com/api/v1/jobs"
```

### Node.js (fetch nativo, Node 18+)

```javascript
const API_BASE = 'https://apisophia-632e2671412f.herokuapp.com';
const API_KEY = process.env.INTERVIEWS_API_KEY;

async function fetchInterviews(page = 1, limit = 20) {
  const res = await fetch(
    `${API_BASE}/api/v1/interviews?page=${page}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${err.error || 'erro desconhecido'}`);
  }
  return res.json();
}

// Uso
const { data, pagination } = await fetchInterviews(1, 50);
console.log(`Página ${pagination.currentPage}/${pagination.totalPages}`);
data.forEach((interview) => {
  const when = new Date(interview.interview.created_at);
  console.log(
    `${when.toISOString()} — ${interview.candidate.name} — ${interview.job.position}`
  );
});
```

### Node.js — sincronização completa com paginação

```javascript
async function syncAllInterviews() {
  const results = [];
  let page = 1;
  const limit = 100; // máximo permitido

  while (true) {
    const { data, pagination } = await fetchInterviews(page, limit);
    results.push(...data);
    if (page >= pagination.totalPages) break;
    page++;
    // Respeitar rate limit: 120/min = ~500ms entre requests
    await new Promise((r) => setTimeout(r, 600));
  }
  return results;
}
```

### Node.js — polling para detectar novas entrevistas (recomendado)

Esta versão usa `/interviews?limit=10` em vez de `/latest`, e compara por `created_at`. Assim ela **não perde** entrevistas quando duas chegam entre dois polls.

```javascript
let lastSeenCreatedAt = null; // persista isso no seu banco entre reinícios

async function pollNewInterviews() {
  try {
    const { data } = await fetchInterviews(1, 10);
    // data já vem da mais recente para a mais antiga
    const novas = lastSeenCreatedAt
      ? data.filter((i) => i.interview.created_at > lastSeenCreatedAt)
      : data.slice(0, 1);

    // processar da mais antiga para a mais recente
    for (const interview of novas.reverse()) {
      console.log('Nova entrevista:', interview.id, interview.job.codigo);
      // ... processar
      lastSeenCreatedAt = interview.interview.created_at;
    }
  } catch (err) {
    console.error('Erro no polling:', err.message);
  }
}

// Polling a cada 60 segundos
setInterval(pollNewInterviews, 60_000);
pollNewInterviews();
```

> Comparar strings ISO 8601 em UTC com `>` funciona porque o formato é lexicograficamente ordenável. Se `novas.length === 10`, chegaram mais de 10 desde o último poll — puxe a página 2 ou aumente o `limit`.

### Node.js — polling simples com `/latest`

Adequado apenas quando o volume é baixo (uma entrevista a cada vários minutos, no máximo).

```javascript
let lastSeenId = null;

async function pollLatest() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/interviews/latest`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (res.status === 404) return; // nenhuma entrevista ainda
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { data } = await res.json();
    if (data.id !== lastSeenId) {
      lastSeenId = data.id;
      console.log('Nova entrevista detectada:', data.id);
      // ... processar
    }
  } catch (err) {
    console.error('Erro no polling:', err.message);
  }
}

setInterval(pollLatest, 60_000);
pollLatest();
```

### Python (requests)

```python
import os
import requests

API_BASE = "https://apisophia-632e2671412f.herokuapp.com"
API_KEY = os.environ["INTERVIEWS_API_KEY"]
HEADERS = {"Authorization": f"Bearer {API_KEY}"}


def fetch_interviews(page=1, limit=20):
    r = requests.get(
        f"{API_BASE}/api/v1/interviews",
        params={"page": page, "limit": limit},
        headers=HEADERS,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def fetch_all_interviews():
    results = []
    page = 1
    while True:
        payload = fetch_interviews(page=page, limit=100)
        results.extend(payload["data"])
        if page >= payload["pagination"]["totalPages"]:
            break
        page += 1
    return results


def fetch_latest():
    r = requests.get(f"{API_BASE}/api/v1/interviews/latest", headers=HEADERS, timeout=30)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()["data"]


def fetch_jobs():
    r = requests.get(f"{API_BASE}/api/v1/jobs", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()["data"]


def fetch_new_since(last_seen_created_at, limit=10):
    """Entrevistas mais novas que last_seen_created_at (ISO 8601 UTC)."""
    payload = fetch_interviews(page=1, limit=limit)
    novas = [i for i in payload["data"] if i["interview"]["created_at"] > last_seen_created_at]
    return list(reversed(novas))  # da mais antiga para a mais recente
```

### Python — retry com backoff exponencial

```python
import time
from requests.exceptions import HTTPError

RETRYABLE = {429, 500, 502, 503, 504}


def get_with_retry(url, max_attempts=5):
    delay = 1
    for attempt in range(1, max_attempts + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code in RETRYABLE:
                retry_after = int(r.headers.get("Retry-After", delay))
                time.sleep(retry_after)
                delay = min(delay * 2, 60)
                continue
            r.raise_for_status()
            return r.json()
        except HTTPError:
            if attempt == max_attempts:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise RuntimeError("Esgotadas as tentativas de retry")
```

---

## Boas práticas

### Sincronização incremental vs completa

- **Sincronização completa** (puxar tudo de novo): use para a carga inicial e para reconciliação semanal/mensal de auditoria.
- **Sincronização incremental** (apenas o novo): use no dia-a-dia. Guarde o `created_at` da entrevista mais recente que você processou e pare a paginação ao encontrar uma entrevista com `created_at` menor ou igual.

```javascript
async function syncIncremental(lastKnownCreatedAt) {
  let page = 1;
  const novas = [];

  while (true) {
    const { data, pagination } = await fetchInterviews(page, 100);
    for (const item of data) {
      if (item.interview.created_at <= lastKnownCreatedAt) return novas.reverse();
      novas.push(item);
    }
    if (page >= pagination.totalPages) return novas.reverse();
    page++;
    await new Promise((r) => setTimeout(r, 600));
  }
}
```

Comparar por `created_at` em vez de por `id` é mais robusto: funciona mesmo que a entrevista de referência seja apagada.

### Cache de vagas

A lista de vagas (`/api/v1/jobs`) muda com baixa frequência. Cacheie por 5–15 minutos localmente para reduzir requisições.

### Aguardando o processamento da IA

Uma entrevista recém-coletada pode aparecer com `overall_score`, `strengths`, `development_points` e `ai_summary` como `null`. O processamento pela IA leva alguns minutos. Estratégias:

1. **Polling pelo ID:** depois de detectar uma entrevista nova, refaça a busca periodicamente até `overall_score` deixar de ser `null`. (Hoje não há endpoint por ID; use `/interviews?limit=N` e filtre pelo `id`.)
2. **Reprocessamento assíncrono no seu lado:** marque a entrevista como "pendente" no seu sistema e reprocesse quando os campos preencherem.

### Charset e encoding

Garanta que seu cliente HTTP e seu banco de destino estejam em UTF-8. Os campos `cidade`, `logradouro`, etc. contêm acentos e cedilhas. Configurações de locale latin1/iso-8859-1 vão corromper esses dados.

### Logs e privacidade

**Não logue payload completo de entrevistas** em arquivos de log persistentes. Campos como CPF, email e telefone caem sob LGPD. Logue apenas o `id` da entrevista e métricas agregadas.

---

## LGPD e proteção de dados

A API retorna dados pessoais e sensíveis de candidatos. Ao consumir esta API, você assume responsabilidades como operador (ou controlador, dependendo da relação contratual) sob a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).

### Dados pessoais expostos

- **Identificação:** nome, e-mail, telefone, CPF.
- **Localização:** CEP, endereço completo.
- **Avaliação:** score, pontos fortes/fracos, resumo de IA.
- **Multimídia:** link para vídeo da entrevista.

### Suas responsabilidades

1. **Base legal:** garanta que existe base legal válida para tratar esses dados (geralmente consentimento ou execução de contrato).
2. **Finalidade:** use os dados apenas para a finalidade prevista (avaliação de candidatos para processos seletivos).
3. **Minimização:** não copie dados que você não vai usar.
4. **Retenção:** defina prazo de retenção no seu sistema e expurgue dados após o término do processo seletivo (ou conforme política da sua empresa).
5. **Segurança:** criptografe em repouso, restrinja acesso, mantenha logs de auditoria.
6. **Direitos do titular:** implemente processo para atender solicitações dos candidatos (acesso, correção, exclusão, portabilidade).
7. **Revisão de decisões automatizadas (Art. 20):** o score e a avaliação por IA são decisões automatizadas. O candidato tem direito a solicitar revisão por pessoa natural. Garanta esse processo no seu fluxo.

### Recomendações técnicas

- Mascare CPF, email e telefone em interfaces que não exijam o dado completo.
- **Acesso por papel:** nem todo usuário do seu sistema precisa ver dados de candidato. Aplique RBAC.
- **Audit log:** registre quem acessou qual entrevista.
- **DPA / contrato:** formalize o tratamento de dados em contrato com o operador da API.
- **Ao pedir suporte, nunca envie prints ou payloads com dados de candidato** (por email, WhatsApp, tickets). Envie apenas o `id` da entrevista — com ele localizamos tudo.

---

## Versionamento e changelog

### Política de versionamento

A API segue SemVer. O caminho da URL inclui a major version (`/api/v1/`).

- **Patch (2.1.x)** — correções de bug sem alteração de contrato. Não exige ação do cliente.
- **Minor (2.x.0)** — novos campos opcionais nas respostas, novos endpoints. Não quebra clientes existentes.
- **Major (x.0.0)** — mudanças incompatíveis. Quando ocorrer, será lançada como `/api/v2/` e a v1 ficará disponível por período mínimo de transição de 6 meses, com aviso prévio.

### Changelog

**2.1.0 (atual) — Setembro/2026**

Corrigido:
- `/interviews` e `/interviews/latest` ordenavam por `interview.date` (string), produzindo ordem textual em vez de cronológica. `/latest` podia devolver uma entrevista antiga como "última" e a paginação vinha fora de ordem. Ambos passam a ordenar por `created_at`, com desempate determinístico por `id`.

Adicionado:
- Campo `interview.created_at` (ISO 8601, UTC) em `/interviews` e `/interviews/latest`.
- `/health` retorna `version` e `auth_mode`.

Documentação:
- `interview.date` estava documentado como horário de `America/Sao_Paulo`. **É UTC.** Corrigido, e o campo passa a ser considerado legado.
- URL de produção incluída.
- Esclarecimento sobre `id` (entrevista) vs `job.codigo` (vaga).
- Exemplos de polling e sync incremental reescritos sobre `created_at`.

Segurança:
- Validação de formato da API key (`sk_` + 32 hex) antes de consultar o banco.

**2.0.0 — Maio/2026**

Adicionado:
- Em `/interviews` e `/interviews/latest`: campos `candidate.phone`, `candidate.cpf`, `candidate.video_url`, endereço completo (`candidate.address.*`), `job.codigo`, `interview.core10_link`.
- Em `/jobs`: campos `nice_to_have`, `codigo`, `testecomportamental`, `anexar_curriculo_obrigatorio`, `divulgar`, `perguntavideo`, `video`, `log_cargos`.
- Endpoint `/health` real (pinga o banco).
- Headers de rate limit nas respostas (RFC draft 7).

Alterado (breaking):
- `/interviews/latest` agora envelopa em `{ "data": {...} }` (antes: objeto cru).
- `/jobs` agora envelopa em `{ "data": [...] }` (antes: array cru).
- `/interviews/latest` retorna `404` quando não há entrevistas (antes: `500`).
- `/interviews` retorna `400` quando `page` ou `limit` são inválidos (antes: comportamento indefinido).
- `limit` máximo é agora 100 (antes: ilimitado).

Segurança:
- Rate limiting habilitado.
- Headers HTTP de segurança (helmet).
- CORS configurável por whitelist.

**1.1.0**
- Adicionada paginação em `/interviews`.
- Adicionado endpoint `/interviews/latest`.

**1.0.0**
- Versão inicial.

---

## Suporte

### Canais

**Reportar bug ou comportamento inesperado:** envie email para o contato técnico da sua conta com:
- Endpoint chamado
- Timestamp aproximado (com timezone)
- Status HTTP recebido
- **`id` da entrevista** envolvida (não envie o payload — ele contém dados pessoais)
- **Não inclua sua API key** no email.

**Rotação de API key:** solicite via canal oficial. A rotação é imediata; a chave antiga deixa de funcionar.

**Aumento de rate limit:** rate limits podem ser ajustados sob demanda mediante justificativa.

### Antes de abrir um chamado

Verifique:

1. **A URL base está correta?** Faça `GET https://apisophia-632e2671412f.herokuapp.com/` e confirme que `status: "online"` é retornado.
2. **O banco está saudável?** Faça `GET /health`.
3. **A API key está válida?** O retorno `403` em todas as rotas confirma problema de credencial. Confira o comprimento (35 caracteres).
4. **O `codigo_cliente` está correto?** Listas vazias podem indicar que a chave pertence a um cliente sem dados, não a um bug.
5. **A "última entrevista" parece errada?** Confirme que está na 2.1.0 (`GET /` mostra `version`). Compare `interview.created_at` do que recebeu com o que esperava.

### SLA e disponibilidade

A API depende do Supabase e da plataforma de hospedagem (Heroku). Em caso de incidente do provedor, podem ocorrer indisponibilidades. Acompanhe o status pelas páginas oficiais:

- Supabase: https://status.supabase.com
- Heroku: https://status.heroku.com

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **API key** | Chave secreta no formato `sk_<32 chars hex>` usada para autenticar requisições. |
| **codigo_cliente** | Identificador único da sua empresa no nosso sistema. Sua chave está vinculada a um único `codigo_cliente`. |
| **codigo (de vaga)** | Identificador legível da **vaga**, no formato `<PREFIXO>-<NUMERO>` (ex: `STAR-DIROP`). Uma vaga tem várias entrevistas. |
| **interview_uuid / id** | Identificador único universal de **uma entrevista**. Use como chave de correlação. |
| **created_at** | Instante de registro da entrevista, ISO 8601 em UTC. Campo de referência para ordenação e sincronização. |
| **Core10** | Sistema de avaliação comportamental aplicado durante a entrevista. O `core10_link` aponta para o relatório detalhado. |
| **Polling** | Técnica de consultar periodicamente um endpoint para detectar mudanças. |
| **Rate limit** | Limite de requisições permitidas em uma janela de tempo. |