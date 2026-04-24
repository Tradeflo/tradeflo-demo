import type { ReactNode } from "react";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export function AuthShell({
  title,
  description,
  children,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-svh w-full flex-col items-center justify-center bg-[#f5f4f1] p-4 sm:p-6",
        className,
      )}
    >
      <div className="w-full max-w-[440px] space-y-8 animate-fade-in-up">
        <header className="flex flex-col items-center text-center space-y-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1a1916] text-white">
              <HardHat className="size-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#1a1916]">Tradeflo AI</span>
          </Link>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1916]">
              {title}
            </h1>
            <p className="text-[#6b6860] text-[0.95rem]">
              {description}
            </p>
          </div>
        </header>

        <main className="bg-white p-8 rounded-[16px] border border-[#e2e0db] shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
