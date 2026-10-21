import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { ApiError } from "../lib/api-client";
import { useAuth } from "../lib/auth";
import { useApiMutation } from "../lib/query";
import { Field, Feedback, PendingButton } from "./ui";
export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(64)
    .refine(
      (value) =>
        value === "" ||
        (/^\+?[0-9() .\/-]+$/.test(value) &&
          value.replace(/\D/g, "").length >= 3 &&
          value.replace(/\D/g, "").length <= 20),
      "Enter a phone number using digits, an optional leading +, and common separators",
    ),
});
type ContactValues = z.infer<typeof contactSchema>;
export function ContactDetails() {
  const { user, token, updateUser } = useAuth();
  const mutation = useApiMutation(api.updateCurrentUser, []);
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: user!.firstName,
      lastName: user!.lastName,
      email: user!.email,
      phone: user!.phone ?? "",
    },
  });
  // Only server-confirmed account changes reset the form, never rejected input.
  useEffect(() => {
    if (user)
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? "",
      });
  }, [user, form.reset]);
  const errors = form.formState.errors;
  return (
    <section className="panel contact-panel" aria-labelledby="contact-heading">
      <h2 id="contact-heading">Basic contact details</h2>
      <p className="muted">
        Your personal account details. Email changes take effect immediately
        without verification.
      </p>
      <form
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors();
          // Send only dirty fields so an unrelated account field cannot be overwritten.
          const changes = Object.fromEntries(
            Object.entries(values).filter(
              ([key]) => form.formState.dirtyFields[key as keyof ContactValues],
            ),
          );
          if (!Object.keys(changes).length) return;
          mutation.mutate(
            {
              ...changes,
              ...(Object.hasOwn(changes, "phone")
                ? { phone: values.phone || null }
                : {}),
            },
            {
              onSuccess: (result) => updateUser(result.user, token),
              onError: (error) => {
                if (error instanceof ApiError)
                  for (const [field, messages] of Object.entries(
                    error.fields,
                  )) {
                    if (field in contactSchema.shape)
                      form.setError(field as keyof ContactValues, {
                        message: messages.join(" "),
                      });
                  }
              },
            },
          );
        })}
      >
        <fieldset disabled={mutation.isPending}>
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
            <Field label="Email address" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Phone number (optional)"
              error={errors.phone?.message}
            >
              <input
                type="tel"
                autoComplete="tel"
                {...form.register("phone")}
              />
            </Field>
          </div>
          <PendingButton
            pending={mutation.isPending}
            pendingText="Saving contact details…"
            disabled={!form.formState.isDirty}
          >
            Save contact details
          </PendingButton>
        </fieldset>
        <Feedback
          error={mutation.error}
          success={
            mutation.isSuccess && !form.formState.isDirty
              ? "Contact details saved."
              : undefined
          }
        />
      </form>
    </section>
  );
}
