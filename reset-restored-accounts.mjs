
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
  { email: "salsabiilads99@gmail.com" },
  { email: "pemogramanweb596@gmail.com" },
];

for (const account of accounts) {
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("Gagal mengambil daftar Auth:", listError.message);
    process.exitCode = 1;
    break;
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === account.email.toLowerCase()
  );

  if (!user) {
    console.error("Akun Auth tidak ditemukan:", account.email);
    continue;
  }

  const temporaryPassword = randomBytes(18).toString("base64url");

  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      password: temporaryPassword,
      email_confirm: true,
    }
  );

  if (error) {
    console.error("Gagal memperbarui", account.email, error.message);
    continue;
  }

  console.log("BERHASIL:", account.email);
  console.log("UUID:", data.user.id);
  console.log("PASSWORD BARU:", temporaryPassword);
}
