# Projeto - Modelagem Estatística
### Equipe:
Enzo Brito, Fernando Fonseca e Brenda Nascimento.

---

## Sobre o Projeto

Este projeto é o trabalho avaliativo da disciplina de **Modelagem Estatística**. Ele aplica **análise descritiva, testes de hipóteses, intervalos de confiança e regressão linear** a um conjunto de dados real de recursos humanos, com o objetivo de identificar padrões e propor soluções práticas apoiadas em evidência estatística.

O tema é a **rotatividade de funcionários (*attrition*)**: o desligamento de pessoas gera custo de reposição, perda de conhecimento e queda de produtividade. Entender **quem sai**, **em quais condições** e **se a remuneração explica a saída** ajuda a empresa a decidir onde agir.

O projeto entrega:

- um **notebook em Python** que documenta todo o processo (limpeza, engenharia de variáveis, exploração, testes, regressão, conclusões);
- um **dashboard interativo** que permite explorar os dados e refazer testes e previsões a partir de filtros.

### Perguntas que orientam a análise

1. Qual a taxa geral de saída e em quais grupos de funcionários ela é maior?
2. Fazer hora extra está associado à saída? Qual o tamanho dessa diferença e com que precisão ela é estimada?
3. Quem sai ganha menos do que quem fica? E, mais importante, quem sai está **mal pago para o próprio perfil** (nível, idade, carreira)?
4. Quais variáveis explicam a renda mensal e com que precisão é possível prever a renda de um novo perfil?

---

## Dataset

**Nome:** IBM HR Analytics Employee Attrition & Performance
**Arquivo:** `WA_Fn-UseC_-HR-Employee-Attrition.csv`
**Origem:** conjunto de dados público, criado por cientistas de dados da IBM e disponibilizado na plataforma Kaggle. Os dados são **fictícios (sintéticos)**, construídos para simular o cenário de RH de uma empresa.

| Característica | Valor |
| :--- | :--- |
| Registros (funcionários) | 1.470 |
| Variáveis | 35 (31 após a limpeza) |
| Variável de interesse | `Attrition` (Yes/No) |
| Saídas | 237 (≈ 16,1%) contra 1.233 que permaneceram |
| Valores ausentes | 0 |
| Linhas duplicadas | 0 |
| Colunas sem variação | 3 (`EmployeeCount`, `Over18`, `StandardHours`), removidas junto com o identificador `EmployeeNumber` |

### Grupos de variáveis

| Grupo | Exemplos |
| :--- | :--- |
| Perfil do funcionário | `Age`, `Gender`, `MaritalStatus`, `Education`, `EducationField` |
| Cargo e carreira | `Department`, `JobRole`, `JobLevel`, `TotalWorkingYears`, `YearsAtCompany`, `YearsInCurrentRole`, `YearsSinceLastPromotion`, `YearsWithCurrManager`, `NumCompaniesWorked` |
| Remuneração | `MonthlyIncome`, `DailyRate`, `HourlyRate`, `MonthlyRate`, `PercentSalaryHike`, `StockOptionLevel` |
| Condições de trabalho | `OverTime`, `BusinessTravel`, `DistanceFromHome`, `WorkLifeBalance`, `TrainingTimesLastYear` |
| Satisfação e desempenho | `JobSatisfaction`, `EnvironmentSatisfaction`, `RelationshipSatisfaction`, `JobInvolvement`, `PerformanceRating` |

### Por que esta base

- Tem uma variável de interesse com **relevância gerencial** (a saída do funcionário), que permite formular hipóteses e propor ações.
- Combina variáveis **numéricas contínuas** (renda, idade, tempo de casa) e **categóricas** (hora extra, estado civil, cargo), o que permite usar testes de médias, testes de proporções, qui-quadrado e regressão linear no mesmo problema.
- Está limpa o bastante para focar na modelagem, mas exige decisões metodológicas reais (outliers de renda, variáveis constantes, assimetria, heterocedasticidade).

### Limitação a ter em mente

Por ser uma base sintética e observacional (um único momento no tempo), os resultados indicam **associações**, não relações de causa e efeito, e a generalização para empresas reais é limitada.

---

## Visão Geral da Análise

O notebook está organizado em oito seções:

1. **Limpeza e preparação:** ausentes, duplicadas, colunas constantes, inconsistências e outliers.
2. **Engenharia de variáveis:** flags, faixas, índice de estagnação e renda em log.
3. **Análise exploratória:** taxa de saída por grupo, distribuições e correlações.
4. **Testes de hipóteses e intervalos de confiança:** hora extra, renda, idade e estado civil.
5. **Regressão linear múltipla:** renda mensal como variável dependente, avaliação e diagnóstico de pressupostos, previsão.
6. **Integração:** o resíduo da regressão (`IncomeGap`) alimenta um novo teste de hipótese.
7. **Impacto das soluções:** estimativa de saídas evitáveis com a redução da hora extra.
8. **Conclusões e limitações.**

---

## Estrutura

```text
projetoEstatistica/
├── Notebook_Projeto_Estatistica.ipynb     # Notebook analítico documentado
├── WA_Fn-UseC_-HR-Employee-Attrition.csv  # Base de dados (1.470 registros, IBM HR Analytics)
├── app.py                                 # Backend em Python (API REST + Servidor HTTP Multi-thread)
│
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
