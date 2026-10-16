import json
import os
import sys
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import pandas as pd
import numpy as np
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

CSV_FILE = "WA_Fn-UseC_-HR-Employee-Attrition.csv"
PORT = 8000
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

print(f"Carregando dataset de {CSV_FILE}...")
raw_df = pd.read_csv(CSV_FILE)

constantes = [c for c in raw_df.columns if raw_df[c].nunique() == 1]
cols_to_drop = constantes + ["EmployeeNumber"] if "EmployeeNumber" in raw_df.columns else constantes
df = raw_df.drop(columns=cols_to_drop).copy()

num_cols = df.select_dtypes("number").columns.tolist()
cat_cols = df.columns.difference(num_cols).tolist()
for c in num_cols:
    df[c] = df[c].fillna(df[c].median())
for c in cat_cols:
    df[c] = df[c].fillna(df[c].mode().iloc[0])

df["AttritionFlag"] = (df.Attrition == "Yes").astype(int)
df["OverTimeFlag"] = (df.OverTime == "Yes").astype(int)
df["AgeGroup"] = pd.cut(df.Age, [17, 25, 35, 45, 55, 65], labels=["18-25", "26-35", "36-45", "46-55", "56+"]).astype(str)
df["TenureBand"] = pd.cut(df.YearsAtCompany, [-1, 1, 3, 5, 10, 40], labels=["0-1", "2-3", "4-5", "6-10", "11+"]).astype(str)
df["PromotionStagnation"] = df.YearsSinceLastPromotion / (df.YearsAtCompany + 1)
df["LogIncome"] = np.log(df.MonthlyIncome)

reg_feats = ["Age", "JobLevel", "TotalWorkingYears", "YearsAtCompany", "YearsSinceLastPromotion"]
X_all = df[reg_feats]
y_all = df["MonthlyIncome"]

X_tr, X_te, y_tr, y_te = train_test_split(X_all, y_all, test_size=0.2, random_state=42)

A_tr = np.column_stack([np.ones(len(X_tr)), X_tr.values])
n_tr, k_tr = A_tr.shape
gl_tr = n_tr - k_tr
inv_tr = np.linalg.inv(A_tr.T @ A_tr)
beta = inv_tr @ A_tr.T @ y_tr.values
res_tr = y_tr.values - A_tr @ beta
s2 = float((res_tr @ res_tr) / gl_tr)
se = np.sqrt(np.diag(inv_tr) * s2)
t_stats = beta / se
p_vals = 2 * stats.t.sf(np.abs(t_stats), gl_tr)
tc = float(stats.t.ppf(0.975, gl_tr))
ci_low = beta - tc * se
ci_high = beta + tc * se

sst_tr = float(((y_tr.values - y_tr.mean()) ** 2).sum())
ssr_tr = float(res_tr @ res_tr)
r2_tr = float(1 - ssr_tr / sst_tr)
r2_adj_tr = float(1 - (1 - r2_tr) * (n_tr - 1) / gl_tr)
F_stat = float((r2_tr / (k_tr - 1)) / ((1 - r2_tr) / gl_tr))
p_F = float(stats.f.sf(F_stat, k_tr - 1, gl_tr))

sk_model = LinearRegression().fit(X_tr, y_tr)
pred_te = sk_model.predict(X_te)
r2_te = float(r2_score(y_te, pred_te))
rmse_te = float(np.sqrt(mean_squared_error(y_te, pred_te)))
mae_te = float(mean_absolute_error(y_te, pred_te))
cv_scores = cross_val_score(LinearRegression(), X_all, y_all, cv=5, scoring="r2")

vif_dict = {}
for c in reg_feats:
    X_sub = X_tr.drop(columns=[c])
    y_sub = X_tr[c]
    r2_sub = LinearRegression().fit(X_sub, y_sub).score(X_sub, y_sub)
    vif_dict[c] = float(round(1 / (1 - r2_sub), 2))

