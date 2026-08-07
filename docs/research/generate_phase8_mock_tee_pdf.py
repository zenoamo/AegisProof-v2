#!/usr/bin/env python3
"""Generate Phase 8.0-8.6 Mock TEE Internal Design PDF."""
from __future__ import annotations

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "phase8_mock_tee_internal_design.pdf"
FONT = Path(r"C:\Windows\Fonts\YuGothR.ttc")

FOOTER = (
    "Phase 8.0-8.6 Mock TEE Internal Design | "
    "Research / PoC Documentation | Not Production Implementation"
)


class DesignPDF(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("DocFont", size=7)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, FOOTER, align="C")


def set_body(pdf: DesignPDF, size: int = 10) -> None:
    pdf.set_font("DocFont", size=size)
    pdf.set_text_color(30, 30, 30)


def set_heading(pdf: DesignPDF, text: str, level: int = 1) -> None:
    sizes = {1: 16, 2: 13, 3: 11}
    pdf.set_font("DocFont", size=sizes.get(level, 11))
    pdf.set_text_color(20, 45, 90)
    pdf.multi_cell(0, 8, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)


def add_paragraph(pdf: DesignPDF, text: str) -> None:
    set_body(pdf)
    pdf.multi_cell(0, 6, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)


def add_code_block(pdf: DesignPDF, text: str) -> None:
    pdf.set_fill_color(245, 247, 250)
    pdf.set_font("DocMono", size=8)
    pdf.set_text_color(40, 40, 40)
    for line in text.strip().split("\n"):
        pdf.cell(0, 5, "  " + line, new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
    pdf.ln(3)


def add_table(pdf: DesignPDF, headers: list[str], rows: list[list[str]], col_widths: list[int] | None = None) -> None:
    if col_widths is None:
        width = pdf.w - pdf.l_margin - pdf.r_margin
        col_widths = [width / len(headers)] * len(headers)
    pdf.set_font("DocFont", size=9)
    pdf.set_fill_color(230, 236, 245)
    pdf.set_text_color(20, 45, 90)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border=1, fill=True)
    pdf.ln()
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("DocFont", size=8)
    for row in rows:
        x0 = pdf.get_x()
        y0 = pdf.get_y()
        heights: list[float] = []
        lines_per_cell: list[list[str]] = []
        for i, cell in enumerate(row):
            pdf.set_xy(x0 + sum(col_widths[:i]), y0)
            lines = pdf.multi_cell(col_widths[i], 5, cell, dry_run=True, split_only=True)
            lines_per_cell.append(lines)
            heights.append(max(5, 5 * len(lines)))
        row_h = max(heights)
        if pdf.get_y() + row_h > pdf.h - 20:
            pdf.add_page()
            y0 = pdf.get_y()
        for i, cell in enumerate(row):
            x = x0 + sum(col_widths[:i])
            pdf.rect(x, y0, col_widths[i], row_h)
            pdf.set_xy(x + 1, y0 + 1)
            pdf.multi_cell(col_widths[i] - 2, 5, cell)
            pdf.set_xy(x + col_widths[i], y0)
        pdf.set_xy(x0, y0 + row_h)
    pdf.ln(4)


