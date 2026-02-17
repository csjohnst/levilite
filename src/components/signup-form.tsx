"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SignupFormProps {
  buttonText?: string;
  className?: string;
  dark?: boolean;
}

export function SignupForm({ buttonText = "Get early access", className = "", dark = false }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");

    try {
      // Subscribe via Kit API v4 form endpoint
      const response = await fetch("https://api.kit.com/v4/forms/9097515/subscribers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kit-Api-Key": "kit_373287bfc9ba036f5460fdf3c5be6d8d",
        },
        body: JSON.stringify({ email_address: email }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("You're in! We'll be in touch soon.");
        setEmail("");
      } else {
        throw new Error("Subscription failed");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again or email chris@kokorosoftware.com");
    }
  };

  if (status === "success") {
    return (
      <div className={`${className}`}>
        <div className={`text-center py-3 px-6 rounded-lg ${dark ? "bg-white/10 text-white" : "bg-green-50 text-green-700"}`}>
          <p className="font-semibold">✓ {message}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-3 max-w-md mx-auto ${className}`}>
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={dark
          ? "bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
          : "h-12"
        }
      />
      <Button
        type="submit"
        disabled={status === "loading"}
        className={dark
          ? "bg-white text-[#02667F] hover:bg-white/90 font-semibold h-12 px-8 whitespace-nowrap"
          : "bg-[#02667F] text-white hover:bg-[#02667F]/90 font-semibold h-12 px-8 whitespace-nowrap"
        }
      >
        {status === "loading" ? "Joining..." : buttonText}
      </Button>
      {status === "error" && (
        <p className={`text-sm mt-1 ${dark ? "text-red-300" : "text-red-500"}`}>{message}</p>
      )}
    </form>
  );
}