r2_bp = float(LinearRegression().fit(X_tr, res_tr ** 2).score(X_tr, res_tr ** 2))
lm_bp = float(len(X_tr) * r2_bp)
p_bp = float(stats.chi2.sf(lm_bp, len(reg_feats)))

sw_stat, sw_p = stats.shapiro(res_tr[:1000])

sk_full = LinearRegression().fit(X_all, y_all)
df["IncomeGap"] = df["MonthlyIncome"] - sk_full.predict(X_all)

Xl_tr, Xl_te, yl_tr, yl_te = train_test_split(X_all, df["LogIncome"], test_size=0.2, random_state=42)
sk_log = LinearRegression().fit(Xl_tr, yl_tr)
r2_log_te = float(r2_score(yl_te, sk_log.predict(Xl_te)))

qq_res = np.sort((res_tr - np.mean(res_tr)) / np.std(res_tr))
qq_n = len(qq_res)
qq_theoretical = stats.norm.ppf((np.arange(1, qq_n + 1) - 0.5) / qq_n)

step = max(1, qq_n // 150)
qq_sample = [{"theoretical": float(round(qq_theoretical[i], 3)), "sample": float(round(qq_res[i], 3))} for i in range(0, qq_n, step)]

step_fit = max(1, len(X_tr) // 200)
fitted_vals = sk_model.predict(X_tr)
res_sample = [{"fitted": float(round(fitted_vals[i], 1)), "residual": float(round(res_tr[i], 1))} for i in range(0, len(X_tr), step_fit)]

step_te = max(1, len(X_te) // 150)
pred_vs_act = [{"actual": float(round(y_te.iloc[i], 1)), "predicted": float(round(pred_te[i], 1))} for i in range(0, len(X_te), step_te)]

def calc_wilson(k, n, conf=0.95):
    if n == 0:
        return 0.0, 0.0, 0.0
    p = k / n
    z = stats.norm.ppf(1 - (1 - conf) / 2)
    denom = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denom
    margin = (z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))) / denom
    return float(p), float(max(0.0, center - margin)), float(min(1.0, center + margin))

def welch_ttest(s1, s2, conf=0.95):
    n1, n2 = len(s1), len(s2)
    if n1 < 2 or n2 < 2:
        return {"error": "Amostra insuficiente"}
    m1, m2 = float(s1.mean()), float(s2.mean())
    v1, v2 = float(s1.var(ddof=1)), float(s2.var(ddof=1))
    d = m1 - m2
    se = float(np.sqrt(v1 / n1 + v2 / n2))
    if se == 0:
        return {"dif_medias": 0.0, "t": 0.0, "gl": 0.0, "p_valor": 1.0, "ic_inf": 0.0, "ic_sup": 0.0}
    gl = float((v1 / n1 + v2 / n2)**2 / (((v1 / n1)**2 / (n1 - 1)) + ((v2 / n2)**2 / (n2 - 1))))
    t = float(d / se)
    p = float(2 * stats.t.sf(abs(t), gl))
    tc_val = float(stats.t.ppf(1 - (1 - conf) / 2, gl))
    return {
        "media_1": round(m1, 2), "media_2": round(m2, 2), "n1": n1, "n2": n2,
        "dif_medias": round(d, 2), "t": round(t, 4), "gl": round(gl, 2),
        "p_valor": float(p), "ic_inf": round(d - tc_val * se, 2), "ic_sup": round(d + tc_val * se, 2)
    }

def get_filtered_df(filters):
    sub = df.copy()
    if not filters:
        return sub
    
    if "department" in filters and filters["department"] and filters["department"] != "all":
        deps = filters["department"] if isinstance(filters["department"], list) else [filters["department"]]
        sub = sub[sub["Department"].isin(deps)]
        
    if "jobRole" in filters and filters["jobRole"] and filters["jobRole"] != "all":
        roles = filters["jobRole"] if isinstance(filters["jobRole"], list) else [filters["jobRole"]]
        sub = sub[sub["JobRole"].isin(roles)]
        
    if "maritalStatus" in filters and filters["maritalStatus"] and filters["maritalStatus"] != "all":
        ms = filters["maritalStatus"] if isinstance(filters["maritalStatus"], list) else [filters["maritalStatus"]]
        sub = sub[sub["MaritalStatus"].isin(ms)]
        
    if "overTime" in filters and filters["overTime"] and filters["overTime"] != "all":
        sub = sub[sub["OverTime"] == filters["overTime"]]
        
    if "jobLevel" in filters and filters["jobLevel"] and filters["jobLevel"] != "all":
        levels = [int(x) for x in (filters["jobLevel"] if isinstance(filters["jobLevel"], list) else [filters["jobLevel"]])]
        sub = sub[sub["JobLevel"].isin(levels)]
        
    if "businessTravel" in filters and filters["businessTravel"] and filters["businessTravel"] != "all":
        bt = filters["businessTravel"] if isinstance(filters["businessTravel"], list) else [filters["businessTravel"]]
        sub = sub[sub["BusinessTravel"].isin(bt)]
        
    if "ageMin" in filters and filters["ageMin"] is not None:
        sub = sub[sub["Age"] >= int(filters["ageMin"])]
    if "ageMax" in filters and filters["ageMax"] is not None:
        sub = sub[sub["Age"] <= int(filters["ageMax"])]
        
    if "incomeMin" in filters and filters["incomeMin"] is not None:
        sub = sub[sub["MonthlyIncome"] >= float(filters["incomeMin"])]
    if "incomeMax" in filters and filters["incomeMax"] is not None:
        sub = sub[sub["MonthlyIncome"] <= float(filters["incomeMax"])]
        
    return sub

def build_filter_response(sub):
    n_total = len(sub)
    n_attr = int(sub["AttritionFlag"].sum()) if n_total > 0 else 0
    p_hat, ci_lo, ci_hi = calc_wilson(n_attr, n_total) if n_total > 0 else (0.0, 0.0, 0.0)
    
    mean_inc = float(sub["MonthlyIncome"].mean()) if n_total > 0 else 0.0
    med_inc = float(sub["MonthlyIncome"].median()) if n_total > 0 else 0.0
    mean_age = float(sub["Age"].mean()) if n_total > 0 else 0.0
    med_age = float(sub["Age"].median()) if n_total > 0 else 0.0
    
    baseline_rate = float(df["AttritionFlag"].mean())
    
    def cat_breakdown(col):
        if n_total == 0:
            return []
        grouped = sub.groupby(col, observed=True)["AttritionFlag"].agg(["count", "sum", "mean"]).reset_index()
        out = []
        for _, row in grouped.iterrows():
            cnt = int(row["count"])
            attr = int(row["sum"])
            rate = float(row["mean"])
            _, w_lo, w_hi = calc_wilson(attr, cnt)
            out.append({
                "category": str(row[col]),
                "count": cnt,
                "attritionCount": attr,
                "attritionRate": round(rate * 100, 2),
                "ciLow": round(w_lo * 100, 2),
                "ciHigh": round(w_hi * 100, 2)
            })
        return out

    def num_stats(col):
        if n_total == 0:
            return {}
        yes_s = sub[sub["Attrition"] == "Yes"][col]
        no_s = sub[sub["Attrition"] == "No"][col]
        
        def s_dict(s):
            if len(s) == 0:
                return {"count": 0, "mean": 0, "median": 0, "std": 0, "q1": 0, "q3": 0, "min": 0, "max": 0}
            return {
                "count": int(len(s)),
                "mean": round(float(s.mean()), 2),
                "median": round(float(s.median()), 2),
                "std": round(float(s.std(ddof=1)) if len(s) > 1 else 0.0, 2),
                "q1": round(float(s.quantile(0.25)), 2),
                "q3": round(float(s.quantile(0.75)), 2),
                "min": round(float(s.min()), 2),
                "max": round(float(s.max()), 2)
            }
        return {"yes": s_dict(yes_s), "no": s_dict(no_s)}

    corr_cols = ["MonthlyIncome", "Age", "JobLevel", "TotalWorkingYears", "YearsAtCompany", "YearsSinceLastPromotion", "DistanceFromHome", "AttritionFlag"]
    corr_matrix = {}
    if n_total > 5:
        sub_corr = sub[corr_cols].corr().round(3).fillna(0)
        corr_matrix = {col: sub_corr[col].to_dict() for col in corr_cols}

    return {
        "kpis": {
            "totalCount": n_total,
            "attritionCount": n_attr,
            "attritionRatePct": round(p_hat * 100, 2),
            "attritionCiLowPct": round(ci_lo * 100, 2),
            "attritionCiHighPct": round(ci_hi * 100, 2),
            "baselineRatePct": round(baseline_rate * 100, 2),
            "meanIncome": round(mean_inc, 2),
            "medianIncome": round(med_inc, 2),
            "meanAge": round(mean_age, 2),
            "medianAge": round(med_age, 2)
        },
        "breakdowns": {
            "overTime": cat_breakdown("OverTime"),
            "maritalStatus": cat_breakdown("MaritalStatus"),
            "department": cat_breakdown("Department"),
            "jobRole": cat_breakdown("JobRole"),
            "jobLevel": cat_breakdown("JobLevel"),
            "ageGroup": cat_breakdown("AgeGroup"),
            "businessTravel": cat_breakdown("BusinessTravel")
        },
        "distributions": {
            "monthlyIncome": num_stats("MonthlyIncome"),
            "age": num_stats("Age"),
            "yearsAtCompany": num_stats("YearsAtCompany"),
            "distanceFromHome": num_stats("DistanceFromHome"),
            "incomeGap": num_stats("IncomeGap")
        },
        "correlation": corr_matrix
    }

def get_all_hypotheses():
    com = df[df.OverTime == "Yes"].AttritionFlag
    sem = df[df.OverTime == "No"].AttritionFlag
    x1, n1, x2, n2 = int(com.sum()), int(len(com)), int(sem.sum()), int(len(sem))
    p1, p2 = x1 / n1, x2 / n2
    diff_ot = p1 - p2
    pp = (x1 + x2) / (n1 + n2)
    z_ot = (p1 - p2) / np.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2))
    p_z_ot = float(2 * stats.norm.sf(abs(z_ot)))
    se_diff_ot = np.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
    z_crit = stats.norm.ppf(0.975)
    ci_diff_ot = [round(float(diff_ot - z_crit * se_diff_ot), 4), round(float(diff_ot + z_crit * se_diff_ot), 4)]
    tab_ot = pd.crosstab(df.OverTime, df.Attrition)
    chi2_ot, p_chi_ot, gl_ot, _ = stats.chi2_contingency(tab_ot, correction=False)
    
    saiu = df[df.Attrition == "Yes"]
    ficou = df[df.Attrition == "No"]
    
    w_inc = welch_ttest(saiu["MonthlyIncome"], ficou["MonthlyIncome"])
    mw_inc_p = float(stats.mannwhitneyu(saiu["MonthlyIncome"], ficou["MonthlyIncome"]).pvalue)
    w_inc["mannwhitney_p"] = mw_inc_p
    
    w_age = welch_ttest(saiu["Age"], ficou["Age"])
    
    tab_ms = pd.crosstab(df.MaritalStatus, df.Attrition)
    chi2_ms, p_chi_ms, gl_ms, exp_ms = stats.chi2_contingency(tab_ms, correction=False)
    cramer_v = float(np.sqrt(chi2_ms / (tab_ms.values.sum() * (min(tab_ms.shape) - 1))))
    
    w_gap = welch_ttest(saiu["IncomeGap"], ficou["IncomeGap"])
    w_gap_ot = welch_ttest(df[df.OverTime == "Yes"]["IncomeGap"], df[df.OverTime == "No"]["IncomeGap"])
    
    return {
        "h1_overtime": {
            "title": "Hora Extra vs Rotatividade (Diferença de Proporções)",
            "h0": "p_com_hora_extra = p_sem_hora_extra",
            "h1": "p_com_hora_extra != p_sem_hora_extra",
            "p1": round(p1, 4), "p2": round(p2, 4), "n1": n1, "n2": n2,
            "diferenca": round(diff_ot, 4),
            "z_stat": round(float(z_ot), 4), "p_valor_z": p_z_ot,
            "chi2_stat": round(float(chi2_ot), 4), "gl_chi2": int(gl_ot), "p_valor_chi2": float(p_chi_ot),
            "ic_95_diferenca": ci_diff_ot,
            "rejeita_h0_alpha_005": bool(p_z_ot < 0.05)
        },
        "h2_income": {
            "title": "Renda Mensal vs Rotatividade (Comparação de Médias)",
            "h0": "mu_renda_saiu = mu_renda_ficou",
            "h1": "mu_renda_saiu != mu_renda_ficou",
            "welch": w_inc,
            "rejeita_h0_alpha_005": bool(w_inc["p_valor"] < 0.05)
        },
        "h3_age": {
            "title": "Idade vs Rotatividade (Comparação de Médias)",
            "h0": "mu_idade_saiu = mu_idade_ficou",
            "h1": "mu_idade_saiu != mu_idade_ficou",
            "welch": w_age,
            "rejeita_h0_alpha_005": bool(w_age["p_valor"] < 0.05)
        },
        "h4_marital": {
            "title": "Estado Civil vs Rotatividade (Teste Qui-Quadrado de Independência)",
            "h0": "Estado Civil e Rotatividade são independentes",
            "h1": "Estado Civil e Rotatividade estão associados",
            "chi2_stat": round(float(chi2_ms), 4),
            "gl": int(gl_ms),
            "p_valor": float(p_chi_ms),
            "cramer_v": round(cramer_v, 4),
            "frequencia_esperada_minima": round(float(exp_ms.min()), 2),
            "observed_table": {
                idx: {c: int(tab_ms.loc[idx, c]) for c in tab_ms.columns} for idx in tab_ms.index
            },
            "rejeita_h0_alpha_005": bool(p_chi_ms < 0.05)
        },
        "h5_income_gap": {
            "title": "IncomeGap (Resíduo da Regressão) vs Rotatividade",
            "h0": "mu_gap_saiu = mu_gap_ficou (Sem defasagem salarial para o perfil)",
            "h1": "mu_gap_saiu != mu_gap_ficou",
            "welch_attrition": w_gap,
            "welch_overtime": w_gap_ot,
            "rejeita_h0_alpha_005": bool(w_gap["p_valor"] < 0.05)
        }
    }

