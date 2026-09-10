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
    question: "Isn't this just a guardrail?",
    answer:
      "No. A guardrail checks the agent's output against a rule. Bonded checks whether the agent's stated reasons match reality — independently, via a different data path than the one the agent used. It catches lying, not just rule-breaking.",
    defaultOpen: true,
  },
  {
    question: "What stops the enforcer itself being compromised?",
    answer:
      "Nothing absolute, and we say so in the threat model. Bonded moves trust from a large generative model to a small, auditable, non-generative component — it does not eliminate trust. What it adds: the policy threshold lives in a TEE, and anything irreversible needs a second human confirmation regardless of what the enforcer signs.",
  },
  {
    question: "Does it catch a true-but-misleading premise?",
    answer:
      "No. If an attacker manipulates real TVL, re-derivation confirms the manipulated number — because it is, at that block, true. Bonded catches lying, not reality distortion. That limit is deliberate and documented.",
  },
  {
    question: "Why Arc?",
    answer:
      "USDC-native gas. The pitch depends on the agent never needing to reason about or acquire a separate gas asset — which is what makes \"the account just works\" literal rather than aspirational.",
  },
  {
    question: "What isn't built yet?",
    answer:
      "The naive-agent corpus hasn't been run — results.json reports NOT_YET_RUN rather than a fabricated number. CRE deployment is waitlisted, so the confidential workflow is proven by simulation only. The kill-switch console is designed, not built. All of it is listed in docs/FUTURE.md.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
      <section id="faq" className="flex flex-col w-full bg-[#060606] py-16 px-6 md:py-[100px] md:px-[120px]">
      <div className="w-full max-w-[480px]">
        <SectionHeader
          label="[08] // FAQ"
          title={"The hard\nquestions."}
          subtitle="Including the ones where the answer is “no”."
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
                    className="font-mono text-[14px] font-bold"
                    style={{ color: isOpen ? "#0A0A0A" : "#888888" }}
                  >
                    {isOpen ? "—" : "+"}
                  </span>
                </div>
              </button>
              {isOpen && faq.answer && (
                <div className="pb-8">
                  <p className="font-mono text-[12px] md:text-[13px] text-[#888888] tracking-[1px] leading-[1.6]">
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
        <span className="font-mono text-[13px] text-[#555555] tracking-[1px]">
          Everything above is in the repo, in more detail.
        </span>
        <span className="font-mono text-[13px] font-bold text-[#FFD600] tracking-[1px] cursor-pointer hover:underline">
          Read the threat model &gt;
        </span>
      </div>
    </section>
  );
}
