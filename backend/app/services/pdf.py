"""여행 플랜 PDF 생성 서비스."""

import io
import json
from typing import Any

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_REGISTERED = False


def _register_font() -> str:
    global FONT_REGISTERED
    font_name = "Helvetica"
    if not FONT_REGISTERED:
        try:
            pdfmetrics.registerFont(TTFont("Malgun", "C:/Windows/Fonts/malgun.ttf"))
            pdfmetrics.registerFont(TTFont("MalgunBold", "C:/Windows/Fonts/malgunbd.ttf"))
            font_name = "Malgun"
            FONT_REGISTERED = True
        except Exception:
            FONT_REGISTERED = True
    return font_name


class PDFService:
    def generate(
        self,
        trip_title: str,
        destination: str,
        start_date: str,
        end_date: str,
        itinerary: dict[str, Any],
        budget: dict[str, Any],
        share_url: str = "",
    ) -> bytes:
        buffer = io.BytesIO()
        font = _register_font()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle", parent=styles["Heading1"], fontName=font, fontSize=20, spaceAfter=12,
        )
        heading_style = ParagraphStyle(
            "CustomHeading", parent=styles["Heading2"], fontName=font, fontSize=14, spaceAfter=8,
        )
        body_style = ParagraphStyle(
            "CustomBody", parent=styles["Normal"], fontName=font, fontSize=10, leading=14,
        )

        elements = []
        elements.append(Paragraph(f"TripPilot AI - {trip_title}", title_style))
        elements.append(Paragraph(f"{destination} | {start_date} ~ {end_date}", body_style))
        elements.append(Spacer(1, 10 * mm))

        for day in itinerary.get("days", []):
            elements.append(Paragraph(f"Day {day.get('day', '')} - {day.get('date', '')}", heading_style))
            schedule_data = [["시간", "장소", "활동"]]
            for item in day.get("schedule", []):
                schedule_data.append([
                    item.get("time", ""),
                    item.get("place", ""),
                    item.get("activity", ""),
                ])
            table = Table(schedule_data, colWidths=[30 * mm, 50 * mm, 90 * mm])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
            ]))
            elements.append(table)
            if day.get("tips"):
                elements.append(Paragraph(f"Tip: {day['tips']}", body_style))
            elements.append(Spacer(1, 6 * mm))

        elements.append(Paragraph("예산 요약", heading_style))
        budget_data = [
            ["항목", "금액"],
            ["숙소", f"{budget.get('accommodation', 0):,}원"],
            ["기름값", f"{budget.get('fuel', 0):,}원"],
            ["톨게이트", f"{budget.get('toll', 0):,}원"],
            ["입장료", f"{budget.get('entrance_fees', 0):,}원"],
            ["식비", f"{budget.get('food', 0):,}원"],
            ["합계", f"{budget.get('total', 0):,}원"],
        ]
        budget_table = Table(budget_data, colWidths=[60 * mm, 60 * mm])
        budget_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), font),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
        ]))
        elements.append(budget_table)

        if itinerary.get("ai_reasoning"):
            elements.append(Spacer(1, 6 * mm))
            elements.append(Paragraph("AI 일정 설명", heading_style))
            elements.append(Paragraph(itinerary["ai_reasoning"], body_style))

        if share_url:
            qr = qrcode.make(share_url)
            qr_buffer = io.BytesIO()
            qr.save(qr_buffer, format="PNG")
            qr_buffer.seek(0)
            elements.append(Spacer(1, 6 * mm))
            elements.append(Paragraph(f"공유 링크: {share_url}", body_style))

        doc.build(elements)
        return buffer.getvalue()


pdf_service = PDFService()
