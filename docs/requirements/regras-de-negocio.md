# Regras de Negócio — nassauTickets

Este documento apresenta as principais regras de negócio do sistema nassauTickets.

## RN01 — Tipos de Senha

O sistema deve trabalhar com três tipos de senha:

- SP — Senha Prioritária;
- SG — Senha Geral;
- SE — Senha para retirada de Exames.

## RN02 — Ordem de Prioridade

A chamada das senhas deve seguir a sequência de prioridade:

`[SP] → [SE ou SG] → [SP] → [SE ou SG]`

A senha SP possui prioridade máxima.

Entre as senhas SE e SG, a senha SE deve ser atendida preferencialmente.

## RN03 — Ordem dentro da mesma prioridade

Quando existirem várias senhas do mesmo tipo aguardando atendimento, deverá ser chamada primeiro a senha emitida há mais tempo.

## RN04 — Segunda Chamada

Caso o cliente não compareça após a primeira chamada, o atendente poderá realizar uma segunda chamada.

Na segunda chamada, o sistema deverá informar no painel e no áudio que se trata da **"Última chamada"**.

## RN05 — Não Comparecimento

Caso o cliente não compareça após duas chamadas, a senha deverá ser considerada como não atendida e assumir o estado:

`NÃO_COMPARECEU`

## RN06 — Percentual de Não Comparecimento

Para fins de simulação do sistema, aproximadamente 5% das senhas emitidas poderão ser consideradas como não comparecimento.

## RN07 — Horário de Funcionamento

O horário de funcionamento do atendimento será das **07:00 às 17:00**.

Após as 17:00, novas senhas não deverão ser emitidas.

## RN08 — Atendimento em Andamento

Caso um atendimento tenha sido iniciado antes das 17:00, ele poderá ser concluído normalmente mesmo após o encerramento do horário de funcionamento.

## RN09 — Senhas Restantes na Fila

Ao final do expediente, as senhas que permanecerem aguardando atendimento deverão ser descartadas da fila.

## RN10 — Numeração das Senhas

As senhas deverão seguir o padrão:

`YYMMDD-PPSQ`

Onde:

- `YY` representa o ano;
- `MM` representa o mês;
- `DD` representa o dia;
- `PP` representa o tipo da senha (SP, SG ou SE);
- `SQ` representa a sequência numérica diária.

A sequência deverá ser reiniciada a cada novo dia.