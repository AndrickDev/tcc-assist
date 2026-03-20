import { redirect } from "next/navigation"

// The new TCC flow now lives as an inline modal in the dashboard.
// This route is kept as a redirect for any bookmarked or deep-linked URLs.
export default function NewTccRedirect() {
  redirect("/dashboard")
}
