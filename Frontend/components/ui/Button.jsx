export const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const baseStyle = "px-8 md:px-14 py-5 md:py-7 rounded-full font-bold tracking-[0.2em] transition-all duration-700 transform hover:scale-[1.02] active:scale-95 text-[10px] md:text-[11px] uppercase inline-flex items-center gap-4 overflow-hidden relative group shrink-0 select-none border-2";
  const variants = {
    primary: "bg-brand-dark text-white border-brand-dark hover:bg-transparent hover:text-brand-dark",
    secondary: "bg-brand-pink text-white border-brand-pink hover:bg-transparent hover:text-brand-pink",
    outline: "border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white",
    olive: "bg-brand-olive text-white border-brand-olive"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className} cta-glow`} {...props}>
      <span className="relative z-10 flex items-center gap-4">{children}</span>
      {/* Soft Silk Sweep */}
      <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
    </button>
  );
};
