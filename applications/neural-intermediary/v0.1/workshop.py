# SPDX-License-Identifier: Apache-2.0
"""Offline order-review pilot for a small custom fabrication workshop.

Human confirmation is a caller assertion, not authenticated approval. No LLM,
pricing recommendation, engineering calculation, scheduling or machine control.
"""
import html
from copy import deepcopy

import core

SCHEMA = "matawaka.intermediary.workshop-case/v0.1"
FIELDS = {
    "product": "Какое изделие и для какой задачи нужно изготовить?",
    "quantity": "Сколько изделий требуется?",
    "dimensions_mm": "Какие окончательные габариты в мм: ширина, высота, глубина?",
    "material": "Какой точный материал, марка и толщина согласованы?",
    "finish": "Какие цвет, покрытие и требования к внешнему виду согласованы?",
    "drawing_revision": "Какая версия чертежа или эскиза является согласованной?",
    "installation": "Где и в каких условиях используется изделие; кто отвечает за монтаж?",
    "requested_date": "К какой дате клиент просит завершить заказ?",
    "acceptance": "По каким согласованным признакам клиент принимает результат?",
}
COSTS = {
    "materials": "Материалы с учётом раскроя и отходов",
    "outside_services": "Услуги подрядчиков",
    "labor": "Рабочее время людей, включая владельца",
    "machine": "Машинные затраты без повторного учёта труда оператора",
    "delivery_installation": "Доставка и монтаж",
    "overhead": "Распределённые накладные расходы",
    "contingency": "Явно выбранный резерв",
}
STATES = ("missing", "candidate", "confirmed", "conflict")


def text_value(value, limit=1000):
    core.require(type(value) is str and 0 < len(value) <= limit, "workshop_text")
    try:
        value.encode("utf-8")
    except UnicodeError:
        raise core.Refused("workshop_text") from None


def validate(case):
    core.exact(case, "schema tenant order_id revision currency requirements costs", "workshop_shape")
    core.require(case["schema"] == SCHEMA, "workshop_version")
    for key in ("tenant", "order_id"):
        core.token(case[key])
    core.bounded_int(case["revision"], 1, 1000000)
    core.require(case["currency"] in ("RUB", "USD", "EUR", "KZT"), "workshop_currency")
    core.exact(case["requirements"], " ".join(FIELDS), "workshop_requirements")
    for key, fact in case["requirements"].items():
        core.exact(fact, "state value source_refs", "workshop_fact_shape")
        core.require(fact["state"] in STATES, "workshop_fact_state")
        refs = fact["source_refs"]
        core.require(type(refs) is list and len(refs) <= 8, "workshop_source_refs")
        for ref in refs:
            core.token(ref)
        core.require(len(set(refs)) == len(refs), "workshop_duplicate_source_ref")
        value = fact["value"]
        if fact["state"] == "missing":
            core.require(value is None, "workshop_missing_value")
            continue
        core.require(bool(refs), "workshop_source_required")
        if key == "quantity":
            core.bounded_int(value, 1, 1000000)
        elif key == "dimensions_mm":
            core.exact(value, "width height depth", "workshop_dimensions")
            for dimension in value.values():
                core.bounded_int(dimension, 1, 1000000)
        elif key == "requested_date":
            text_value(value, 10)
            core.timestamp(value + "T00:00:00Z")
        else:
            text_value(value)
    core.exact(case["costs"], " ".join(COSTS), "workshop_cost_inventory")
    for cost in case["costs"].values():
        core.exact(cost, "state amount_minor basis_ref", "workshop_cost_shape")
        core.require(cost["state"] in ("missing", "estimate", "confirmed", "not_applicable"), "workshop_cost_state")
        if cost["state"] == "missing":
            core.require(cost["amount_minor"] is None and cost["basis_ref"] is None, "workshop_missing_cost")
        else:
            core.bounded_int(cost["amount_minor"], 0, 10**12)
            core.token(cost["basis_ref"])
            if cost["state"] == "not_applicable":
                core.require(cost["amount_minor"] == 0, "workshop_not_applicable_cost")


