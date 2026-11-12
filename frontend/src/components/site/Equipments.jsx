import { useSite } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal, Eyebrow } from "./Motion";

export default function Equipments({ eyebrow = "Équipements", title = "Le confort d'une maison, le charme d'une cabane" }) {
  const items = useSite()?.content?.equipments;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return (
    <section data-testid="equipments-section" className="bg-[#EFEAE1] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <Reveal className="grid gap-6 md:grid-cols-12 mb-14">
          <div className="md:col-span-5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-medium leading-[1.05] text-[#1B2B24]">{title}</h2>
          </div>
        </Reveal>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 border-t border-l border-[#2D4A3E]/15">
          {list.map((e, i) => (
            <Reveal as="li" key={`${e.label}-${i}`} delay={(i % 4) * 0.06} y={16}
              className="group flex flex-col gap-5 border-b border-r border-[#2D4A3E]/15 p-5 md:p-7 transition-colors duration-500 hover:bg-[#F8F5F0]">
              <span data-testid={`equipment-${i}`} className="grid h-12 w-12 place-items-center rounded-full bg-[#F8F5F0] text-[#2D4A3E] transition-[background-color,color] duration-500 group-hover:bg-[#2D4A3E] group-hover:text-[#F8F5F0]">
                <Icon name={e.icon} />
              </span>
              <span className="text-sm md:text-base font-medium text-[#1B2B24]">{e.label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