def build_pdf() -> None:
    pdf = DesignPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("DocFont", "", str(FONT), collection_font_number=0)
    pdf.add_font("DocMono", "", str(FONT), collection_font_number=0)

    # Cover
    pdf.add_page()
    pdf.ln(45)
    pdf.set_font("DocFont", size=24)
    pdf.set_text_color(20, 45, 90)
    pdf.multi_cell(0, 12, "Phase 8.0-8.6 Mock TEE Internal Design", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)
    pdf.set_font("DocFont", size=14)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 8, "Component Architecture and Data Flow", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(20)
    pdf.set_font("DocFont", size=11)
    pdf.multi_cell(
        0,
        7,
        "AegisProof TEE Adapter Layer\nResearch / PoC Architecture Document\nVersion 1.0 | August 2026",
        align="C",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.ln(30)
    pdf.set_fill_color(255, 243, 224)
    pdf.set_text_color(120, 60, 0)
    pdf.set_font("DocFont", size=10)
    pdf.multi_cell(
        0,
        7,
        "IMPORTANT\n\nMock TEE implementation\n≠\nProduction TEE attestation\n\nThis document describes research and PoC design only.",
        align="C",
        fill=True,
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    # 1 Overview
    pdf.add_page()
    set_heading(pdf, "1. Overview", 1)
    add_paragraph(
        pdf,
        "This document consolidates the internal design of Phase 8.0 through 8.6 Mock TEE "
        "components within the AegisProof TEE Adapter Layer. The objective is to provide "
        "an architecture reference that connects cleanly to subsequent phases: Phase 8.7 "
        "(Real Acquisition), Phase 8.8 (Verification Stub and Claims Mapping), and Phase 8.9 "
        "(Remote Attestation Design and Offline Verification PoC).",
    )
    add_paragraph(
        pdf,
        "Mock TEE is not a substitute for hardware attestation. It is a boundary-validation "
        "abstraction used to verify interface correctness, evidence lifecycle, policy evaluation, "
        "and deterministic testing without Intel TDX or AMD SEV-SNP hardware.",
    )
    set_heading(pdf, "1.1 Objectives", 2)
    for item in [
        "Define Phase 8.0-8.6 goals and deliverables",
        "Explain why Mock TEE was introduced before Real hardware integration",
        "Document hardware-independent development and evaluation flow",
        "Establish the Mock to Real TEE migration boundary",
    ]:
        add_paragraph(pdf, f"• {item}")
    set_heading(pdf, "1.2 Scope Statement", 2)
    add_code_block(
        pdf,
        """
Mock TEE implementation
        ≠
Production TEE attestation
        """,
    )

    # 2 Phase Timeline
    set_heading(pdf, "2. Phase Timeline", 1)
    add_table(
        pdf,
        ["Phase", "Content", "Deliverables"],
        [
            ["8.0", "Mock TEE foundation design", "Base interface definitions, Phase 8 architecture scope"],
            ["8.1", "Mock Evidence generation design", "Evidence / TeeProvider schema, adapter-layer design"],
            ["8.2", "Provider abstraction", "Evaluation framework, mock hardware boundary"],
            ["8.3", "Mock Provider implementation", "TdxProviderMock, SevProviderMock"],
            ["8.4", "Evidence normalization and evaluation", "EvidenceNormalizer, verification policy tests, Stage A"],
            ["8.5", "Real TEE migration design", "Attestation flow design, real evaluation plan"],
            ["8.6", "Parser / Provider / Evaluation foundation", "Parsers, ProviderFactory, RealEvidenceNormalizer, Stage B"],
        ],
        [18, 62, 110],
    )

    # 3 System Architecture
    set_heading(pdf, "3. System Architecture", 1)
    add_code_block(
        pdf,
        """
Application Layer
        |
        v
TEE Provider Interface
        |
        +----------------+
        |                |
        v                v
 Mock TDX Provider   Mock SEV Provider
        |                |
        v                v
 Mock Evidence Generator
        |
        v
 Evidence Parser
        |
        v
 Evidence Normalizer
        |
        v
 Verification Stub
        |
        v
 Claims Mapper
        """,
    )
    add_paragraph(
        pdf,
        "Note: Verification Stub and Claims Mapper were introduced in Phase 8.8. "
        "Phase 8.0-8.6 establishes the upstream foundation that these layers extend without breaking Mock separation.",
    )
    add_table(
        pdf,
        ["Component", "Responsibility", "Input", "Output", "Real TEE Delta"],
        [
            ["Application Layer", "Evaluation and integration requests", "Test scenario", "Pass/Fail decision", "Same entry point"],
            ["TEE Provider Interface", "Abstract generate/verify", "reportData Buffer", "Evidence object", "Unchanged contract"],
            ["Mock TDX/SEV Provider", "Synthetic evidence", "Buffer", "Evidence + MOCK flags", "Replaced by Real Provider via factory"],
            ["Mock Evidence Generator", "Mock-only factory wrapper", "Provider type", "Mock TeeProvider", "Forces TEE_ENV=mock"],
            ["Evidence Parser", "Structure validation", "rawReport bytes", "Parsed evidence", "Same parsers for Real path"],
            ["Evidence Normalizer", "Canonical mock form", "Evidence", "NormalizedEvidence", "Real uses separate normalizer"],
            ["Verification Stub", "Structure-only verify", "rawReport", "VerificationResult", "Offline/crypto in 8.9B"],
            ["Claims Mapper", "ZK-oriented claims PoC", "Normalized evidence", "TeeClaims", "Protocol non-contact"],
        ],
        [34, 38, 30, 34, 54],
    )

    # 4 Component Detail
    pdf.add_page()
    set_heading(pdf, "4. Component Detail", 1)

    set_heading(pdf, "4.1 TEE Provider", 2)
    add_code_block(
        pdf,
        """
TEE Provider
    |
    +-- MockProvider (Phase 8.3)
    |
    +-- RealProvider (Phase 8.6+)
            |
            +-- TdxProvider
            +-- SevSnpProvider
        """,
    )
    add_paragraph(
        pdf,
        "The TeeProvider interface (generateEvidence, verifyEvidence, simulateError) absorbs "
        "vendor differences between Intel TDX and AMD SEV-SNP. ProviderFactory (Phase 8.6) "
        "selects Mock or Real implementations using TEE_ENV. Default remains mock to preserve Stage A.",
    )

    set_heading(pdf, "4.2 Mock Evidence Generator", 2)
    add_paragraph(pdf, "Generated mock data categories:")
    for item in ["Quote mock (TDX path)", "Report mock (SEV path)", "Measurement (embedded reportData)", "Claims (via policy evaluation)", "Metadata (providerType, isMock, timestamp)"]:
        add_paragraph(pdf, f"• {item}")
    add_paragraph(pdf, "Purpose: parser tests, verification flow tests, integration tests, and Stage A regression.")
    add_paragraph(
        pdf,
        "Mock evidence embeds mandatory flags: MOCK_DATA_ONLY, NOT_REAL_ATTESTATION, DO_NOT_USE_IN_PRODUCTION.",
    )

    set_heading(pdf, "4.3 Parser Layer", 2)
    add_table(
        pdf,
        ["In Scope", "Out of Scope"],
        [
            ["Binary/structure parsing", "Cryptographic verification"],
            ["Format validation (version, size)", "Trust decision"],
            ["Field boundary checks", "PCCS/KDS collateral fetch"],
        ],
        [95, 95],
    )

    set_heading(pdf, "4.4 Evidence Normalizer", 2)
    add_code_block(
        pdf,
        """
TDX Quote  ----\
                +--> Normalized Evidence
SEV Report ---/
        """,
    )
    add_paragraph(pdf, "Normalized mock evidence fields:")
    add_table(
        pdf,
        ["Field", "Mock Meaning"],
        [
            ["identity", "provider type (TDX / SEV-SNP)"],
            ["measurement", "Logical placeholder in reportData"],
            ["claims", "Policy-level outcome, not ZK input"],
            ["timestamp", "Generation/evaluation time"],
            ["metadata", "isMock=true, tcbStatus=UpToDate (simulated)"],
        ],
        [45, 145],
    )
    add_paragraph(
        pdf,
        "RealEvidenceNormalizer (Phase 8.6) is a separate class with pocScope=structure-only. "
        "Mock normalizer rejects non-mock data; Real normalizer rejects mock flags.",
    )

    # 5 Data Flow
    set_heading(pdf, "5. Data Flow Diagram", 1)
    add_code_block(
        pdf,
        """
Mock TEE Source
      |
      v
Evidence Generation
      |
      v
Parser
      |
      v
Normalized Evidence
      |
      v
Verification Stub
      |
      v
Application Decision
        """,
    )
    add_table(
        pdf,
        ["Step", "Input", "Processing", "Output", "Trust Level"],
        [
            ["Evidence Generation", "reportData", "Mock provider adds MOCK flags", "Evidence object", "Untrusted synthetic"],
            ["Parser", "rawReport bytes", "Version/size validation", "Validated structure", "Structural only"],
            ["Normalization", "Evidence", "Mock-only canonical mapping", "NormalizedEvidence", "Mock domain"],
            ["Verification Stub", "rawReport", "Structure-only stub check", "VerificationResult", "PoC, not production"],
            ["Application Decision", "Policy + results", "ZK+TEE composite rules", "PASS/FAIL", "Evaluation boundary"],
        ],
        [32, 28, 48, 38, 44],
    )

    # 6 Trust Boundary
    pdf.add_page()
    set_heading(pdf, "6. Trust Boundary", 1)
    add_code_block(
        pdf,
        """
+----------------------+
| Application          |
+----------------------+
        Trust Boundary
+----------------------+
| TEE Adapter Layer    |
+----------------------+
        Trust Boundary
+----------------------+
| Evidence Processing  |
+----------------------+
        Trust Boundary
+----------------------+
| Future Hardware TEE  |
+----------------------+
        """,
    )
    add_table(
        pdf,
        ["Boundary", "Trusted", "Not Trusted", "Production Migration Point"],
        [
            ["Application", "Evaluation scripts, policy config", "Provider internals", "Unchanged"],
            ["TEE Adapter", "Interface contracts, factory logic", "Hardware authenticity", "Real Provider swap"],
            ["Evidence Processing", "Normalizer separation rules", "Raw bytes origin (mock)", "Crypto verification gate"],
            ["Hardware TEE", "Future CPU RoT (not in mock)", "Host OS, hypervisor", "Phase 8.7+ acquisition"],
        ],
        [38, 48, 48, 56],
    )

    # 7 Mock vs Real
    set_heading(pdf, "7. Mock vs Real Migration", 1)
    add_table(
        pdf,
        ["Layer", "Mock (8.0-8.6)", "Real (8.7+)"],
        [
            ["Evidence source", "Synthetic (MOCK flags)", "Hardware-generated Quote/Report"],
            ["Parser", "Same interface / shared parsers", "Same parsers (structure validation)"],
            ["Provider", "Mock adapter", "TDX/SEV adapter + acquisition"],
            ["Verification", "Stub / flag check", "DCAP/VCEK (offline PoC in 8.9B)"],
            ["Transport", "None", "Future Remote Attestation (8.9C)"],
            ["Normalizer", "EvidenceNormalizer (mock only)", "RealEvidenceNormalizer (structure-only)"],
        ],
        [38, 76, 76],
    )

    # 8 Security
    set_heading(pdf, "8. Security Considerations", 1)
    set_heading(pdf, "8.1 Prohibited", 2)
    for item in [
        "Treating mock evidence as production trust",
        "Using mock key material as cryptographic roots of trust",
        "Connecting mock path to production verifiers or live PCCS/KDS",
        "Modifying mock normalizer to accept real hardware evidence",
    ]:
        add_paragraph(pdf, f"• {item}")
    set_heading(pdf, "8.2 Maintained Invariants", 2)
    for item in [
        "Interface separation (TeeProvider contract)",
        "Provider abstraction (ProviderFactory)",
        "Normalizer boundary (Mock vs Real classes)",
        "Protocol isolation (no protocol/circuit changes)",
    ]:
        add_paragraph(pdf, f"• {item}")

    # 9 Future Phase Connection
    set_heading(pdf, "9. Future Phase Connection", 1)
    add_code_block(
        pdf,
        """
Phase 8.0-8.6
Mock TEE Foundation
        |
        v
Phase 8.7
Real Acquisition
        |
        v
Phase 8.8
Verification Stub + Claims
        |
        v
Phase 8.9
Remote Attestation Design
(+ 8.9B Offline Verification PoC)
        """,
    )
    add_paragraph(
        pdf,
        "Phase 8.0-8.6 remains the regression anchor. All subsequent phases must preserve "
        "Stage A (Mock Evaluation) PASS and must not collapse Mock/Real separation.",
    )

    pdf.output(str(OUTPUT))
    print(f"Generated: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
