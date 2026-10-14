import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { ru } from "@/i18n/ru";
export default function Page() {
  return (
    <Suspense fallback={<p>{ru.loading}</p>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
