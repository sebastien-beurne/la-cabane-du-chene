import {
  Trees, Castle, Bath, Sun, Fence, ChefHat, BedDouble, ShowerHead, Sofa, Tv, Snowflake, Flower2,
  Wifi, Car, Flame, Coffee, Wine, Baby, Dog, Utensils, Sparkles, Mountain,
} from "lucide-react";

export const ICONS = {
  trees: Trees, castle: Castle, bath: Bath, sun: Sun, fence: Fence, "chef-hat": ChefHat, "bed-double": BedDouble,
  "shower-head": ShowerHead, sofa: Sofa, tv: Tv, snowflake: Snowflake, flower: Flower2, wifi: Wifi, car: Car,
  flame: Flame, coffee: Coffee, wine: Wine, baby: Baby, dog: Dog, utensils: Utensils, sparkles: Sparkles, mountain: Mountain,
};

export function Icon({ name, size = 22, className = "" }) {
  const C = ICONS[name] || Sparkles;
  return <C size={size} strokeWidth={1.4} className={className} />;
}

