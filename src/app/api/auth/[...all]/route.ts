import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

const handlers = async () => toNextJsHandler(await auth());
export const GET = async (req: Request) => (await handlers()).GET(req);
export const POST = async (req: Request) => (await handlers()).POST(req);
