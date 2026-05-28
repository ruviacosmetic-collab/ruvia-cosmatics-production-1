export const testimonials = [
  { name: "ANANYA S.", text: "I literally used to cancel plans because my skin looked so dull. 3 weeks into the serum, my colleague asked what facial I got done. I didn't get one. I just stopped hiding.", stats: "DITCHED FOUNDATION — WEEK 3" },
  { name: "PRIYA K.", text: "I spent ₹40K+ on imported products last year. NOTHING changed my pigmentation. Ruvia did it in one bottle. ONE. I'm angry I didn't find this sooner.", stats: "₹40K WASTED BEFORE RUVIA" },
  { name: "AMITA R.", text: "Mumbai humidity + auto rickshaw pollution = my skin was done. Dry, patchy, aging at 29. After 4 weeks of the Barrier Cream, my mother-in-law said I'm glowing. That's the review that matters.", stats: "MOTHER-IN-LAW APPROVED" },
  { name: "SNEHA L.", text: "I have acne scars from 10th class. I've literally tried everything — home remedies, dermat peels, Korean skincare. The Vitamin C Booster did more in 6 weeks than all of it combined.", stats: "10-YEAR SCARS. 6 WEEKS." }
];

export const steps = [
  { title: "Take The Quiz", desc: "Answer 5 questions. We tell you exactly what's wrong and what will fix it. No jargon. No upselling.", img: "/images/doctor.png" },
  { title: "Get Your Kit", desc: "Your personalized routine arrives at your door. Free shipping. Cash on delivery. Try it risk-free.", img: "/images/founder.png" },
  { title: "Watch It Work", desc: "Follow the 60-second routine. See the difference by Day 21. If you don't — we refund everything.", img: "/images/hero.png" }
];

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const apiUrl = (path) => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};
