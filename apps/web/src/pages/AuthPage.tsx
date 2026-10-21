import {
  PendingButton,
  ErrorState,
  Field,
  LoadingState,
} from "../components/ui";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { loginDestination } from "../lib/session";
import { useAuth } from "../lib/auth";
import { http } from "../lib/api-client";
const schema = z.object({
  email: z
    .string()
    .trim()
    .max(255)
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  role: z.enum(["candidate", "employer"]),
});
type Values = z.infer<typeof schema>;
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation(),
    [error, setError] = useState<unknown>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "candidate",
    },
  });
  const submitting = useRef(false);
  const errors = form.formState.errors;
  if (auth.loading) return <LoadingState />;
  if (auth.user)
    return (
      <Navigate
        to={loginDestination(
          auth.user.role,
          (location.state as { from?: string } | null)?.from,
        )}
        replace
      />
    );
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <Link className="brand" to="/login">
          ClearHire ↗
        </Link>
        <p className="eyebrow">A CLEARER WAY TO HIRE</p>
        <h1>
          Every application.
          <br />A clear next step.
        </h1>
        <p>
          Know the role. See the deadlines. Follow the process, from application
          to outcome.
        </p>
        <ol>
          <li>Real roles with salary and deadline commitments</li>
          <li>Visible progress through every hiring stage</li>
          <li>A transparent record of changes and decisions</li>
        </ol>
        <span>Recruitment, with accountability.</span>
      </aside>
      <main className="auth-form">
        <p className="eyebrow">WELCOME TO CLEARHIRE</p>
        <h2>{register ? "Create your account" : "Welcome back"}</h2>
        <p className="muted">
          {register
            ? "Choose your workspace to get started."
            : "Log in to your recruitment workspace."}
        </p>
        {auth.notice && (
          <p role="status" className="notice">
            {auth.notice}
          </p>
        )}
        {(location.state as { registered?: boolean } | null)?.registered && (
          <p className="success" role="status">
            Account created. Log in to continue.
          </p>
        )}
        {error != null && <ErrorState error={error} />}
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError(null);
            if (register) {
              if (!values.firstName.trim()) {
                form.setError("firstName", {
                  message: "First name is required.",
                });
                return;
              }
              if (!values.lastName.trim()) {
                form.setError("lastName", {
                  message: "Last name is required.",
                });
                return;
              }
              if (
                values.password.length < 8 ||
                new TextEncoder().encode(values.password).length > 72
              ) {
                form.setError("password", {
                  message:
                    "Use at least 8 characters and no more than 72 UTF-8 bytes.",
                });
                return;
              }
            }
            if (submitting.current) return;
            submitting.current = true;
            try {
              if (register) {
                await http.send(
                  "/auth/register",
                  "POST",
                  { ...values, email: values.email.trim() },
                  { public: true },
                );
                navigate("/login", {
                  replace: true,
                  state: { registered: true },
                });
              } else {
                const user = await auth.login(
                  values.email.trim(),
                  values.password,
                );
                const from = (location.state as { from?: string } | null)?.from;
                navigate(loginDestination(user.role, from), { replace: true });
              }
            } catch (issue) {
              setError(issue);
            } finally {
              submitting.current = false;
            }
          })}
        >
          {register && (
            <>
              <div className="form-grid">
                <Field label="First name" error={errors.firstName?.message}>
                  <input
                    autoComplete="given-name"
                    {...form.register("firstName")}
                  />
                </Field>
                <Field label="Last name" error={errors.lastName?.message}>
                  <input
                    autoComplete="family-name"
                    {...form.register("lastName")}
                  />
                </Field>
              </div>
              <Field label="I’m here to">
                <select {...form.register("role")}>
                  <option value="candidate">Find a job</option>
                  <option value="employer">Hire candidates</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Email address" error={errors.email?.message}>
            <input
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              {...form.register("password")}
            />
          </Field>
          <PendingButton
            className="full"
            disabled={form.formState.isSubmitting}
            pending={form.formState.isSubmitting}
            pendingText={register ? "Creating account…" : "Logging in…"}
          >
            {form.formState.isSubmitting
              ? "Please wait…"
              : register
                ? "Create account"
                : "Log in →"}
          </PendingButton>
        </form>
        <p>
          {register ? "Already have an account?" : "New to ClearHire?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Log in" : "Create an account"}
          </Link>
        </p>
        <p className="small muted">
          Sessions last 15 minutes. Log in again when your session ends.
        </p>
      </main>
    </div>
  );
}
