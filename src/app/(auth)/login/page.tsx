import { Suspense } from "react";
import { LoginForm } from "@/components/forms/auth-forms";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
