import { Instrument_Sans } from "next/font/google";
import { QuoteBuilderApp } from "@/components/quote-builder";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--qb-font",
  display: "swap",
});

export default function Home() {
  return (
    <div className={`${instrumentSans.variable} ${instrumentSans.className}`}>
      <QuoteBuilderApp />
    </div>
  );
}
