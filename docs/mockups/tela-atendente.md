# Mockup — Tela do Atendente

## Objetivo

A tela do atendente permite controlar o fluxo de chamadas e atendimentos das senhas.

O atendente poderá chamar uma nova senha, chamar novamente uma senha, iniciar o atendimento e finalizar o atendimento.

## Estrutura da tela

```text
┌─────────────────────────────────────────────────────────┐
│                    nassauTickets                        │
│                 PAINEL DO ATENDENTE                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ATENDENTE: João Silva                                 │
│  GUICHÊ: 03                                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  SENHA ATUAL                           │
│                                                         │
│                    SP001                                │
│                                                         │
│                 Status: CHAMADA                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │   CHAMAR PRÓXIMA     │  │   CHAMAR NOVAMENTE     │  │
│  └──────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │ INICIAR ATENDIMENTO  │  │  FINALIZAR ATENDIMENTO  │  │
│  └──────────────────────┘  └────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                  ÚLTIMAS CHAMADAS                      │
│                                                         │
│      SENHA             GUICHÊ                          │
│      SP001               03                            │
│      SG002               01                            │
│      SE001               02                            │
│                                                         │
└─────────────────────────────────────────────────────────┘