def get_regression_model_info():
    labels = ["const"] + reg_feats
    coef_table = []
    for i in range(len(labels)):
        name = labels[i]
        coef_table.append({
            "parametro": name,
            "coef": round(float(beta[i]), 4),
            "erro_padrao": round(float(se[i]), 4),
            "t_stat": round(float(t_stats[i]), 4),
            "p_valor": float(p_vals[i]),
            "ic_inf": round(float(ci_low[i]), 4),
            "ic_sup": round(float(ci_high[i]), 4),
            "vif": vif_dict.get(name, "-")
        })

    return {
        "variavel_dependente": "MonthlyIncome",
        "preditores": reg_feats,
        "n_treino": n_tr,
        "n_teste": len(X_te),
        "gl_residual": gl_tr,
        "s2_variancia_residual": round(s2, 2),
        "s_desvio_residual": round(float(np.sqrt(s2)), 2),
        "metricas": {
            "r2_treino": round(r2_tr, 4),
            "r2_ajustado_treino": round(r2_adj_tr, 4),
            "f_stat": round(F_stat, 2),
            "p_valor_f": float(p_F),
            "r2_teste": round(r2_te, 4),
            "rmse_teste": round(rmse_te, 2),
            "mae_teste": round(mae_te, 2),
            "cv_r2_folds": [round(float(v), 4) for v in cv_scores],
            "cv_r2_medio": round(float(cv_scores.mean()), 4),
            "r2_log_teste": round(r2_log_te, 4)
        },
        "coeficientes": coef_table,
        "pressupostos": {
            "breusch_pagan": {
                "lm_stat": round(lm_bp, 2),
                "gl": len(reg_feats),
                "p_valor": float(p_bp),
                "homocedasticidade_atendida": bool(p_bp >= 0.05)
            },
            "shapiro_wilk": {
                "stat": round(float(sw_stat), 4),
                "p_valor": float(sw_p),
                "normalidade_atendida": bool(sw_p >= 0.05)
            },
            "vif_max": max(vif_dict.values())
        },
        "graficos": {
            "qq_plot": qq_sample,
            "residuos_ajustados": res_sample,
            "real_vs_previsto": pred_vs_act
        }
    }

