import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { img } from "@/lib/api";
import { MaskLines, splitLines, Eyebrow } from "./Motion";

export default function PageHeader({ eyebrow, title, intro, photo, testid }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  return (
    <section ref={ref} data-testid={testid} className="relative min-h-[78svh] md:min-h-[86vh] overflow-hidden bg-ink grain">
      {photo && (
        <motion.img
          src={img(photo.url)}
          alt={photo.alt}
          style={{ y }}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1813]/90 via-[#0f1813]/40 to-[#0f1813]/30" />
      <div className="relative z-10 mx-auto flex min-h-[78svh] md:min-h-[86vh] max-w-7xl flex-col justify-end px-5 md:px-10 pb-14 md:pb-20 pt-32">
        <Eyebrow light className="mb-5">{eyebrow}</Eyebrow>
        <h1 className="max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-medium leading-[0.98] tracking-tight text-on-dark">
          <MaskLines lines={splitLines(title, 22)} onLoad delay={0.2} />
        </h1>
        {intro && (
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.9 }} className="mt-6 max-w-xl text-base md:text-lg leading-relaxed text-[#E8E4DC]">
            {intro}
          </motion.p>
        )}
        {photo?.illustration && <span className="mt-6 text-xs text-[#D9DFDA]">Image d'illustration</span>}
      </div>
    </section>
  );
}

