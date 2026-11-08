import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { getSession } from "@/lib/auth/functions";
import { LoginForm } from "@/components/login-form";

export const Route = createFileRoute("/login")({
    beforeLoad: async () => {
        const session = await getSession();
        if (session) {
            throw redirect({ to: "/" });
        }
    },
    component: Login,
});

function Login() {
    const [error, setError] = useState<string | null>(null);

    const signIn = async () => {
        setError(null);
        try {
            const result = await authClient.signIn.social({
                provider: "google",
                callbackURL: "/",
            });
            if (result.error) {
                setError(result.error.message || "Permintaan login Google gagal.");
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Permintaan login Google gagal.");
        }
    };
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm">
                <LoginForm signIn={signIn} error={error} />
            </div>
        </div>
    )
}
