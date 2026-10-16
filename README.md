# Projeto - Modelagem Estatística 

---

## Estrutura

```text
projetoEstatistica/
├── Notebook_Projeto_Estatistica.ipynb     # Notebook analítico documentado
├── WA_Fn-UseC_-HR-Employee-Attrition.csv  # Base de dados (1.470 registros, IBM HR Analytics)
├── app.py                                 # Backend em Python (API REST + Servidor HTTP Multi-thread) 
├                                   
├── frontend/                              # Interface do Dashboard 
│   ├── index.html                         
│   ├── style.css                          
│   └── app.js                             
└── README.md                              # Documentação e instruções de execução
```

---

## Como Executar o Projeto : 

### 1. Pré-requisitos
Certifique-se de que o Python 3.10+ e as bibliotecas estejam instalados no ambiente:
```bash
pip install pandas numpy scipy scikit-learn matplotlib seaborn
```

### 2. Execução do Dashboard 
Para iniciar o servidor backend e abrir no navegador:
```bash
python app.py
```
O servidor será iniciado na porta **8000**. Em seguida, abra no navegador:
  **[http://localhost:8000](http://localhost:8000)**

### 3. Execução do Notebook em Python
Abra o arquivo `Notebook_Projeto_Estatistica.ipynb` no VS Code, Jupyter Lab ou Jupyter Notebook e execute todas as células (`Run All`).

---

## Critérios da lauda e como atendemos.

| Requisito da Lauda | Como foi Atendido no Projeto |
| :--- | :--- |
| **Limpeza e Tratamento de Ausentes** | Remoção de colunas com variância zero (`EmployeeCount`, `Over18`, `StandardHours`) e ID; imputação defensiva por mediana (robusta a assimetria) e moda; conferência de inconsistências e outliers pelo critério do IQR. |
| **Engenharia de Variáveis** | Criação de flags binárias (`AttritionFlag`, `OverTimeFlag`), faixas (`AgeGroup`, `TenureBand`), métrica de estagnação (`PromotionStagnation`), escala logarítmica (`LogIncome`) e resíduo do modelo (`IncomeGap`). |
| **Testes de Hipóteses & Intervalos de Confiança** | Implementação de 5 testes formais com $\alpha = 0,05$: Teste $z$ e Qui-Quadrado para proporções (H1); Teste $t$ de Welch e Mann-Whitney para médias de renda (H2); Teste de Welch para idade (H3); Teste $\chi^2$ e $V$ de Cramér para estado civil (H4); Teste de Welch sobre o `IncomeGap` (H5). Intervalos de Wilson e de Welch a 95%. |
| **Regressão Linear Múltipla** | Implementação analítica de MQO via álgebra linear matricial ($(X'X)^{-1}X'y$); cálculo de erros-padrão, estatística $t$, p-valores, IC 95% para coeficientes, $R^2$ ($0,9081$), $R^2$ ajustado, teste F global, $R^2$ de teste ($0,8944$) e validação cruzada 5-fold ($0,9036$). |
| **Diagnóstico de Pressupostos** | Teste de Breusch-Pagan para homocedasticidade; Shapiro-Wilk e gráfico Q-Q para normalidade dos resíduos; VIF para multicolinearidade (todos $< 5$); comparação com modelo log-linear. |
| **Previsão de Valores Futuros** | Simulador interativo com cálculo do Intervalo de Confiança da Média (95%) e do **Intervalo de Predição Individual (95%)**, incorporando a variância do erro individual $\sigma^2(1 + \mathbf{x}_0'(X'X)^{-1}\mathbf{x}_0)$. |
| **Dashboard Interativo** | Painel completo com filtros dinâmicos, gráficos com objetivos claros definidos, simulador preditivo em tempo real, dimensionador de políticas e tabela de dados paginada. |
| **Restrição: Sem Textos com Insights Prontos no Dashboard** | O dashboard não contém textos enviesados ou conclusões pré-mastigadas; cada visualização possui objetivo metodológico explícito e métricas numéricas puras para que o usuário explore e tire suas próprias conclusões. |
| **Restrição: Código do Notebook sem Comentários** | Todas as células de código do notebook foram entregues **estritamente sem comentários inline (`# ...`)**, ficando todas as justificativas concentradas nas células de Markdown. |
| **Soluções Práticas e Limitações** | Dimensionamento do impacto da redução de hora extra ($83,6$ saídas evitadas; IC 95%: $[63,6; 103,5]$) e discussão aprofundada de limitações na Seção 8 do notebook. |
