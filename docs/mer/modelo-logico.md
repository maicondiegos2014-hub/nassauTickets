# Modelo Lógico do Banco de Dados — nassauTickets

## Tabela: ATENDENTE

| Campo | Tipo | Chave | Descrição |
|---|---|---|---|
| id_atendente | INT | PK | Identificador único do atendente |
| nome | VARCHAR(100) | - | Nome do atendente |
| login | VARCHAR(50) | UNIQUE | Login utilizado para acesso ao sistema |
| senha | VARCHAR(255) | - | Senha armazenada de forma segura |
| perfil | VARCHAR(20) | - | Perfil do usuário |
| ativo | BOOLEAN | - | Indica se o usuário está ativo |

## Tabela: GUICHE

| Campo | Tipo | Chave | Descrição |
|---|---|---|---|
| id_guiche | INT | PK | Identificador único do guichê |
| numero | INT | UNIQUE | Número do guichê |
| ativo | BOOLEAN | - | Indica se o guichê está disponível |

## Tabela: SENHA

| Campo | Tipo | Chave | Descrição |
|---|---|---|---|
| id_senha | INT | PK | Identificador único da senha |
| numero | VARCHAR(20) | UNIQUE | Número completo da senha |
| tipo | VARCHAR(2) | - | Tipo da senha: SP, SG ou SE |
| status | VARCHAR(30) | - | Estado atual da senha |
| data_emissao | DATE | - | Data de emissão |
| hora_emissao | TIME | - | Hora de emissão |
| emitida_em | DATETIME | - | Data e hora da emissão |

## Tabela: CHAMADA

| Campo | Tipo | Chave | Descrição |
|---|---|---|---|
| id_chamada | INT | PK | Identificador único da chamada |
| id_senha | INT | FK | Senha chamada |
| id_atendente | INT | FK | Atendente responsável pela chamada |
| id_guiche | INT | FK | Guichê utilizado na chamada |
| numero_chamada | INT | - | Número da chamada realizada |
| chamada_em | DATETIME | - | Data e hora da chamada |
| observacao | VARCHAR(255) | - | Observações da chamada |

## Tabela: ATENDIMENTO

| Campo | Tipo | Chave | Descrição |
|---|---|---|---|
| id_atendimento | INT | PK | Identificador único do atendimento |
| id_senha | INT | FK | Senha atendida |
| id_atendente | INT | FK | Atendente responsável |
| id_guiche | INT | FK | Guichê onde ocorreu o atendimento |
| inicio_atendimento | DATETIME | - | Data e hora do início |
| fim_atendimento | DATETIME | - | Data e hora da finalização |

## Relacionamentos

- Um atendente pode realizar várias chamadas.
- Uma chamada pertence a um único atendente.
- Um guichê pode ser utilizado em várias chamadas.
- Uma chamada ocorre em um único guichê.
- Uma senha pode possuir várias chamadas.
- Uma chamada pertence a uma única senha.
- Uma senha pode possuir no máximo um atendimento.
- Um atendimento pertence a uma única senha.
- Um atendente pode realizar vários atendimentos.
- Um atendimento é realizado por um único atendente.
- Um guichê pode receber vários atendimentos.
- Um atendimento ocorre em um único guichê.