# SPDX-License-Identifier: Apache-2.0
"""Explicit local CLI. Synthetic demo, scoped evaluation and offline replay."""
import argparse
import html
import json
from pathlib import Path
import sys

# Permit isolated Python startup while loading only this fixed package directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import core
import check
import bundle
import fixtures
import workshop


LABELS = {
    "CORROBORATED_UNDER_DECLARED_MODEL": "Согласовано по заявленной модели источников",
    "DISPUTED": "Есть противоречие — требуется разбор",
    "INSUFFICIENT_EVIDENCE": "Недостаточно свидетельств",
    "PRESSURE_LIMITED": "Превышен лимит потока",
}


def read(path, limit=core.MAX_BYTES):
    with Path(path).open("rb") as stream:
        data = stream.read(limit + 1)
    core.require(len(data) <= limit, "input_byte_limit")
    return data


def write_new(path, data):
    with Path(path).open("xb") as stream:
        stream.write(data)


def demo():
    outcomes = []
    for case in fixtures.scenarios():
        try:
            report = core.evaluate(case["policy"], case["observations"])
            verified = check.verify(case["policy"], case["observations"], report)
            status = report["decision"]
            item = {"name": case["name"], "result": status, "expected": case["expected"],
                    "check": verified, "counts": report["counts"], "values": report["observed_values"]}
        except core.Refused as error:
            status = "REFUSED:" + str(error)
            item = {"name": case["name"], "result": status, "expected": case["expected"], "check": {"status": "NOT_APPLICABLE"}}
        item["matched"] = status == case["expected"] and item["check"]["status"] != "REJECTED"
        outcomes.append(item)
    policy, rows = fixtures.base()
    # Deliberately noncanonical input formatting: replay must retain original bytes.
    pbytes = json.dumps(policy, ensure_ascii=False, indent=4).encode() + b"\n"
    obytes = json.dumps(rows, ensure_ascii=False, indent=2).encode() + b"\n"
    packed = bundle.pack(pbytes, obytes)
    replayed = bundle.restore(packed, expected_policy_sha256=bundle.sha(pbytes), expected_bundle_sha256=bundle.sha(packed))
    exact = replayed["policy_bytes"] == pbytes and replayed["observation_bytes"] == obytes
    external = replayed["report"]
    internal_policy = dict(policy, compartment="internal-planning", claim="capacity-risk")
    internal_rows = [dict(row, compartment="internal-planning", claim="capacity-risk") for row in rows]
    internal = core.evaluate(internal_policy, internal_rows)
    core.require(check.verify(internal_policy, internal_rows, internal)["status"] == "CHECKED_BOUNDED", "checker_disagreement")
    join_policy = {"schema": "matawaka.intermediary.join-policy/v0.1", "tenant": policy["tenant"],
                   "purpose": policy["purpose"], "destination": "procurement-review-board",
                   "inputs": [{**{k: r["scope"][k] for k in ("compartment", "subject", "claim")},
                               "report_sha256": r["report_sha256"]} for r in (external, internal)]}
    joined = core.join_reports(join_policy, [external, internal])
    egress_policy = {"schema": "matawaka.intermediary.egress-policy/v0.1", "provider": "provider-a",
                     **{k: policy[k] for k in ("tenant", "compartment", "purpose", "subject", "claim")},
                     "allowed_request_fields": ["subject", "claim"]}
    egress = core.prepare_egress(egress_policy, {k: policy[k] for k in ("tenant", "compartment", "purpose", "subject", "claim")})
    return {"schema": "matawaka.intermediary.demo/v0.1", "synthetic": True, "scenarios": outcomes,
            "all_expected": all(x["matched"] for x in outcomes),
            "replay": {"exact_input_bytes": exact, "bundle_bytes": len(packed), "sha256": bundle.sha(packed)},
            "composition": joined, "egress_candidate": egress,
            "limits": ["Нет реальных запросов к провайдерам", "Метки независимости заданы оператором",
                       "Согласие источников не устанавливает истину", "Корпоративная аутентификация и шифрование ещё не реализованы",
                       "Изоляция ОС проверяется отдельной командой; демо её не подтверждает"]}


