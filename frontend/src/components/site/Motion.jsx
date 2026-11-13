import {useT} from "@/lib/i18n";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

export function Reveal({ children, delay = 0, y = 28, className = "", as = "div", ...rest }) {
  const C = motion[as] || motion.div;
  return (
    <C
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </C>
  );
}

export function splitLines(text = "", max = 18) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}

export function MaskLines({ lines, onLoad = false, delay = 0, lineClass = "" }) {
  const {td}=useT();
  const translatedLines=splitLines(td(lines.join(" ")),22);
  const line = {
    hidden: { y: "105%" },
    show: (i) => ({ y: "0%", transition: { duration: 1.1, ease: EASE, delay: delay + i * 0.12 } }),
  };
  return (
    <motion.span
      data-no-translate
      className="block"
      initial="hidden"
      {...(onLoad ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.1 } })}
    >
      {translatedLines.map((l, i) => (
        <span key={`${l}-${i}`} className="block overflow-hidden pb-[0.08em]">
          <motion.span className={`block ${lineClass}`} variants={line} custom={i}>
            {l}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

export function Eyebrow({ children, light = false, className = "" }) {
  return (
    <p className={`text-xs uppercase tracking-[0.24em] font-semibold ${light ? "text-glow" : "text-accent"} ${className}`}>
      {children}
    </p>
  );
}
