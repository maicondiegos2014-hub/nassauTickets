# Requisitos Funcionais (RF)

*   **RF01 - Emissão de Senha:** O sistema deve permitir a emissão de três tipos de senha: Senha Prioritária (SP), Senha Geral (SG) e Senha para retirada de Exames (SE). A emissão deve ser feita de forma anônima pelo cliente no totem.
*   **RF02 - Numeração de Senha:** O sistema deve gerar a numeração da senha seguindo o padrão `YYMMDD-PPSQ`. A composição indica ano, mês, dia, tipo da senha e sequência de prioridade com três dígitos (com reinício diário).
*   **RF03 - Painel de Chamadas:** O painel deve exibir visualmente as 5 últimas senhas chamadas. A próxima senha não deve aparecer no painel antes de ser ativamente chamada pelo atendente.
*   **RF04 - Áudio da Chamada:** O sistema deve emitir um aviso em áudio durante a chamada no painel, informando a prioridade, a senha e o guichê.
*   **RF05 - Ações do Atendente:** O sistema deve permitir ao atendente logado chamar uma nova senha. O atendente também deve conseguir iniciar o atendimento, finalizar o atendimento ou chamar a senha novamente.
*   **RF06 - Chamada de Abandono (Última Chamada):** Ao utilizar a função de chamar novamente, o sistema deve repetir o áudio adicionando a indicação de "Última chamada". Caso a senha não seja atendida após essa segunda chamada, deve ser considerada abandonada (estado `NÃO_COMPARECEU`).
*   **RF07 - Máquina de Estados:** As senhas devem transitar obrigatoriamente pelos seguintes estados: EMITIDA, AGUARDANDO, CHAMADA, CHAMADA_NOVAMENTE, EM ATENDIMENTO e ATENDIDA (ou NÃO_COMPARECEU).
*   **RF08 - Gestão de Expediente:** O sistema deve descartar automaticamente as senhas que permanecerem na fila ao final do expediente (após as 17h).
*   **RF09 - Relatórios de Atendimento:** O sistema deve fornecer relatórios diários e mensais com o quantitativo geral e por prioridade de senhas emitidas e atendidas. O sistema deve informar o tempo médio de atendimento e exibir um relatório detalhado com os dados de cada senha e guichê.
*   **RF10 - Relatório de Auditoria:** O sistema deve registrar em auditoria o atendente, guichê, senha, horário da primeira e segunda chamada (se houver), e horários de início e término do atendimento.
*   **RF11 - Gestão de Acesso:** O sistema deve possuir módulo de login exclusivo para o agente atendente. Deve existir um perfil com privilégios adicionais de gestor para cadastros e relatórios.