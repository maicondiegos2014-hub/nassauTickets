# Modelo Entidade-Relacionamento — nassauTickets

## Diagrama MER

```mermaid
erDiagram

    ATENDENTE ||--o{ CHAMADA : realiza
    GUICHE ||--o{ CHAMADA : utiliza
    SENHA ||--o{ CHAMADA : possui

    SENHA ||--o| ATENDIMENTO : possui
    ATENDENTE ||--o{ ATENDIMENTO : realiza
    GUICHE ||--o{ ATENDIMENTO : ocorre

    ATENDENTE {
        int id_atendente PK
        varchar nome
        varchar login UK
        varchar senha
        varchar perfil
        boolean ativo
    }

    GUICHE {
        int id_guiche PK
        int numero
        boolean ativo
    }

    SENHA {
        int id_senha PK
        varchar numero UK
        varchar tipo
        varchar status
        date data_emissao
        time hora_emissao
        datetime emitida_em
    }

    CHAMADA {
        int id_chamada PK
        int id_senha FK
        int id_atendente FK
        int id_guiche FK
        int numero_chamada
        datetime chamada_em
        varchar observacao
    }

    ATENDIMENTO {
        int id_atendimento PK
        int id_senha FK
        int id_atendente FK
        int id_guiche FK
        datetime inicio_atendimento
        datetime fim_atendimento
    }
```

## Entidades

### ATENDENTE

Representa o funcionário responsável por realizar os atendimentos no sistema.

### GUICHE

Representa o guichê utilizado pelo atendente durante o atendimento.

### SENHA

Representa a senha emitida pelo totem para o cliente.

Tipos de senha:

- SP — Senha Prioritária
- SG — Senha Geral
- SE — Senha para retirada de Exames

### CHAMADA

Registra cada chamada realizada pelo atendente para uma determinada senha.

Uma senha pode ser chamada mais de uma vez.

### ATENDIMENTO

Registra o atendimento efetivamente iniciado e finalizado pelo atendente.

## Estados da senha

A senha deverá seguir a seguinte sequência:

EMITIDA  
↓  
AGUARDANDO  
↓  
CHAMADA  
↓  
CHAMADA_NOVAMENTE  
↓  
EM_ATENDIMENTO  
↓  
ATENDIDA

Também poderá assumir o estado:

NÃO_COMPARECEU