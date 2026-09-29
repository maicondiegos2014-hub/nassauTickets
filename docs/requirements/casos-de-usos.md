# Casos de Uso (UC)

## Atores do Sistema
*   **AC (Agente Cliente):** Interage com o sistema por meio do totem de forma anônima e aguarda o atendimento visualizando o painel.
*   **AA (Agente Atendente):** Possui acesso logado ao sistema. É responsável por manipular a fila chamando clientes e registrando os estados do atendimento no guichê. Um atendente pode ter perfil de gestor.
*   **AS (Agente Sistema):** Entidade computacional que executa regras invisíveis, comunica-se com banco de dados, emite senhas físicas/virtuais e atualiza painéis.

## Lista de Casos de Uso

*   **UC01 - Emitir Senha (AC):** O Agente Cliente seleciona no totem a opção de atendimento desejada (SP, SG ou SE). O AS registra a nova entrada e imprime/retorna a senha no formato `YYMMDD-PPSQ`, colocando-a no estado `EMITIDA` e depois `AGUARDANDO`.
*   **UC02 - Chamar Próxima Senha (AA):** O Agente Atendente clica no botão para chamar o próximo cliente para seu guichê. O AS calcula a fila baseado nas regras de concorrência e prioridade, movendo a senha do topo para o estado `CHAMADA`.
*   **UC03 - Atualizar Painel e Áudio (AS):** O Agente Sistema recebe o gatilho do UC02. Ele atualiza o painel exibindo as 5 últimas senhas. Em seguida, reproduz o áudio detalhando prioridade, número da senha e guichê de destino.
*   **UC04 - Iniciar Atendimento (AA):** Quando o cliente chega ao guichê, o Agente Atendente registra o início, e o AS transita o estado da senha para `EM ATENDIMENTO`. Este evento alimenta a base de auditoria com a hora de início.
*   **UC05 - Finalizar Atendimento (AA):** Após concluir a necessidade do cliente, o Agente Atendente encerra a sessão. O AS muda o estado da senha para `ATENDIDA` e registra a hora de término na auditoria.
*   **UC06 - Chamar Novamente e Registrar Abandono (AA):** Caso o cliente não se apresente, o Agente Atendente clica em chamar novamente. O AS emite um áudio informando "Última chamada". Se o tempo expirar novamente, o Atendente ou o AS move a senha para o estado `NÃO_COMPARECEU`.
*   **UC07 - Emitir e Visualizar Relatórios (AA/Gestor):** O atendente logado (com perfil gestor) acessa a área de relatórios. O AS retorna as tabelas contendo as métricas diárias e mensais, incluindo totais de senhas, tempos médios e auditoria detalhada de horários e guichês.
*   **UC08 - Manutenção da Fila Diária (AS):** Após às 17h (fim do expediente), o Agente Sistema identifica senhas não atendidas no banco de dados e as descarta ou limpa da fila principal automaticamente.