def predict_income(input_data):
    age = float(input_data.get("Age", 35))
    job_level = float(input_data.get("JobLevel", 2))
    total_working = float(input_data.get("TotalWorkingYears", 8))
    years_company = float(input_data.get("YearsAtCompany", 5))
    years_promotion = float(input_data.get("YearsSinceLastPromotion", 1))
    actual_income = float(input_data["ActualIncome"]) if "ActualIncome" in input_data and input_data["ActualIncome"] is not None else None

    x0 = np.array([1.0, age, job_level, total_working, years_company, years_promotion])
    y_hat = float(x0 @ beta)
    
    leverage = float(x0 @ inv_tr @ x0.T)
    se_pred = float(np.sqrt(s2 * (1.0 + leverage)))
    margin_pred = tc * se_pred
    pred_low = round(y_hat - margin_pred, 2)
    pred_high = round(y_hat + margin_pred, 2)
    
    se_mean = float(np.sqrt(s2 * leverage))
    margin_mean = tc * se_mean
    mean_ci_low = round(y_hat - margin_mean, 2)
    mean_ci_high = round(y_hat + margin_mean, 2)
    
    gap = round(actual_income - y_hat, 2) if actual_income is not None else None
    
    return {
        "renda_prevista": round(y_hat, 2),
        "intervalo_predicao_95": [pred_low, pred_high],
        "intervalo_confianca_media_95": [mean_ci_low, mean_ci_high],
        "leverage_h00": round(leverage, 6),
        "erro_padrao_predicao": round(se_pred, 2),
        "salario_informado": actual_income,
        "income_gap": gap,
        "status_gap": "Acima do Esperado" if gap and gap > 0 else "Abaixo do Esperado" if gap else None
    }

