# Modelo Entidade-Relacionamento — nassauTickets

Esta pasta contém os artefatos relacionados ao Modelo Entidade-Relacionamento (MER) do sistema nassauTickets.

## Arquivos

### diagrama-mer.md

Contém o diagrama Entidade-Relacionamento do sistema, apresentando as principais entidades, atributos e relacionamentos.

### modelo-logico.md

Apresenta as tabelas do banco de dados, seus atributos, tipos de dados, chaves primárias, chaves estrangeiras e relacionamentos.

### dicionario-de-dados.md

Apresenta a descrição dos campos e das entidades utilizadas no banco de dados.

## Entidades principais

O modelo é composto pelas seguintes entidades:

- ATENDENTE
- GUICHE
- SENHA
- CHAMADA
- ATENDIMENTO

## Objetivo

O modelo foi desenvolvido para representar a estrutura de dados necessária para o funcionamento do sistema nassauTickets.

O modelo contempla:

- emissão de senhas;
- tipos de senha;
- chamadas;
- atendimentos;
- atendentes;
- guichês;
- estados das senhas;
- registro de horários;
- informações necessárias para auditoria e relatórios.

## Tipos de senha

O sistema possui três tipos de senha:

- SP — Senha Prioritária;
- SG — Senha Geral;
- SE — Senha para retirada de Exames.

## Estados da senha

As senhas podem possuir os seguintes estados:

- EMITIDA;
- AGUARDANDO;
- CHAMADA;
- CHAMADA_NOVAMENTE;
- EM_ATENDIMENTO;
- ATENDIDA;
- NÃO_COMPARECEU.

## Observação

O cliente não é cadastrado como entidade no banco de dados, pois sua interação com o sistema ocorre de forma anônima por meio do totem.