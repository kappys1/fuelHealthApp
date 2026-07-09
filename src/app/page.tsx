import { redirect } from "next/navigation";

export default function RootPage() {
  // La raíz siempre lleva a la pantalla principal; el proxy decide si hay que
  // pasar antes por /login.
  redirect("/hoy");
}
