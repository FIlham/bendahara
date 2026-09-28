import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/auth.functions";
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
    const signIn = async () => {
        const data = await authClient.signIn.social({
            provider: "google",
        });
    };
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm">
                <LoginForm signIn={signIn} />
            </div>
        </div>
    )
}
