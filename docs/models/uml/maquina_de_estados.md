# Máquina de Estados da Senha

O diagrama abaixo ilustra o ciclo de vida de uma senha no sistema, conforme os requisitos do projeto.

```mermaid
stateDiagram-v2
    [*] --> EMITIDA : Cliente solicita no totem
    EMITIDA --> AGUARDANDO : Sistema regista na fila
    AGUARDANDO --> CHAMADA : Atendente chama próxima senha
    CHAMADA --> EM_ATENDIMENTO : Cliente comparece ao guichê
    CHAMADA --> CHAMADA_NOVAMENTE : Cliente não comparece de imediato
    CHAMADA_NOVAMENTE --> EM_ATENDIMENTO : Cliente comparece após 2ª chamada
    CHAMADA_NOVAMENTE --> NÃO_COMPARECEU : Cliente não aparece (abandono)
    EM_ATENDIMENTO --> ATENDIDA : Atendente finaliza o processo
    ATENDIDA --> [*]
    NÃO_COMPARECEU --> [*]