def build(case):
    validate(case)
    requirements = case["requirements"]
    issues = [{"field": key, "state": fact["state"], "question": FIELDS[key]}
              for key, fact in requirements.items() if fact["state"] != "confirmed"]
    missing_costs = [key for key, value in case["costs"].items() if value["state"] == "missing"]
    provisional_costs = [key for key, value in case["costs"].items() if value["state"] == "estimate"]
    known_subtotal = sum(c["amount_minor"] for c in case["costs"].values() if c["amount_minor"] is not None)
    boundary = {"source_origin_authenticated": False, "owner_identity_authenticated": False,
                "engineering_validated": False, "delivery_date_promised": False,
                "quote_send_authorized": False, "production_authorized": False, "provider_called": False}
    # Only caller-confirmed fields enter a draft handoff. Any unresolved field
    # holds the whole handoff; a model's repeated assertion cannot confirm it.
    confirmed = {key: fact["value"] for key, fact in requirements.items() if fact["state"] == "confirmed"}
    if any(x["state"] == "conflict" for x in issues):
        readiness = "RESOLVE_CONFLICTS"
    elif issues:
        readiness = "CLARIFY_REQUIREMENTS"
    elif missing_costs or provisional_costs:
        readiness = "REVIEW_COSTS"
    else:
        readiness = "OWNER_REVIEW_REQUIRED"
    return {
        "owner": {
            "schema": "matawaka.intermediary.workshop-owner/v0.1",
            "tenant": case["tenant"], "order_id": case["order_id"], "revision": case["revision"],
            "input_sha256": core.digest(case), "readiness": readiness,
            "confirmed_requirements": confirmed, "requirement_review": deepcopy(requirements), "issues": issues,
            "cost_review": {"currency": case["currency"], "known_subtotal_minor": known_subtotal,
                            "complete_total_minor": known_subtotal if not missing_costs and not provisional_costs else None,
                            "missing_categories": missing_costs, "estimate_categories": provisional_costs,
                            "sales_price_computed": False, "tax_treatment_validated": False},
            "next_actions": ["Разрешить противоречия и подтвердить требования по первоисточникам",
                             "Проверить полноту затрат, налоги и цену предложения",
                             "Проверить маршрут, доступность людей, станка и материалов",
                             "Отдельно утвердить чертёж, монтаж и производственное задание"],
            "boundaries": dict(boundary),
        },
        "client": {
            "schema": "matawaka.intermediary.workshop-client-questions/v0.1",
            "order_id": case["order_id"], "revision": case["revision"],
            # No raw requirement text, source references, cost, tenant or hash of
            # low-entropy internal data crosses this projection.
            "questions": [issue["question"] for issue in issues],
            "status": "DRAFT_FOR_OWNER_REVIEW", "send_authorized": False,
        },
        "workshop": {
            "schema": "matawaka.intermediary.workshop-handoff/v0.1",
            "order_id": case["order_id"], "revision": case["revision"],
            "confirmed_requirements": confirmed,
            "unresolved_fields": [issue["field"] for issue in issues],
            "status": "HOLD" if issues else "DRAFT_FOR_OWNER_REVIEW",
            "production_authorized": False, "engineering_validated": False,
            "delivery_date_promised": False,
        },
    }


def render(view):
    """Render an already selected audience view; never render the whole case."""
    esc = lambda v: html.escape(str(v), quote=True)
    headings = {"owner": "Карточка для владельца", "client-questions": "Вопросы клиенту: черновик",
                "handoff": "Задание мастерской: черновик"}
    kind = view["schema"].split("workshop-")[-1].split("/")[0]
    rows = []
    if "readiness" in view:
        labels = {"RESOLVE_CONFLICTS": "Сначала разрешить противоречия", "CLARIFY_REQUIREMENTS": "Уточнить требования",
                  "REVIEW_COSTS": "Проверить затраты", "OWNER_REVIEW_REQUIRED": "Требуется решение владельца"}
        rows.append("<p><strong>" + esc(labels[view["readiness"]]) + "</strong></p>")
    if "status" in view:
        label = "HOLD: есть нерешённые требования; задание не готово" if view["status"] == "HOLD" else "Черновик для проверки владельцем"
        rows.append("<p><strong>" + esc(label) + "</strong></p>")
    if "requirement_review" in view:
        state_labels = {"confirmed":"Подтверждено вызывающей стороной", "candidate":"Требует подтверждения", "missing":"Не задано", "conflict":"Противоречие"}
        rows.append("<h2>Требования и ссылки на источники</h2><dl>" + "".join(
            "<dt>" + esc(FIELDS[k]) + "</dt><dd>" + esc(state_labels[f["state"]]) + ": " +
            esc(f["value"] if f["value"] is not None else "—") + "<br>Источники: " + esc(", ".join(f["source_refs"]) or "—") + "</dd>"
            for k, f in view["requirement_review"].items()) + "</dl>")
    elif "confirmed_requirements" in view:
        rows.append("<h2>Подтверждённые вызывающей стороной требования</h2><dl>" + "".join(
            "<dt>" + esc(FIELDS[k]) + "</dt><dd>" + esc(v) + "</dd>" for k, v in view["confirmed_requirements"].items()) + "</dl>")
    questions = view.get("questions", [x["question"] for x in view.get("issues", [])] +
                         [FIELDS[key] for key in view.get("unresolved_fields", [])])
    if questions:
        rows.append("<h2>Вопросы для уточнения</h2><ol>" + "".join("<li>" + esc(q) + "</li>" for q in questions) + "</ol>")
    if "cost_review" in view:
        cost = view["cost_review"]
        amount = lambda n: f"{n // 100}.{n % 100:02d} {cost['currency']}"
        rows.append("<h2>Внутренние затраты</h2><p>Сумма заполненных строк: " + esc(amount(cost["known_subtotal_minor"])) +
                    ". Это не цена предложения.</p><p>Полный итог: " +
                    (esc(amount(cost["complete_total_minor"])) if cost["complete_total_minor"] is not None else "пока не определён") + "</p>")
        gaps = cost["missing_categories"] + cost["estimate_categories"]
        if gaps:
            rows.append("<ul>" + "".join("<li>Требует проверки: " + esc(COSTS[k]) + "</li>" for k in gaps) + "</ul>")
    return ("<!doctype html><html lang='ru'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"
            "<title>Пилот мастерской</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:32px auto;padding:0 20px;color:#183049}"
            "dt{font-weight:600}dd{margin-bottom:16px}h1{line-height:1.2}</style><h1>" + esc(headings[kind]) +
            "</h1><p>Заказ " + esc(view["order_id"]) + ", версия " + esc(view["revision"]) + "</p>" + "".join(rows) +
            "<p>Для проверки владельцем. Отправка, срок поставки и запуск производства не разрешены этим документом.</p></html>")
