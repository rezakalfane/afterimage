// "/" → the best locale from the browser's Accept-Language, else the default locale.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pickLocale } from "@/lib/locale";

export default async function Home() {
  redirect(`/${pickLocale((await headers()).get("accept-language"))}`);
}
