"""Pure-function tests for the simulator hint response parser.

These don't touch the DB, the LLM, or the network -- they only exercise the
label-splitting logic in `app.sim.hint.parse_hint_response`. Run with:

    pytest services/ai/tests
"""

from __future__ import annotations

from app.sim.hint import parse_hint_response


def test_parse_english_labels() -> None:
    text = (
        "Hint: Verify the passport's MRZ matches the customer's stated name "
        "before proceeding.\n"
        "Rationale: SOP requires MRZ cross-check at intake to detect forged "
        "IDs [1]. The expiry date must also be in the future [2]."
    )
    hint, rationale = parse_hint_response(text, "en")
    assert hint.startswith("Verify the passport's MRZ")
    assert "SOP requires MRZ cross-check" in rationale
    assert "[1]" in rationale and "[2]" in rationale
    # The "Hint:" / "Rationale:" labels themselves must not leak into either side.
    assert "Hint:" not in hint
    assert "Rationale:" not in rationale


def test_parse_russian_labels() -> None:
    text = (
        "Подсказка: Сверьте MRZ паспорта с анкетой клиента перед "
        "продолжением.\n"
        "Обоснование: Согласно СОП, перекрёстная проверка MRZ обязательна "
        "на этапе приёма [1]. Также проверьте срок действия документа [2]."
    )
    hint, rationale = parse_hint_response(text, "ru")
    assert hint.startswith("Сверьте MRZ")
    assert "СОП" in rationale
    assert "[1]" in rationale
    assert "Подсказка" not in hint
    assert "Обоснование" not in rationale


def test_parse_uzbek_labels() -> None:
    text = (
        "Maslahat: Davom etishdan oldin pasport MRZ kodini mijoz anketasi "
        "bilan solishtiring.\n"
        "Sabab: SOPga ko'ra qabul bosqichida MRZ tekshiruvi majburiy [1]. "
        "Shuningdek, hujjat amal qilish muddatini tekshiring [2]."
    )
    hint, rationale = parse_hint_response(text, "uz")
    assert hint.startswith("Davom etishdan oldin")
    assert "SOPga ko'ra" in rationale
    assert "[1]" in rationale
    assert "Maslahat" not in hint
    assert "Sabab" not in rationale


def test_parse_handles_markdown_bold_labels() -> None:
    text = (
        "**Hint:** Run the sanctions screening before risk scoring.\n"
        "**Rationale:** The risk model expects a screening flag as input [1]."
    )
    hint, rationale = parse_hint_response(text, "en")
    assert "Run the sanctions screening" in hint
    assert "screening flag" in rationale


def test_parse_falls_back_to_hint_when_no_labels() -> None:
    text = "Just check the document expiry date and move on."
    hint, rationale = parse_hint_response(text, "en")
    assert hint == text.strip()
    assert rationale == ""


def test_parse_empty_input_returns_empty_strings() -> None:
    assert parse_hint_response("", "en") == ("", "")
    assert parse_hint_response("   \n\t  ", "ru") == ("", "")


def test_parse_only_hint_label_present() -> None:
    text = "Hint: Cross-check the income statement against the declared salary."
    hint, rationale = parse_hint_response(text, "en")
    assert "Cross-check the income statement" in hint
    assert rationale == ""