def simulate_overtime_impact(reduction_pct=1.0):
    com = df[df.OverTime == "Yes"].AttritionFlag
    sem = df[df.OverTime == "No"].AttritionFlag
    n_ot = int(len(com))
    n_sem = int(len(sem))
    x1, x2 = int(com.sum()), int(sem.sum())
    p1, p2 = x1 / n_ot, x2 / n_sem
    diff = p1 - p2
    se_diff = np.sqrt(p1 * (1 - p1) / n_ot + p2 * (1 - p2) / n_sem)
    z_crit = stats.norm.ppf(0.975)
    lo = diff - z_crit * se_diff
    hi = diff + z_crit * se_diff
    
    evitadas_point = float(n_ot * diff * reduction_pct)
    evitadas_lo = float(max(0.0, n_ot * lo * reduction_pct))
    evitadas_hi = float(n_ot * hi * reduction_pct)
    total_saidas = int(df.AttritionFlag.sum())
    
    return {
        "funcionarios_hora_extra": n_ot,
        "taxa_saida_com_hora_extra_pct": round(float(p1 * 100), 2),
        "taxa_saida_sem_hora_extra_pct": round(float(p2 * 100), 2),
        "diferenca_proporcoes_pct": round(float(diff * 100), 2),
        "percentual_reducao_simulado": round(float(reduction_pct * 100), 1),
        "saidas_evitadas_estimativa_pontual": round(evitadas_point, 1),
        "intervalo_confianca_95_saidas_evitadas": [round(evitadas_lo, 1), round(evitadas_hi, 1)],
        "proporcao_do_total_de_saidas_evitadas_pct": round(float((evitadas_point / total_saidas) * 100), 2)
    }

class DashboardRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        if path == "/api/status":
            self._send_json({"status": "online", "rows": len(df), "columns": len(df.columns)})
        elif path == "/api/options":
            options = {
                "departments": sorted(df["Department"].unique().tolist()),
                "jobRoles": sorted(df["JobRole"].unique().tolist()),
                "maritalStatuses": sorted(df["MaritalStatus"].unique().tolist()),
                "businessTravels": sorted(df["BusinessTravel"].unique().tolist()),
                "jobLevels": sorted([int(x) for x in df["JobLevel"].unique()]),
                "ageMin": int(df["Age"].min()),
                "ageMax": int(df["Age"].max()),
                "incomeMin": int(df["MonthlyIncome"].min()),
                "incomeMax": int(df["MonthlyIncome"].max())
            }
            self._send_json(options)
        elif path == "/api/hypotheses":
            self._send_json(get_all_hypotheses())
        elif path == "/api/regression/model":
            self._send_json(get_regression_model_info())
        elif path == "/api/data-preview":
            query = urllib.parse.parse_qs(parsed.query)
            limit = int(query.get("limit", [25])[0])
            offset = int(query.get("offset", [0])[0])
            cols = ["Age", "Attrition", "Department", "JobRole", "JobLevel", "MonthlyIncome", "OverTime", "YearsAtCompany", "TotalWorkingYears", "IncomeGap"]
            records = df[cols].iloc[offset:offset+limit].round(2).to_dict(orient="records")
            self._send_json({"total": len(df), "offset": offset, "limit": limit, "data": records})
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            payload = {}

        if path == "/api/filter":
            sub = get_filtered_df(payload)
            res = build_filter_response(sub)
            self._send_json(res)
        elif path == "/api/regression/predict":
            res = predict_income(payload)
            self._send_json(res)
        elif path == "/api/simulation/impact":
            pct = float(payload.get("reductionPct", 1.0))
            res = simulate_overtime_impact(pct)
            self._send_json(res)
        elif path == "/api/custom-hypothesis":
            var_name = payload.get("variable", "MonthlyIncome")
            if var_name not in df.columns:
                self._send_json({"error": "Variável não encontrada"}, status=400)
                return
            if pd.api.types.is_numeric_dtype(df[var_name]):
                s_yes = df[df.Attrition == "Yes"][var_name]
                s_no = df[df.Attrition == "No"][var_name]
                res = welch_ttest(s_yes, s_no)
                mw_p = float(stats.mannwhitneyu(s_yes, s_no).pvalue)
                res["mannwhitney_p"] = mw_p
                res["tipo"] = "numerico_welch"
                res["variavel"] = var_name
                self._send_json(res)
            else:
                tab = pd.crosstab(df[var_name], df.Attrition)
                chi2, p_val, gl, exp = stats.chi2_contingency(tab, correction=False)
                cramer = float(np.sqrt(chi2 / (tab.values.sum() * (min(tab.shape) - 1))))
                res = {
                    "tipo": "categorico_chi2",
                    "variavel": var_name,
                    "chi2_stat": round(float(chi2), 4),
                    "gl": int(gl),
                    "p_valor": float(p_val),
                    "cramer_v": round(cramer, 4),
                    "frequencia_esperada_minima": round(float(exp.min()), 2),
                    "tabela_observada": {idx: {c: int(tab.loc[idx, c]) for c in tab.columns} for idx in tab.index}
                }
                self._send_json(res)
        else:
            self._send_json({"error": "Endpoint não encontrado"}, status=404)

def run_server():
    server_address = ("", PORT)
    httpd = ThreadingHTTPServer(server_address, DashboardRequestHandler)
    print(f" Servidor On\n")
    print(f" Acessar http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
