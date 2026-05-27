"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const AnimatedHeading = ({ children, className = "", ...props }) => {
  const headingRef = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    
    const target = headingRef.current;
    const chars = target.querySelectorAll(".char");

    gsap.fromTo(
      chars,
      { 
        y: -50, 
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.03,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: target,
          start: "top 85%",
          toggleActions: "restart none none none",
        },
      }
    );
  }, []);

  // Group by words first to prevent mid-word breaking
  const text = typeof children === "string" ? children : "";
  const words = text.split(" ");

  return (
    <h2 ref={headingRef} className={`flex flex-wrap py-2 ${className}`} {...props}>
      {words.map((word, i) => (
        <span key={i} className="inline-block whitespace-nowrap">
          {word.split("").map((char, j) => (
            <span key={j} className="char inline-block will-change-transform min-w-[0.1em] px-[0.02em]">
              {char}
            </span>
          ))}
          {/* Add a space character after each word except the last one */}
          {i < words.length - 1 && <span className="char inline-block">&nbsp;</span>}
        </span>
      ))}
    </h2>
  );
};
