"use client";

import { useState } from "react";
import SectionHeader from "./SectionHeader";

/**
 * Real answers, including the uncomfortable ones. The last two exist because
 * docs/THREATMODEL.md and docs/FUTURE.md state these limits plainly, and a
 * landing page that quietly omitted them would be less honest than the repo
 * it links to.
 */
const faqs = [
  {
    question: "ISN'T THIS JUST A GUARDRAIL?",
    answer:
      "NO. A GUARDRAIL CHECKS THE AGENT'S OUTPUT AGAINST A RULE. BONDED CHECKS WHETHER THE AGENT'S STATED REASONS MATCH REALITY — INDEPENDENTLY, VIA A DIFFERENT DATA PATH THAN THE ONE THE AGENT USED. IT CATCHES LYING, NOT JUST RULE-BREAKING.",
    defaultOpen: true,
  },
  {
    question: "WHAT STOPS THE ENFORCER ITSELF BEING COMPROMISED?",
    answer:
      "NOTHING ABSOLUTE, AND WE SAY SO IN THE THREAT MODEL. BONDED MOVES TRUST FROM A LARGE GENERATIVE MODEL TO A SMALL, AUDITABLE, NON-GENERATIVE COMPONENT — IT DOES NOT ELIMINATE TRUST. WHAT IT ADDS: THE POLICY THRESHOLD LIVES IN A TEE, AND ANYTHING IRREVERSIBLE NEEDS A SECOND HUMAN CONFIRMATION REGARDLESS OF WHAT THE ENFORCER SIGNS.",
  },
  {
    question: "DOES IT CATCH A TRUE-BUT-MISLEADING PREMISE?",
    answer:
      "NO. IF AN ATTACKER MANIPULATES REAL TVL, RE-DERIVATION CONFIRMS THE MANIPULATED NUMBER — BECAUSE IT IS, AT THAT BLOCK, TRUE. BONDED CATCHES LYING, NOT REALITY DISTORTION. THAT LIMIT IS DELIBERATE AND DOCUMENTED.",
  },
  {
    question: "WHY ARC?",
    answer:
      "USDC-NATIVE GAS. THE PITCH DEPENDS ON THE AGENT NEVER NEEDING TO REASON ABOUT OR ACQUIRE A SEPARATE GAS ASSET — WHICH IS WHAT MAKES \"THE ACCOUNT JUST WORKS\" LITERAL RATHER THAN ASPIRATIONAL.",
  },
  {
    question: "WHAT ISN'T BUILT YET?",
    answer:
      "THE NAIVE-AGENT CORPUS HASN'T BEEN RUN — RESULTS.JSON REPORTS NOT_YET_RUN RATHER THAN A FABRICATED NUMBER. CRE DEPLOYMENT IS WAITLISTED, SO THE CONFIDENTIAL WORKFLOW IS PROVEN BY SIMULATION ONLY. THE KILL-SWITCH CONSOLE IS DESIGNED, NOT BUILT. ALL OF IT IS LISTED IN DOCS/FUTURE.MD.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
      <section id="faq" className="flex flex-col w-full bg-[#060606] py-16 px-6 md:py-[100px] md:px-[120px]">
      <div className="w-full max-w-[480px]">
        <SectionHeader
          label="[08] // FAQ"
          title={"THE HARD\nQUESTIONS."}
          subtitle="INCLUDING THE ONES WHERE THE ANSWER IS “NO”."
          titleWidth="w-full"
          subtitleWidth="w-full"
        />
      </div>

      <div className="h-10 md:h-[64px]" />

      {/* FAQ items */}
      <div className="flex flex-col w-full">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="flex flex-col w-full border-t border-t-[#1D1D1D]">
              <button
                className="flex items-center justify-between w-full py-5 md:h-[72px] text-left gap-4"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
              >
                <span className="font-grotesk text-[14px] md:text-[16px] font-bold text-[#F5F5F0] tracking-[1px]">
                  {faq.question}
                </span>
                <div
                  className="flex items-center justify-center w-[32px] h-[32px] shrink-0"
                  style={{ backgroundColor: isOpen ? "#FFD600" : "#1A1A1A", border: isOpen ? "none" : "1px solid #3D3D3D" }}
                >
                  <span
                    className="font-ibm-mono text-[14px] font-bold"
                    style={{ color: isOpen ? "#0A0A0A" : "#888888" }}
                  >
                    {isOpen ? "—" : "+"}
                  </span>
                </div>
              </button>
              {isOpen && faq.answer && (
                <div className="pb-8">
                  <p className="font-ibm-mono text-[12px] md:text-[13px] text-[#888888] tracking-[1px] leading-[1.6]">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div className="border-t border-t-[#1D1D1D]" />
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-[16px] pt-10 md:pt-[48px]">
        <span className="font-ibm-mono text-[13px] text-[#555555] tracking-[1px]">
          STILL HAVE QUESTIONS?
        </span>
        <span className="font-ibm-mono text-[13px] font-bold text-[#FFD600] tracking-[1px] cursor-pointer hover:underline">
          TALK TO A HUMAN &gt;
        </span>
      </div>
    </section>
  );
}
