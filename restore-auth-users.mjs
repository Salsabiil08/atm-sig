
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const accounts = [
  {
    name: "Salsa",
    email: "salsabiilads99@gmail.com",
  },
  {
    name: "Sevtuari",
    email: "pemogramanweb596@gmail.com",
  },
];

for (const account of accounts) {
  const temporaryPassword = randomBytes(18).toString("base64url");

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: temporaryPassword,
    email_confirm: false,
    user_metadata: { name: account.name },
  });

  if (error) {
    console.error(`GAGAL ${account.email}: ${error.message}`);
    continue;
  }

  console.log(`BERHASIL: ${account.email}`);
  console.log(`UUID_AUTH=${data.user.id}`);
  console.log(`PASSWORD_SEMENTARA=${temporaryPassword}`);
}
