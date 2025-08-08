// src/app/auth/signin/form.tsx
import { signIn } from "~/server/auth";

interface SignInFormProps {
  callbackUrl?: string;
}

export function SignInForm({ callbackUrl }: SignInFormProps) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await signIn("credentials", {
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          redirectTo: callbackUrl || "/auth/success",
        });
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-white"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:border-transparent focus:ring-2 focus:ring-[hsl(280,100%,70%)] focus:outline-none"
          placeholder="Enter your email"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-white"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:border-transparent focus:ring-2 focus:ring-[hsl(280,100%,70%)] focus:outline-none"
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-[hsl(280,100%,70%)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[hsl(280,100%,60%)] focus:ring-2 focus:ring-[hsl(280,100%,70%)] focus:ring-offset-2 focus:ring-offset-white/10 focus:outline-none"
      >
        Sign In
      </button>
    </form>
  );
}
