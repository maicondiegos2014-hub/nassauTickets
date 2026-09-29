# Diagrama de Casos de Uso

```mermaid
flowchart LR
    AC((Agente Cliente))
    AA((Agente Atendente))
    AS((Agente Sistema))

    UC1([Emitir senha pelo totem])
    UC2([Chamar próxima senha])
    UC3([Iniciar atendimento])
    UC4([Chamar novamente])
    UC5([Finalizar atendimento])
    UC6([Atualizar painel e áudio])
    UC7([Consultar relatórios])

    AC ---> UC1

    AA ---> UC2
    AA ---> UC3
    AA ---> UC4
    AA ---> UC5
    AA ---> UC7

    UC1 -.-> AS
    UC2 -.-> AS
    UC4 -.-> AS
    AS ---> UC6