def render_demo(result):
    esc = lambda value: html.escape(str(value), quote=True)
    rows = "".join("<tr><td>" + esc(x["name"]) + "</td><td>" + esc(LABELS.get(x["result"], x["result"])) +
                   "</td><td>" + ("Совпал" if x["matched"] else "ОШИБКА") + "</td></tr>" for x in result["scenarios"])
    limits = "".join("<li>" + esc(x) + "</li>" for x in result["limits"])
    combined = "".join("<li>" + esc(x["compartment"]) + ": " + esc(x["claim"]) + " = " + esc(x["value"]) + "</li>" for x in result["composition"]["items"])
    return ("<!doctype html><html lang='ru'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"
            "<title>Посредник нейросетевых сервисов — демонстрация</title><style>body{font:17px/1.6 system-ui;color:#172638;background:#f6f8fb;max-width:1080px;margin:40px auto;padding:0 24px}"
            "h1{line-height:1.15}table{border-collapse:collapse;width:100%;background:white}td,th{padding:14px;text-align:left;border-bottom:1px solid #d5dce5}"
            ".intro,details{background:white;padding:20px;border-radius:12px;margin:20px 0}code{overflow-wrap:anywhere}</style>"
            "<h1>Независимый посредник<br>нейросетевых сервисов</h1><p>Исполнимая концепция · синтетические данные · v0.1</p>"
            "<div class='intro'>Разделённые потоки → проверка происхождения и свежести → сохранение противоречий → ограниченное объединение для человека.</div>"
            "<table><thead><tr><th>Сценарий</th><th>Результат</th><th>Ожидание</th></tr></thead><tbody>" + rows + "</tbody></table>"
            "<details open><summary>Соединение разделённых потоков</summary><ul>" + combined + "</ul><p>Получатель: " +
            esc(result["composition"]["destination"]) + ". Итог: готово к рассмотрению человеком. Внешнее действие не разрешено.</p></details>"
            "<details open><summary>Минимальный запрос внешнему поставщику</summary><p>Только заранее выбранные поля: <code>" +
            esc(json.dumps(result["egress_candidate"]["payload"], ensure_ascii=False)) + "</code>. Запрос не отправлялся.</p></details>"
            "<details open><summary>Восстановление свидетельств</summary><p>Исходные байты после переноса: " +
            ("совпадают" if result["replay"]["exact_input_bytes"] else "НЕ СОВПАДАЮТ") + "</p><p>SHA-256 пакета: <code>" +
            esc(result["replay"]["sha256"]) + "</code></p></details><details open><summary>Границы результата</summary><ul>" + limits + "</ul></details></html>")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    d = sub.add_parser("demo")
    d.add_argument("--format", choices=("json", "html"), default="json")
    e = sub.add_parser("evaluate")
    e.add_argument("policy")
    e.add_argument("observations")
    p = sub.add_parser("pack")
    p.add_argument("policy")
    p.add_argument("observations")
    p.add_argument("output")
    v = sub.add_parser("replay")
    v.add_argument("archive")
    v.add_argument("--policy-sha256", required=True)
    v.add_argument("--bundle-sha256")
    w = sub.add_parser("workshop")
    w.add_argument("case")
    w.add_argument("--audience", choices=("owner", "client", "workshop"), default="owner")
    w.add_argument("--format", choices=("json", "html"), default="json")
    args = parser.parse_args()
    try:
        if args.command == "workshop":
            view = workshop.build(core.parse(read(args.case)))[args.audience]
            print(workshop.render(view) if args.format == "html" else json.dumps(view, ensure_ascii=False, indent=2))
            return 0
        if args.command == "demo":
            result = demo()
            print(render_demo(result) if args.format == "html" else json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["all_expected"] and result["replay"]["exact_input_bytes"] else 2
        if args.command == "evaluate":
            policy, rows = core.parse(read(args.policy)), core.parse(read(args.observations))
            report = core.evaluate(policy, rows)
            result = {"report": report, "verification": check.verify(policy, rows, report)}
        elif args.command == "pack":
            data = bundle.pack(read(args.policy), read(args.observations))
            write_new(args.output, data)
            result = {"bundle_sha256": bundle.sha(data), "bytes": len(data), "origin_authenticated": False}
        else:
            restored = bundle.restore(read(args.archive, bundle.LIMIT), expected_policy_sha256=args.policy_sha256,
                                      expected_bundle_sha256=args.bundle_sha256)
            result = {key: value for key, value in restored.items() if not key.endswith("_bytes")}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        # CLI success = operation completed, never corporate action approval.
        return 0
    except (core.Refused, OSError) as error:
        print(json.dumps({"status": "REFUSED", "code": str(error) if isinstance(error, core.Refused) else "local_io_error"}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
