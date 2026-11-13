import { useSite } from "@/lib/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal, Eyebrow } from "./Motion";

export default function Faq() {
  const faq = useSite()?.content?.faq;
  const list = Array.isArray(faq) ? faq.filter((f) => f?.q) : [];
  if (!list.length) return null;
  return (
    <section id="faq" data-testid="faq-section" className="scroll-mt-24 bg-sand py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-medium leading-[1.05] text-ink">Avant de poser vos valises</h2>
          <p className="mt-5 text-muted-ink leading-relaxed">Une autre question ? Écrivez-nous depuis la page contact, nous répondons volontiers.</p>
        </Reveal>
        <Reveal className="lg:col-span-8" delay={0.1}>
          <Accordion type="single" collapsible className="border-t border-brand/15">
            {list.map((f, i) => (
              <AccordionItem key={i} value={`q${i}`} className="border-b border-brand/15">
                <AccordionTrigger data-testid={`faq-q-${i}`} className="py-6 text-left font-display text-xl md:text-2xl font-medium text-ink hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-body">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

