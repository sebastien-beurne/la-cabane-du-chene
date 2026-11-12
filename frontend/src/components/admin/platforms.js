export const PLATFORMS = {
  direct: { label: "Ce site (direct)", color: "#8B5A2B" },
  airbnb: { label: "Airbnb", color: "#FF5A5F" },
  booking: { label: "Booking.com", color: "#003580" },
  greengo: { label: "GreenGo", color: "#2E9E5B" },
  abracadaroom: { label: "AbracadaRoom", color: "#C2185B" },
  autre: { label: "Autre", color: "#64748B" },
  manuel: { label: "Bloqué par vous", color: "#9CA3AF" },
};

export const plat = (k) => PLATFORMS[k] || PLATFORMS.autre;

