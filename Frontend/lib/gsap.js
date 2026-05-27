import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const registerGSAP = () => {
  if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }
};

export const animateFadeUp = (selector) => {
  if (typeof window === "undefined") return;
  const elements = gsap.utils.toArray(selector);
  elements.forEach((el) => {
    gsap.fromTo(el, 
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true
        }
      }
    );
  });
};
